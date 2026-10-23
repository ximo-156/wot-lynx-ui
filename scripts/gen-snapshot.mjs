#!/usr/bin/env node
/**
 * gen-snapshot.mjs — 生成架构快照，并在 CI 中断言「文档数字 == 代码事实」。
 *
 * ## 为什么需要它
 *
 * `ARCHITECTURE.md` v1.0 是**手写的快照**。仓库在 2026-10-16 至 10-21 之间发生两次
 * 全库级重写（`a00b6b9`、`7658d0c`），文档里的 6 处断言随之失效——其中
 * 「零 MTS」一条会直接误导实现（详见 `docs/adr/009-zero-mts.md`）。
 *
 * 结论：**文档一致性是机器问题，不是自觉问题。** 凡是可以数出来的事实，都由本脚本
 * 产出到 `docs/architecture/SNAPSHOT.md`，CI 用 `--check` 拦住漂移。
 *
 * ## 用法
 *
 *   node scripts/gen-snapshot.mjs           # 写入快照
 *   node scripts/gen-snapshot.mjs --check   # CI：与仓库内快照比对，不一致即失败
 */
import { readdirSync, readFileSync, writeFileSync, existsSync, statSync, mkdirSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import process from 'node:process'

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..')
const UI_SRC = join(ROOT, 'packages/ui/src')
const OUT_DIR = join(ROOT, 'docs/architecture')
const OUT_PATH = join(OUT_DIR, 'SNAPSHOT.md')
const DEPS_BASELINE = join(OUT_DIR, 'deps-baseline.json')

const checkOnly = process.argv.includes('--check')

// ---------------------------------------------------------------------------
// 采集
// ---------------------------------------------------------------------------

function listDirs(dir, filter = () => true) {
  if (!existsSync(dir)) return []
  return readdirSync(dir).filter((n) => {
    const full = join(dir, n)
    return statSync(full).isDirectory() && filter(n)
  })
}

function countLinesIn(dir, exts) {
  const acc = {}
  for (const ext of exts) acc[ext] = 0
  const walk = (d) => {
    for (const entry of readdirSync(d)) {
      const full = join(d, entry)
      const st = statSync(full)
      if (st.isDirectory()) walk(full)
      else {
        const ext = exts.find((e) => entry.endsWith(e))
        if (!ext) continue
        const content = readFileSync(full, 'utf8')
        // 与 `wc -l` 语义对齐：末尾换行不计为额外一行
        acc[ext] += content === '' ? 0 : content.replace(/\r?\n$/, '').split(/\r?\n/).length
      }
    }
  }
  if (existsSync(dir)) walk(dir)
  return acc
}

/** 只统计组件目录（wd-*）内的源码，排除生成 barrel 与遗留目录 */
function countComponentLines(rootDir, dirs) {
  const acc = { '.vue': 0, '.ts': 0, '.scss': 0 }
  for (const dir of dirs) {
    const got = countLinesIn(join(rootDir, dir), ['.vue', '.ts', '.scss'])
    acc['.vue'] += got['.vue']
    acc['.ts'] += got['.ts']
    acc['.scss'] += got['.scss']
  }
  return acc
}

function countFiles(dir, pattern) {
  if (!existsSync(dir)) return 0
  let n = 0
  const walk = (d) => {
    for (const entry of readdirSync(d)) {
      const full = join(d, entry)
      if (statSync(full).isDirectory()) walk(full)
      else if (pattern.test(entry)) n++
    }
  }
  walk(dir)
  return n
}

const CORE = join(UI_SRC, 'primitives')
const BUSINESS = join(UI_SRC, 'components')

const coreComponents = listDirs(CORE, (n) => /^wd-/.test(n))
const businessComponents = listDirs(BUSINESS, (n) => /^wd-/.test(n))
const strayDirs = listDirs(BUSINESS, (n) => !/^wd-/.test(n) && n !== 'node_modules')

const coreLines = countComponentLines(CORE, coreComponents)
const businessLines = countComponentLines(BUSINESS, businessComponents)

const composables = countFiles(join(UI_SRC, 'composables'), /\.ts$/)
const commonModules = countFiles(join(UI_SRC, 'common'), /\.(ts|vue)$/)
const locales = countFiles(join(UI_SRC, 'locale'), /\.ts$/)
const presets = countFiles(join(UI_SRC, 'styles/theme/presets'), /\.scss$/)
const testFiles = countFiles(join(ROOT, 'packages/ui/test'), /\.test\.ts$/)

/** lint 规则数：review-lint.mjs 中 `id: '...'` 出现次数 */
let lintRules = 0
try {
  const lintSrc = readFileSync(join(ROOT, 'scripts/review-lint.mjs'), 'utf8')
  lintRules = (lintSrc.match(/^\s*id:\s*'/gm) || []).length
} catch {
  lintRules = 0
}

/** 声明式 MTS 使用面：组件目录中包含 main-thread-bind* / useMainThreadRef 的文件数 */
let mtsComponents = 0
for (const dir of [...coreComponents, ...businessComponents]) {
  const base = join(CORE, dir)
  const root = existsSync(base) ? CORE : BUSINESS
  const target = join(root, dir)
  if (countFiles(target, /\.vue$/) === 0) continue
  let hit = false
  const walk = (d) => {
    for (const entry of readdirSync(d)) {
      const full = join(d, entry)
      if (statSync(full).isDirectory()) walk(full)
      else if (/\.(vue|ts)$/.test(entry)) {
        const src = readFileSync(full, 'utf8')
        if (/main-thread-bind|useMainThreadRef|'main thread'/.test(src)) hit = true
      }
    }
  }
  walk(target)
  if (hit) mtsComponents++
}

/** 依赖图指标：读 analyze-deps 产出的基线，避免重复扫描 */
let deps = null
if (existsSync(DEPS_BASELINE)) {
  try {
    deps = JSON.parse(readFileSync(DEPS_BASELINE, 'utf8')).metrics
  } catch {
    deps = null
  }
}

// ---------------------------------------------------------------------------
// 渲染
// ---------------------------------------------------------------------------

const rows = []
rows.push('# 架构快照')
rows.push('')
rows.push('> ⚠️ 本文件由 `scripts/gen-snapshot.mjs` 自动生成，请勿手动编辑。')
rows.push('> CI 通过 `node scripts/gen-snapshot.mjs --check` 断言本文与代码一致。')
rows.push('>')
rows.push('> 为什么要有这个文件：`ARCHITECTURE.md` v1.0 是手写快照，在两次全库重写后漂移了 6 处，')
rows.push('> 其中「零 MTS」一条持续误导实现（见 `docs/adr/009-zero-mts.md`）。凡能数出来的事实，交给机器。')
rows.push('')
rows.push('## 组件')
rows.push('')
rows.push('| 项 | 数值 |')
rows.push('|---|---|')
rows.push(`| 基础件（L3.5 ` + '`src/primitives/`' + `） | ${coreComponents.length} |`)
rows.push(`| 业务组件（L4 ` + '`src/components/`' + `） | ${businessComponents.length} |`)
rows.push(`| **组件总数** | **${coreComponents.length + businessComponents.length}** |`)
rows.push('')
if (strayDirs.length) {
  rows.push(`> ⚠️ ` + '`src/components/`' + ` 下存在非 ` + '`wd-*`' + ` 目录：${strayDirs.map((d) => '`' + d + '`').join('、')}（建议清理）`)
  rows.push('')
}
rows.push('## 源码规模')
rows.push('')
rows.push('| 层 | .vue | .ts | .scss | 合计 |')
rows.push('|---|---|---|---|---|')
const coreTotal = coreLines['.vue'] + coreLines['.ts'] + coreLines['.scss']
const bizTotal = businessLines['.vue'] + businessLines['.ts'] + businessLines['.scss']
rows.push(`| 基础件 | ${coreLines['.vue']} | ${coreLines['.ts']} | ${coreLines['.scss']} | ${coreTotal} |`)
rows.push(`| 业务组件 | ${businessLines['.vue']} | ${businessLines['.ts']} | ${businessLines['.scss']} | ${bizTotal} |`)
rows.push(`| **合计** | **${coreLines['.vue'] + businessLines['.vue']}** | **${coreLines['.ts'] + businessLines['.ts']}** | **${coreLines['.scss'] + businessLines['.scss']}** | **${coreTotal + bizTotal}** |`)
rows.push('')
rows.push('## 基础能力')
rows.push('')
rows.push('| 项 | 数值 |')
rows.push('|---|---|')
rows.push(`| composables | ${composables} |`)
rows.push(`| common 模块 | ${commonModules} |`)
rows.push(`| 语言包 | ${locales} |`)
rows.push(`| 预设主题文件 | ${presets} |`)
rows.push(`| 测试文件 | ${testFiles} |`)
rows.push(`| lint 规则 | ${lintRules} |`)
rows.push(`| 使用声明式 MTS 的组件 | ${mtsComponents} |`)
rows.push('')
rows.push('## 横向依赖')
rows.push('')
if (deps) {
  rows.push('| 指标 | 数值 | 目标 |')
  rows.push('|---|---|---|')
  rows.push(`| 去重依赖边 | ${deps.edges} | — |`)
  rows.push(`| 业务 → 基础件 | ${deps.businessToCore} | ↑ |`)
  rows.push(`| 业务 ↔ 业务 | ${deps.businessToBusiness} | ≤ 60（拆包 ≤ 30） |`)
  rows.push(`| 契约借用 | ${deps.contractBorrow} | 0 |`)
  // 环的判据是「族内允许、跨族禁止」（ADR-012）：父子组件对是原子单元，
  // 其 provide/inject 互引不是缺陷。把两个数混为一个「循环依赖」会误导决策。
  rows.push(`| **跨族循环依赖** | **${deps.cyclesCrossFamily}** | **0** |`)
  rows.push(`| 族内环（父子组件对） | ${deps.cycles} | 允许 |`)
  rows.push(`| 组件族 | ${deps.families} | — |`)
  rows.push(`| 基础件反向依赖 | ${deps.coreToBusiness} | 0 |`)
} else {
  rows.push('尚未生成依赖基线，请先运行 `node scripts/analyze-deps.mjs`。')
}
rows.push('')
rows.push('## 生成物与契约')
rows.push('')
const artifacts = [
  ['`src/index.ts`', join(UI_SRC, 'index.ts'), true],
  ['`src/components/index.ts`（生成）', join(BUSINESS, 'index.ts'), true],
  ['`src/primitives/index.ts`（生成）', join(CORE, 'index.ts'), false],
  ['`docs/adr/`', join(ROOT, 'docs/adr'), false],
  ['`dist/`（构建产物，不入库）', join(ROOT, 'packages/ui/dist'), false]
]
rows.push('| 路径 | 状态 |')
rows.push('|---|---|')
for (const [label, path, required] of artifacts) {
  const exists = existsSync(path)
  rows.push(`| ${label} | ${exists ? '✅ 存在' : required ? '❌ 缺失' : '— 未生成'} |`)
}
rows.push('')
rows.push('## 复现方式')
rows.push('')
rows.push('```bash')
rows.push('node scripts/analyze-deps.mjs        # 依赖图 → DEPS.md + deps-baseline.json')
rows.push('node scripts/gen-snapshot.mjs        # 本文件')
rows.push('node scripts/check-exports.mjs       # exports 声明 vs 实际')
rows.push('```')

const next = `${rows.join('\n')}\n`

// ---------------------------------------------------------------------------
// 写入 / 校验
// ---------------------------------------------------------------------------

mkdirSync(OUT_DIR, { recursive: true })
const current = existsSync(OUT_PATH) ? readFileSync(OUT_PATH, 'utf8') : null

if (checkOnly) {
  if (current === next) {
    console.log(`✅ ${relative(ROOT, OUT_PATH)} 与代码一致`)
    process.exit(0)
  }
  console.error(`✖ ${relative(ROOT, OUT_PATH)} 与代码不一致（架构快照已漂移）`)
  console.error('  运行 node scripts/gen-snapshot.mjs 重新生成后提交。')
  process.exit(1)
}

if (current === next) {
  console.log(`ℹ️  ${relative(ROOT, OUT_PATH)} 已是最新`)
  process.exit(0)
}

writeFileSync(OUT_PATH, next)
console.log(`✅ 已生成 ${relative(ROOT, OUT_PATH)}`)
console.log(`   组件 ${coreComponents.length + businessComponents.length}（core ${coreComponents.length} / business ${businessComponents.length}）`)
