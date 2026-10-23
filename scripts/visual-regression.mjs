#!/usr/bin/env node
/**
 * 视觉回归：无头 Chrome 截图 → 与基线逐像素比较（ADR-020）。
 *
 * 替代 PR 清单里那条人工项「涉及布局改动，已用 __web_preview 截图核对」。
 *
 * ## 拍什么
 *
 * 文档站每个组件页右侧栏的 H5 预览（`.wd-h5-phone__screen`）——那是用真实组件
 * 源码渲染出来的手机屏，**不含正文与 API 表格**。
 *
 * 为什么不拍整页：组件页正文由 `meta.json` 生成，改一句 JSDoc 就会让 106 张
 * 基线全红。裁剪到组件区域，基线只随样式与组件行为变化。
 *
 * ## 为什么基线按平台分目录
 *
 * 字体光栅化在 Windows / macOS / Linux 上不同，中文字形的差异尤其大。一份基线
 * 跨平台比较必然全红，那不是回归。所以基线落在 `visual/baseline/<platform>/`，
 * 缺基线时明确跳过而不是判失败——**假装通过比跳过更糟**。
 *
 * ## 用法
 *
 *   node scripts/visual-regression.mjs --serve docs/.vitepress/dist --update
 *   node scripts/visual-regression.mjs --serve docs/.vitepress/dist --check
 *   node scripts/visual-regression.mjs --serve docs/.vitepress/dist --only button,tag
 */
import { createServer } from 'node:http'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { decodePng, encodePng } from './lib/png.mjs'
import { analyzeContent, diffImages, DEFAULT_TOLERANCE } from './lib/image-diff.mjs'
import { launchChrome } from './lib/chrome.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const META_PATH = path.join(ROOT, 'packages/ui/meta.json')
const SETTINGS_PATH = path.join(ROOT, 'visual/targets.json')
const CURRENT_DIR = path.join(ROOT, 'visual/current')

/** 默认设置；`visual/targets.json` 可覆盖 */
const DEFAULTS = {
  viewport: { width: 1600, height: 1200 },
  selector: '.wd-h5-phone__screen',
  settleMs: 350,
  threshold: 0.002,
  tolerance: DEFAULT_TOLERANCE,
  exclude: []
}

/**
 * 冻结动画与过渡。
 *
 * 不冻结的话，同一页两次截图会因为动画相位不同而必然产生差异——视觉回归就
 * 退化成随机噪声。代价是基线记录的是「静止态」，动效本身不在覆盖范围内。
 */
const FREEZE_CSS =
  '*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}'

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

// ---------------------------------------------------------------------------
// 目标清单
// ---------------------------------------------------------------------------

/**
 * 页面清单从 `meta.json` 派生，不另立一份组件列表。
 *
 * 项目里已经因为「手写第二份清单」出过两次问题（barrel、文档侧边栏），
 * 视觉回归不该成为第三份。
 *
 * `exclude` 的每一项都**必须写理由**（同 ADR-013 对组件族的要求）：被排除的
 * 组件等于放弃覆盖，理由得留在数据里，而不是留在某次聊天的记忆里。
 */
function resolveTargets(settings) {
  if (!existsSync(META_PATH)) {
    throw new Error(`找不到 ${path.relative(ROOT, META_PATH)}，先运行 pnpm gen:meta`)
  }
  const meta = JSON.parse(readFileSync(META_PATH, 'utf8'))

  const exclude = new Map()
  for (const entry of settings.exclude ?? []) {
    const name = typeof entry === 'string' ? entry : entry?.name
    const reason = typeof entry === 'string' ? '' : (entry?.reason ?? '')
    if (!name) throw new Error(`visual/targets.json 的 exclude 条目缺少 name：${JSON.stringify(entry)}`)
    if (!reason.trim()) {
      throw new Error(
        `visual/targets.json 里排除 ${name} 必须写 reason。\n` +
          `  排除等于放弃覆盖，理由要留在数据里（同 ADR-013 对 families.json 的要求）。`
      )
    }
    exclude.set(name, reason)
  }

  return Object.keys(meta)
    .filter((name) => name.startsWith('wd-'))
    .map((name) => name.replace(/^wd-/, ''))
    .filter((slug) => !exclude.has(slug))
    .sort()
    .map((slug) => ({ name: slug, path: `/components/${slug}.html` }))
}

function loadSettings() {
  if (!existsSync(SETTINGS_PATH)) return { ...DEFAULTS }
  const raw = JSON.parse(readFileSync(SETTINGS_PATH, 'utf8'))
  return {
    ...DEFAULTS,
    ...raw,
    viewport: { ...DEFAULTS.viewport, ...(raw.viewport ?? {}) },
    exclude: raw.exclude ?? []
  }
}

