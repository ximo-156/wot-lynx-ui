#!/usr/bin/env node
/**
 * check-exports.mjs — 校验 `packages/ui/package.json` 的 exports 声明与实际文件一致。
 *
 * ## 为什么需要它
 *
 * 2026-10 体检发现：`exports` 声明了 `"import": "./dist/index.mjs"` /
 * `"types": "./dist/index.d.ts"`，但 `packages/ui/dist/` **从未产出**。
 * 这是「声明了但没兑现」的契约缺陷 —— 源码分发（`source` 条件）下一切正常，
 * 一旦消费者是不支持 `source` 条件的构建器（纯 Vite / webpack / CI 静态分析），
 * 就会在 `import` 时直接报模块找不到。
 *
 * 本脚本把「声明与产物」的一致性交给机器：
 *   - `source` / `plugin` / `package.json` 等**源码分发必需**的目标，默认必检；
 *   - `import` / `types` 等**预构建产物**，仅在 `--built` 下校验（需先执行 pnpm build）。
 *
 * ## 用法
 *
 *   node scripts/check-exports.mjs           # CI 常规门禁：只校验源码侧目标
 *   node scripts/check-exports.mjs --built   # 发布前：额外校验 dist 产物
 *
 * 退出码：0 = 一致；1 = 存在悬空声明或缺失目标。
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, dirname, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import process from 'node:process'

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..')
const PKG_DIR = join(ROOT, 'packages/ui')
const PKG_PATH = join(PKG_DIR, 'package.json')

/** 预构建产物条件：只在 --built 下要求存在 */
const BUILT_CONDITIONS = new Set(['import', 'require', 'types', 'default', 'node', 'browser'])
/** 源码条件：永远要求存在 */
const SOURCE_CONDITIONS = new Set(['source'])

const builtMode = process.argv.includes('--built')

const pkg = JSON.parse(readFileSync(PKG_PATH, 'utf8'))
const problems = []
const checked = []

/**
 * 展开 exports 条目为扁平列表。本仓库的 exports 均为单层条件对象，
 * 故只处理一层；若将来出现嵌套条件，需在此递归。
 */
function flattenExports(exportsField) {
  const out = []
  for (const [subpath, entry] of Object.entries(exportsField || {})) {
    if (typeof entry === 'string') {
      out.push({ subpath, condition: null, target: entry })
      continue
    }
    for (const [condition, target] of Object.entries(entry || {})) {
      if (typeof target === 'string') out.push({ subpath, condition, target })
    }
  }
  return out
}

/**
 * 通配符目标（`./src/components/*`）无法逐文件校验，退化为：
 * 校验其**静态前缀目录**存在，且该目录下至少有一个条目。
 */
function checkTarget(target, { subpath, condition }) {
  if (target.includes('*')) {
    const staticPrefix = target.slice(0, target.indexOf('*'))
    const dir = join(PKG_DIR, staticPrefix.replace(/\/$/, ''))
    if (!existsSync(dir)) {
      problems.push(
        `${subpath} [${condition ?? 'default'}] → ${target}\n` +
          `     通配符前缀目录不存在：${relative(ROOT, dir)}`
      )
      return
    }
    const entries = readdirSync(dir).filter((n) => !n.startsWith('.'))
    if (entries.length === 0) {
      problems.push(`${subpath} [${condition ?? 'default'}] → ${target}\n     通配符前缀目录为空：${relative(ROOT, dir)}`)
      return
    }
    checked.push(`${subpath} [${condition ?? 'default'}] → ${target}（前缀目录 ${entries.length} 项）`)
    return
  }

  const abs = join(PKG_DIR, target)
  if (!existsSync(abs)) {
    problems.push(
      `${subpath} [${condition ?? 'default'}] → ${target}\n` +
        `     目标不存在：${relative(ROOT, abs)}`
    )
    return
  }
  if (statSync(abs).isDirectory()) {
    problems.push(`${subpath} [${condition ?? 'default'}] → ${target}\n     目标是目录而非文件`)
    return
  }
  checked.push(`${subpath} [${condition ?? 'default'}] → ${target}`)
}

// ---------------------------------------------------------------------------
// 模块解析工具
// ---------------------------------------------------------------------------
/**
 * 打包器补全候选扩展名。顺序影响「同名多文件」时的取值，按源码约定排列。
 * `.d.ts` 必须在 `.ts` 之后：`types.d.ts` 与 `types.ts` 并存时应优先 `.ts`。
 */
const RESOLVE_EXTS = ['.ts', '.tsx', '.mts', '.js', '.mjs', '.cjs', '.d.ts', '.vue', '.json', '.css', '.scss']

/**
 * 按**打包器语义**解析说明符：允许省略扩展名，允许目录 → `index.*`。
 *
 * 为什么不能用裸 `existsSync`：`dist/**\/index.d.ts` 里写的是
 * `export * from '../../../src/wd-x/types'`（无扩展名）。这是 `.d.ts` 的
 * 正确写法 —— 带上 `.ts` 会触发 TS5097（需 allowImportingTsExtensions）。
 * 裸 `existsSync` 会把它判成失效，107 个组件全部误报。
 *
 * @returns {string|null} 命中的文件绝对路径
 */
function resolveBundlerStyle(absBase) {
  if (existsSync(absBase) && statSync(absBase).isFile()) return absBase
  for (const ext of RESOLVE_EXTS) {
    const candidate = absBase + ext
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate
  }
  if (existsSync(absBase) && statSync(absBase).isDirectory()) {
    for (const ext of RESOLVE_EXTS) {
      const candidate = join(absBase, `index${ext}`)
      if (existsSync(candidate) && statSync(candidate).isFile()) return candidate
    }
  }
  return null
}


// ---------------------------------------------------------------------------
// 1. exports 字段
// ---------------------------------------------------------------------------
if (!pkg.exports) {
  problems.push('package.json 缺少 exports 字段')
} else {
  for (const item of flattenExports(pkg.exports)) {
    const isBuilt = item.condition !== null && BUILT_CONDITIONS.has(item.condition)
    const isSource = item.condition === null || SOURCE_CONDITIONS.has(item.condition)

    if (isBuilt && !builtMode) {
      // 未构建时只提示，不判失败 —— dist 是构建产物，不应入库
      continue
    }
    if (!isSource && !isBuilt) {
      // 未知条件（如自定义 "deno"）：按源码侧宽松校验
      checkTarget(item.target, item)
      continue
    }
    checkTarget(item.target, item)
  }
}

// ---------------------------------------------------------------------------
// 2. 顶层入口字段（main / module / types）
// ---------------------------------------------------------------------------
for (const field of ['main', 'module', 'types']) {
  const value = pkg[field]
  if (!value) continue
  const abs = join(PKG_DIR, value)
  if (!existsSync(abs)) {
    problems.push(`package.json "${field}" → ${value}\n     目标不存在：${relative(ROOT, abs)}`)
  } else {
    checked.push(`"${field}" → ${value}`)
  }
}