// ---------------------------------------------------------------------------
// 静态服务器
// ---------------------------------------------------------------------------

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.ico': 'image/x-icon'
}

/** 起一个只读静态服务器，返回 `{ origin, close }` */
async function serveStatic(dir) {
  const server = createServer(async (req, res) => {
    let pathname = decodeURIComponent((req.url ?? '/').split('?')[0])
    if (pathname.endsWith('/')) pathname += 'index.html'
    if (!extname(pathname)) pathname += '.html'
    const file = join(dir, normalize(pathname).replace(/^([/\\])+/, ''))
    try {
      const buf = await readFile(file)
      res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' })
      res.end(buf)
    } catch {
      res.writeHead(404, { 'content-type': 'text/plain' })
      res.end('not found')
    }
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address()
  return {
    origin: `http://127.0.0.1:${port}`,
    close: () => new Promise((resolve) => server.close(resolve))
  }
}

// ---------------------------------------------------------------------------
// 截图
// ---------------------------------------------------------------------------

async function waitUntil(cdp, expression, timeoutMs, label) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (await cdp.evaluate(expression)) return true
    await sleep(100)
  }
  throw new Error(`等待超时（${label}）`)
}

/**
 * 截取一个页面里的目标元素。
 *
 * 只截元素而非整页：正文由 meta 生成，任何文档措辞改动都会污染基线。
 */
async function captureElement(cdp, url, settings) {
  await cdp.send('Page.navigate', { url })
  await waitUntil(cdp, `document.readyState === 'complete'`, 20000, `${url} 加载`)

  // 尽早注入冻结样式：演示是异步挂载的，等它出现再注入会先闪一帧动画
  await cdp.evaluate(
    `(() => {
      const style = document.createElement('style')
      style.textContent = ${JSON.stringify(FREEZE_CSS)}
      document.head.appendChild(style)
      return true
    })()`
  )

  const selector = settings.selector
  await waitUntil(
    cdp,
    `(() => {
      const el = document.querySelector(${JSON.stringify(selector)})
      if (!el) return false
      const r = el.getBoundingClientRect()
      return r.width > 40 && r.height > 40
    })()`,
    20000,
    `${url} 的 ${selector}`
  )

  // 字体就绪后再截图：中文字体晚到会改变换行与高度
  await cdp.evaluate(`document.fonts ? document.fonts.ready.then(() => true) : true`)
  await sleep(settings.settleMs)

  // 滚到视口中央再取 rect：aside 可能被页面滚动带出可视区
  const rect = await cdp.evaluate(
    `(() => {
      const el = document.querySelector(${JSON.stringify(selector)})
      el.scrollIntoView({ block: 'center', inline: 'center' })
      const r = el.getBoundingClientRect()
      return { x: r.x, y: r.y, width: r.width, height: r.height }
    })()`
  )
  await sleep(60)

  const shot = await cdp.send('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: false,
    clip: { x: rect.x, y: rect.y, width: rect.width, height: rect.height, scale: 1 }
  })
  return Buffer.from(shot.data, 'base64')
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const args = {
    serve: null,
    baseUrl: null,
    only: null,
    update: false,
    check: false,
    stability: false,
    threshold: null,
    tolerance: null,
    port: 0
  }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    const next = () => {
      const v = argv[++i]
      if (v === undefined) throw new Error(`${a} 缺少参数`)
      return v
    }
    if (a === '--serve') args.serve = next()
    else if (a === '--base-url') args.baseUrl = next()
    else if (a === '--only') args.only = next().split(',').map((s) => s.trim()).filter(Boolean)
    else if (a === '--update') args.update = true
    else if (a === '--check') args.check = true
    else if (a === '--stability') args.stability = true
    else if (a === '--threshold') args.threshold = Number(next())
    else if (a === '--tolerance') args.tolerance = Number(next())
    else if (a === '--port') args.port = Number(next())
    else if (a === '--help' || a === '-h') args.help = true
    else throw new Error(`未知参数：${a}`)
  }
  return args
}