// ---------------------------------------------------------------------------
// 3. files 白名单覆盖性（发布时会漏文件）
//
// 判据不是「exports 子路径名 == files 条目」（`./theme` 的目标其实是
// `src/styles/theme/*`，由 files 里的 `src` 覆盖），而是「每个 target 的静态
// 前缀是否落在某个 files 条目之内」。
// ---------------------------------------------------------------------------
const files = pkg.files
if (Array.isArray(files) && pkg.exports) {
  /** files 条目 → 归一化前缀（去掉前导 ./ 与尾部 /） */
  const prefixes = files
    .filter((f) => typeof f === 'string')
    .map((f) => f.replace(/^\.\//, '').replace(/\/$/, ''))
    .filter((f) => f && !f.includes('*'))

  const isCovered = (target) => {
    const staticPart = target.includes('*') ? target.slice(0, target.indexOf('*')) : target
    const normalized = staticPart.replace(/^\.\//, '')
    return prefixes.some((p) => normalized === p || normalized.startsWith(`${p}/`))
  }

  for (const item of flattenExports(pkg.exports)) {
    // npm 强制包含 package.json / README / LICENSE，不受 files 约束
    if (/(?:^|\/)package\.json$/.test(item.target)) continue
    const isBuilt = item.condition !== null && BUILT_CONDITIONS.has(item.condition)
    // 未构建时跳过 dist 目标（它们尚未生成，也无从判断覆盖性）
    if (isBuilt && !builtMode) continue
    if (isCovered(item.target)) continue
    problems.push(
      `exports "${item.subpath}" [${item.condition ?? 'default'}] 的目标 ${item.target}\n` +
        `     不在 files 白名单内（files: ${files.join(', ')}）—— 发布后该入口会 404`
    )
  }
}

// ---------------------------------------------------------------------------
// 4. dist 桥接文件的自洽性（仅 --built）
//
// `dist/` 不是编译产物，而是**入口桥接层**：每个 `dist/<root>/<comp>/index.mjs`
// 只有一行 `export { default } from '../../../src/<root>/<comp>/<comp>.vue'`。
// 它的价值仅是「让 `wot-lynx-ui/primitives/wd-x` 这个子路径可解析」——
// 组件目录里没有 index.ts，所以必须有这么一个文件。
//
// 桥接层的失效是**静默**的：组件一旦从 components/ 迁到 primitives/（本仓库
// 2026-10-23 就做过一次），旧路径的 shim 会指向不存在的文件。
// 而「文件存在」校验照样通过——只有消费方真正 import 时才炸。
// 因此这里额外解析每个桥接文件的 from 目标，断言其存在。
// ---------------------------------------------------------------------------
if (builtMode) {
  const DIST = join(PKG_DIR, 'dist')
  if (existsSync(DIST)) {
    const walk = (dir) => {
      const out = []
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry)
        if (statSync(full).isDirectory()) out.push(...walk(full))
        else if (/\.(mjs|js|d\.ts)$/.test(entry)) out.push(full)
      }
      return out
    }
    const bridgeFiles = walk(DIST)
    const FROM_RE = /(?:from|export\s+\*\s+from)\s+['"]([^'"]+)['"]/g
    let bridgeChecked = 0
    for (const file of bridgeFiles) {
      const code = readFileSync(file, 'utf8')
      FROM_RE.lastIndex = 0
      let m
      while ((m = FROM_RE.exec(code)) !== null) {
        const spec = m[1]
        if (!spec.startsWith('.')) continue // 裸包名（vue-lynx 等）不在本脚本职责内
        const resolved = resolveBundlerStyle(join(dirname(file), spec))
        if (!resolved) {
          problems.push(
            `dist 桥接失效：${relative(ROOT, file)}\n` +
              `     re-export 目标不存在：${spec}\n` +
              `     说明组件已迁移/改名但 dist 未重新生成（运行 pnpm build:ui）`
          )
        } else {
          bridgeChecked++
        }
      }
    }
    if (bridgeChecked > 0) checked.push(`dist 桥接自洽（${bridgeChecked} 条 re-export）`)
  }
}

// ---------------------------------------------------------------------------
// 5. exports 子路径的真实可解析性
//
// 第 1 节只验「通配符前缀目录非空」，验不出**代入真实条目名之后**能不能落地。
// 2026-10-23 体检发现的实际缺陷：`"./components/*": {"source": "./src/components/*"}`
// 代入 `wd-action-sheet` 得到 `./src/components/wd-action-sheet` —— 一个**目录**，
// 而该目录里没有 `index.ts`。Rspeedy 走 source 条件时会直接
// `ERR_UNSUPPORTED_DIR_IMPORT`，即本库的**主分发路径**是坏的。
//
// 更隐蔽的是 `import.meta.resolve()` 对目录也返回成功（它不检查目标是否为文件），
// 所以「解析一下看看」这种手工验证同样抓不到。
//
// 本节按 Node 的 exports 语义（目标必须精确落到文件）逐条代入真实条目名断言。
// ---------------------------------------------------------------------------
if (pkg.exports) {
  /**
   * 从目标静态前缀目录取出可代入 `*` 的真实条目名。
   *
   * 通配符有两种角色，必须区分，否则会静默跳过一类目标：
   *   - **路径段**：`*` 后面紧跟斜杠（或位于末尾）。如 `./src/components/<段>/<文件>`
   *     里的 `*` 是目录名 → 枚举**子目录**。
   *   - **文件名**：`*` 后面是后缀（`.scss` / `.css`）。如
   *     `./src/styles/theme/presets/<主干>.scss` 的 `*` 是文件名主干 →
   *     枚举**同后缀文件**并剥掉后缀。
   *
   * 只枚举目录的旧实现在遇到 `*.scss` 时得到空列表 → 整条目标不校验，
   * 等于留了一个没人看守的入口。
   */
  function sampleNames(target) {
    const firstStar = target.indexOf('*')
    const staticPrefix = target.slice(0, firstStar)
    const afterStar = target.slice(firstStar + 1)
    const dir = join(PKG_DIR, staticPrefix)
    if (!existsSync(dir) || !statSync(dir).isDirectory()) return []

    const entries = readdirSync(dir).filter((n) => !n.startsWith('.'))

    if (afterStar.startsWith('/') || afterStar === '') {
      // 路径段通配 → 子目录名
      return entries.filter((n) => statSync(join(dir, n)).isDirectory())
    }

    // 文件名通配 → 同后缀文件，返回不含后缀的主干
    return entries
      .filter((n) => n.endsWith(afterStar))
      .filter((n) => statSync(join(dir, n)).isFile())
      .map((n) => n.slice(0, -afterStar.length))
      .filter(Boolean)
  }

  let subpathChecked = 0
  /** subpath → condition → 条目名集合，供跨条件比对 */
  const namesBySubpath = new Map()

  for (const item of flattenExports(pkg.exports)) {
    const isBuilt = item.condition !== null && BUILT_CONDITIONS.has(item.condition)
    if (isBuilt && !builtMode) continue

    const label = `${item.subpath} [${item.condition ?? 'default'}] → ${item.target}`

    if (!item.target.includes('*')) {
      // 静态目标已在第 1 节验过存在性；这里只补「必须是文件」
      const abs = join(PKG_DIR, item.target)
      if (existsSync(abs) && statSync(abs).isDirectory()) {
        problems.push(
          `${label}\n` +
            `     解析到目录而非文件：${relative(ROOT, abs)}\n` +
            `     Node 会抛 ERR_UNSUPPORTED_DIR_IMPORT（exports 目标必须精确到文件）`
        )
      }
      continue
    }

    const names = sampleNames(item.target)
    if (names.length === 0) continue // 前缀目录缺失/为空已由第 1 节报告

    if (!namesBySubpath.has(item.subpath)) namesBySubpath.set(item.subpath, new Map())
    namesBySubpath.get(item.subpath).set(item.condition ?? 'default', new Set(names))

    const broken = []
    for (const name of names) {
      // Node 的 PACKAGE_TARGET_RESOLVE 对目标做 `*` 全量替换（/\*/g），
      // 所以 `./src/components/*/*.vue` 代入 wd-button 会得到
      // `./src/components/wd-button/wd-button.vue` —— 目录段与文件名段同时代入。
      // 只替换第一个会误判为「不存在」。
      const concrete = item.target.replaceAll('*', name)
      const abs = join(PKG_DIR, concrete)
      if (!existsSync(abs)) {
        broken.push({ name, reason: '不存在' })
      } else if (statSync(abs).isDirectory()) {
        broken.push({ name, reason: '是目录' })
      }
    }
    if (broken.length) {
      const sample = broken.slice(0, 3).map((b) => `${b.name}（${b.reason}）`).join('、')
      problems.push(
        `${label}\n` +
          `     ${broken.length}/${names.length} 个条目代入后无法解析：${sample}${broken.length > 3 ? ' …' : ''}\n` +
          `     提示：通配符目标必须落到**文件**。若指向组件目录，该目录需要 index.ts，` +
          `或把目标写成 \`./src/<root>/*/*.vue\``
      )
    } else {
      subpathChecked += names.length
    }
  }

  // -------------------------------------------------------------------------
  // 5b. 跨条件的条目集合一致性（仅 --built）
  //
  // 5 是**枚举式**检查：只验「存在的条目能否解析」。它验不出**集合完整性** ——
  // 新增 `presets/compact.scss` 却忘了加进 `build-css.mjs` 的入口清单时，
  // 枚举不到 `compact.css`，两边都「没报错」，而消费者的
  // `import 'wot-lynx-ui/theme/presets/compact'` 直接 404。
  //
  // 这条缺陷是负向验证时发现的：删掉 `compact.scss` 后 5 依然全绿。
  // 因此这里把 source 侧与 import 侧的条目集合对起来比：
  //   - source 有、import 没有 → 漏构建 / 漏进入口清单
  //   - import 有、source 没有 → 构建产物残留（迁移改名后未清理）
  // -------------------------------------------------------------------------
  if (builtMode) {
    for (const [subpath, byCondition] of namesBySubpath) {
      const sourceNames = byCondition.get('source')
      if (!sourceNames) continue
      for (const [condition, names] of byCondition) {
        if (condition === 'source' || !BUILT_CONDITIONS.has(condition)) continue
        const missing = [...sourceNames].filter((n) => !names.has(n))
        const extra = [...names].filter((n) => !sourceNames.has(n))
        const preview = (list) => list.slice(0, 5).join('、') + (list.length > 5 ? ' …' : '')

        if (missing.length) {
          problems.push(
            `${subpath} [${condition}] 缺少 source 侧存在的条目：${preview(missing)}\n` +
              `     source 侧 ${sourceNames.size} 项，${condition} 侧 ${names.size} 项\n` +
              `     常见原因：新增文件后未重新构建（pnpm build:ui），或未加进构建脚本的入口清单`
          )
        }
        if (extra.length) {
          problems.push(
            `${subpath} [${condition}] 存在 source 侧没有的条目：${preview(extra)}\n` +
              `     source 侧 ${sourceNames.size} 项，${condition} 侧 ${names.size} 项\n` +
              `     多为构建产物残留（迁移/改名后未清理）`
          )
        }
      }
    }
  }

  if (subpathChecked > 0) checked.push(`exports 子路径可解析（${subpathChecked} 个条目代入验证）`)
}

// ---------------------------------------------------------------------------
// 报告
// ---------------------------------------------------------------------------
if (problems.length) {
  console.error(`✖ exports 声明与实际不一致（${problems.length} 处）：\n`)
  for (const p of problems) console.error(`   - ${p}\n`)
  if (!builtMode) {
    console.error('   提示：预构建产物（import / types）需在发布前用 `node scripts/check-exports.mjs --built` 校验。')
  }
  process.exit(1)
}

const scope = builtMode ? '源码 + 预构建产物' : '源码侧'
console.log(`✅ exports 声明一致（${scope}，共校验 ${checked.length} 项）`)