function usage() {
  return [
    '用法：node scripts/visual-regression.mjs [选项]',
    '',
    '选项：',
    '  --serve <dir>      启动内置静态服务器指向该目录（文档站产物）',
    '  --base-url <url>   使用已有服务器，如 http://127.0.0.1:4173',
    '  --only <a,b>       只处理这些组件（slug，不带 wd- 前缀）',
    '  --update           把当前截图写成基线',
    '  --check            与基线比较，超过阈值则 exit 1',
    '  --stability        每个目标连拍两次，报告不确定的组件（用于决定 exclude）',
    '  --threshold <r>    变化像素占比阈值，默认 0.002（0.2%）',
    '  --tolerance <n>    单通道容差，默认 8',
    '  --port <n>         Chrome 调试端口，默认自动选',
    '  -h, --help         显示本帮助',
    '',
    '基线与差异图：',
    `  visual/baseline/<platform>/<slug>.png`,
    `  visual/current/<slug>.png、visual/current/diff/<slug>.png`
  ].join('\n')
}

function pickPort() {
  return 9300 + Math.floor(Math.random() * 500)
}

async function main() {
  let args
  try {
    args = parseArgs(process.argv.slice(2))
  } catch (err) {
    console.error(`✖ ${err.message}`)
    console.error(usage())
    process.exit(2)
  }
  if (args.help) {
    console.log(usage())
    return
  }
  if (!args.update && !args.check && !args.stability) {
    console.error('✖ 必须指定 --update / --check / --stability 之一（不做隐式写盘）')
    console.error(usage())
    process.exit(2)
  }
  const modeCount = [args.update, args.check, args.stability].filter(Boolean).length
  if (modeCount > 1) {
    console.error('✖ --update / --check / --stability 互斥')
    process.exit(2)
  }

  const settings = loadSettings()
  if (args.threshold !== null) settings.threshold = args.threshold
  if (args.tolerance !== null) settings.tolerance = args.tolerance

  let targets = resolveTargets(settings)
  if (args.only) {
    const wanted = new Set(args.only)
    const unknown = [...wanted].filter((s) => !targets.some((t) => t.name === s))
    if (unknown.length) {
      // 被 exclude 的组件也走这条：直接说「未知」会让人以为名字写错了
      const excluded = new Map(
        (settings.exclude ?? []).map((e) => [typeof e === 'string' ? e : e.name, typeof e === 'string' ? '' : e.reason])
      )
      for (const name of unknown) {
        if (excluded.has(name)) {
          console.error(`✖ ${name} 已被排除在视觉回归之外，原因：${excluded.get(name)}`)
        } else {
          console.error(`✖ 未知组件：${name}（清单来自 meta.json）`)
        }
      }
      process.exit(2)
    }
    targets = targets.filter((t) => wanted.has(t.name))
  }
  if (targets.length === 0) {
    console.error('✖ 没有可处理的目标')
    process.exit(2)
  }

  let server = null
  let origin = args.baseUrl
  if (!origin) {
    const dir = args.serve ?? path.join(ROOT, 'docs/.vitepress/dist')
    if (!existsSync(dir)) {
      console.error(`✖ 找不到站点产物：${path.relative(ROOT, dir)}`)
      console.error('  先运行 pnpm docs:build，或用 --serve / --base-url 指定。')
      process.exit(2)
    }
    server = await serveStatic(path.resolve(dir))
    origin = server.origin
  }

  const platform = process.platform
  const baselineDir = path.join(ROOT, 'visual/baseline', platform)
  mkdirSync(baselineDir, { recursive: true })
  if (args.check) {
    mkdirSync(path.join(CURRENT_DIR, 'diff'), { recursive: true })
  }

  console.log(`目标站点：${origin}`)
  console.log(`平台基线：${path.relative(ROOT, baselineDir)}`)
  console.log(`组件 ${targets.length} 个，选择器 ${settings.selector}`)
  console.log('')

  const { cdp, close, chromePath } = await launchChrome({
    port: args.port || pickPort(),
    viewport: settings.viewport
  })

  const results = { passed: [], failed: [], missing: [], written: [], errors: [], blank: [], unstable: [] }

  try {
    await cdp.send('Page.enable')
    await cdp.send('Runtime.enable')
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: settings.viewport.width,
      height: settings.viewport.height,
      deviceScaleFactor: 1,
      mobile: false
    })

    for (const target of targets) {
      const url = origin + target.path
      try {
        const png = await captureElement(cdp, url, settings)
        const shot = decodePng(png)
        const content = analyzeContent(shot)
        if (content.blank) results.blank.push(target.name)

        if (args.stability) {
          // 连拍两次：同一份代码同一台机器，差异只可能来自时间/动画/随机
          const again = decodePng(await captureElement(cdp, url, settings))
          const delta = diffImages(shot, again, { tolerance: settings.tolerance })
          if (delta.ratio > settings.threshold) {
            results.unstable.push({ name: target.name, ratio: delta.ratio })
            console.log(`  ✖ ${target.name}  两次差异 ${(delta.ratio * 100).toFixed(2)}%（不确定）`)
          } else {
            console.log(`  ✅ ${target.name}  稳定 ${(delta.ratio * 100).toFixed(3)}%`)
          }
          continue
        }

        if (args.update) {
          writeFileSync(path.join(baselineDir, `${target.name}.png`), png)
          results.written.push(target.name)
          const note = content.blank ? '  ⚠ 内容区纯色，该基线无回归覆盖' : ''
          console.log(`  ${content.blank ? '○' : '✅'} 写入基线 ${target.name}.png（${(png.length / 1024).toFixed(1)} KB）${note}`)
          continue
        }

        const baselinePath = path.join(baselineDir, `${target.name}.png`)
        if (!existsSync(baselinePath)) {
          results.missing.push(target.name)
          console.log(`  ○  缺基线 ${target.name}（跳过，先跑 --update）`)
          continue
        }

        const before = decodePng(readFileSync(baselinePath))
        const after = shot
        const diff = diffImages(before, after, { tolerance: settings.tolerance })

        if (diff.ratio > settings.threshold) {
          results.failed.push({ name: target.name, diff })
          writeFileSync(path.join(CURRENT_DIR, `${target.name}.png`), png)
          if (diff.diff) {
            writeFileSync(path.join(CURRENT_DIR, 'diff', `${target.name}.png`), encodePng(diff.diff))
          }
          const where = diff.sizeMismatch
            ? `尺寸变化 ${before.width}x${before.height} → ${after.width}x${after.height}`
            : `变化 ${(diff.ratio * 100).toFixed(2)}% · 区域 ${diff.bbox.x},${diff.bbox.y} ${diff.bbox.width}x${diff.bbox.height}`
          console.log(`  ✖ ${target.name}  ${where}`)
        } else {
          results.passed.push(target.name)
          console.log(`  ✅ ${target.name}  ${(diff.ratio * 100).toFixed(3)}%`)
        }
      } catch (err) {
        results.errors.push({ name: target.name, message: err.message })
        console.log(`  ⚠ ${target.name}  截图失败：${err.message}`)
      }
    }
  } finally {
    cdp.close()
    close()
    if (server) await server.close()
  }

  console.log('')
  console.log(`浏览器：${chromePath}`)

  if (args.stability) {
    const stable = targets.length - results.unstable.length - results.errors.length
    console.log(`稳定 ${stable} · 不确定 ${results.unstable.length} · 截图失败 ${results.errors.length}`)
    if (results.unstable.length) {
      console.log('')
      console.log('不确定的组件每次都会误报，不能做视觉回归。写进 visual/targets.json 的 exclude 并注明理由：')
      for (const u of results.unstable) {
        console.log(`  { "name": "${u.name}", "reason": "…" }   // 两次差异 ${(u.ratio * 100).toFixed(2)}%`)
      }
      process.exit(1)
    }
    if (results.errors.length) process.exit(1)
    return
  }

  const blankNote = results.blank.length
    ? [
        '',
        `⚠ ${results.blank.length} 个组件的内容区是纯色，基线**无回归覆盖**：`,
        `  ${results.blank.join(', ')}`,
        '  原因通常是：浮层需点击才出现 / 子组件需父级 / 没有手工演示只走了兜底页。',
        '  这些基线不会误报，但也拦不住回归——要覆盖就得给它们写一个静态可渲染的演示。'
      ].join('\n')
    : ''

  if (args.update) {
    console.log(`写入 ${results.written.length} 张基线，失败 ${results.errors.length} 个。`)
    if (blankNote) console.log(blankNote)
    if (results.errors.length) process.exit(1)
    return
  }

  console.log(
    `通过 ${results.passed.length} · 失败 ${results.failed.length} · ` +
      `缺基线 ${results.missing.length} · 截图失败 ${results.errors.length}`
  )
  if (blankNote) console.log(blankNote)

  if (results.failed.length) {
    console.log('')
    console.log('差异图（红=变化像素）：')
    for (const f of results.failed) console.log(`  visual/current/diff/${f.name}.png`)
    process.exit(1)
  }

  if (results.missing.length === targets.length) {
    console.log('')
    console.log(`当前平台（${platform}）没有任何基线，无法判断回归。`)
    console.log('这是「跳过」而不是「通过」：先运行 --update 生成基线并提交。')
    return
  }

  if (results.errors.length) process.exit(1)
}

main().catch((err) => {
  console.error(`✖ ${err.message}`)
  process.exit(1)
})
