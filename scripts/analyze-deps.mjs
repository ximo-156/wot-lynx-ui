#!/usr/bin/env node
/**
 * analyze-deps.mjs — 组件横向依赖图分析（fan-in / fan-out / 环 / 边分类）。
 *
 * ## 为什么需要它
 *
 * `ARCHITECTURE.md` v1.0 曾规定「组件之间不得互相 import 实现」，但该禁令
 * **从未生效**（2026-10-22 实测 153 条边）且**没有守护**。更关键的是它方向错了：
 * 组件组合复用是刚需（132 条 `.vue` 引用），真正有害的是**契约借用**
 * （64 条：42 条 `import type` + 22 条值导入 `types` 内的 KEY 常量）——
 * 后者是 5 个循环依赖与「拆域包不可行」的唯一成因。
 *
 * 本脚本把「横向耦合」变成可度量、可断言的数字（ADR-012）。
 *
 * ## 判据
 *
 * - `core`（L3.5，`src/primitives/`）：可被业务组件依赖；**禁止**依赖业务组件、禁止 core 之间互引。
 * - `business`（L4，`src/components/`）：可依赖 core；**禁止**依赖其他 business。
 *
 * ## 用法
 *
 *   node scripts/analyze-deps.mjs            # 生成 docs/architecture/DEPS.md + 基线
 *   node scripts/analyze-deps.mjs --check    # CI：与基线比较，边数增加即失败
 *   node scripts/analyze-deps.mjs --json     # 只输出 JSON（供其他脚本消费）
 *
 * ## 退出码
 *
 *   0 = 通过；1 = 存在违规（环 / core 纯度 / 边数增长）
 */
import { readdirSync, readFileSync, writeFileSync, existsSync, mkdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import process from 'node:process'

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..')
const UI_SRC = join(ROOT, 'packages/ui/src')
const CORE_DIR = join(UI_SRC, 'primitives')
const BUSINESS_DIR = join(UI_SRC, 'components')
const OUT_DIR = join(ROOT, 'docs/architecture')
const BASELINE_PATH = join(OUT_DIR, 'deps-baseline.json')
const REPORT_PATH = join(OUT_DIR, 'DEPS.md')

const checkMode = process.argv.includes('--check')
const jsonMode = process.argv.includes('--json')

// ---------------------------------------------------------------------------
// 收集组件（core + business）
// ---------------------------------------------------------------------------

/** 目录名 → 层级。目录不存在时返回空。 */
function listComponents(dir, layer) {
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter((name) => /^wd-/.test(name) && statSync(join(dir, name)).isDirectory())
    .map((name) => ({ name, layer, dir: join(dir, name) }))
}

const components = [
  ...listComponents(CORE_DIR, 'core'),
  ...listComponents(BUSINESS_DIR, 'business')
]
const byName = new Map(components.map((c) => [c.name, c]))
const coreNames = new Set(components.filter((c) => c.layer === 'core').map((c) => c.name))

// ---------------------------------------------------------------------------
// 解析 import
// ---------------------------------------------------------------------------

/**
 * 解析指向其他组件的相对 import。必须同时覆盖三种写法：
 *   ../wd-icon/wd-icon.vue                     同层兄弟（core→core 或 business→business）
 *   ../../primitives/wd-icon/wd-icon.vue       业务 → 基础件（L4 → L3.5）
 *   ../../../wd-icon/types                     嵌套目录里的同层兄弟
 *
 * 因此不按「前缀」匹配，而是先取 import 说明符，再从里面抽 `wd-xxx` 段，
 * 层级由组件名反查（byName），与路径写法解耦。
 */
const SPECIFIER_RE = /(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g
const WD_SEGMENT_RE = /(?:^|\/)(wd-[a-z0-9-]+)\//
const IMPORT_TYPE_RE = /^\s*(?:import|export)\s+type\b/

function walkFiles(dir) {
  const out = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    const st = statSync(full)
    if (st.isDirectory()) out.push(...walkFiles(full))
    else if (/\.(vue|ts)$/.test(entry)) out.push(full)
  }
  return out
}

function classify(pathInTarget, lineText) {
  if (IMPORT_TYPE_RE.test(lineText)) return 'type-contract'
  if (pathInTarget.endsWith('.vue')) return 'compose'
  if (/(^|\/)utils$/.test(pathInTarget)) return 'util-borrow'
  return 'other'
}

/** edges: [{ from, to, kind, file, line }] */
const edges = []
const unresolved = []

for (const comp of components) {
  for (const file of walkFiles(comp.dir)) {
    const lines = readFileSync(file, 'utf8').split(/\r?\n/)
    lines.forEach((lineText, idx) => {
      SPECIFIER_RE.lastIndex = 0
      let m
      while ((m = SPECIFIER_RE.exec(lineText)) !== null) {
        const spec = m[1]
        // 只处理相对路径；包名导入（wot-lynx-ui）不构成组件间耦合
        if (!spec.startsWith('.')) continue
        const seg = spec.match(WD_SEGMENT_RE)
        if (!seg) continue
        const target = seg[1]
        if (target === comp.name) continue
        if (!byName.has(target)) {
          unresolved.push({ from: comp.name, target, file: relative(ROOT, file), line: idx + 1 })
          continue
        }
        const pathInTarget = spec.slice(spec.indexOf(target) + target.length + 1)
        edges.push({
          from: comp.name,
          to: target,
          kind: classify(pathInTarget, lineText),
          file: relative(ROOT, file),
          line: idx + 1
        })
      }
    })
  }
}

// 去重成「组件级」边（同一对组件可能多处引用）
const pairMap = new Map()
for (const e of edges) {
  const key = `${e.from}->${e.to}`
  if (!pairMap.has(key)) pairMap.set(key, { from: e.from, to: e.to, kinds: new Set(), refs: [] })
  const pair = pairMap.get(key)
  pair.kinds.add(e.kind)
  pair.refs.push(e)
}
const pairs = [...pairMap.values()]

// ---------------------------------------------------------------------------
// 统计
// ---------------------------------------------------------------------------

const kindCount = {}
for (const e of edges) kindCount[e.kind] = (kindCount[e.kind] || 0) + 1

const fanIn = {}
const fanOut = {}
for (const p of pairs) {
  fanIn[p.to] = (fanIn[p.to] || 0) + 1
  fanOut[p.from] = (fanOut[p.from] || 0) + 1
}

/** 按层级归类边 */
const coreToBusiness = pairs.filter((p) => byName.get(p.from).layer === 'core' && byName.get(p.to).layer === 'business')
const coreToCore = pairs.filter((p) => byName.get(p.from).layer === 'core' && byName.get(p.to).layer === 'core')
const businessToCore = pairs.filter((p) => byName.get(p.from).layer === 'business' && byName.get(p.to).layer === 'core')
const businessToBusiness = pairs.filter(
  (p) => byName.get(p.from).layer === 'business' && byName.get(p.to).layer === 'business'
)

/**
 * 环检测（Tarjan 强连通分量）。
 *
 * 必须区分两种环：
 *   - **运行时环**：环上至少一条边是「值导入」（`.vue` 引用、KEY 常量等），
 *     打包器与模块加载器会真实踩到，必须为 0。
 *   - **类型级环**：环上所有边都是 `import type`，编译后完全擦除，运行时无影响。
 *     TS 能处理，但在跨包场景仍是 `.d.ts` 构建顺序的隐患，故只记录不阻断。
 *
 * 2026-10-22 实测：本库 5 个环全部是「父子组件对」内的类型级回边
 * （`wd-tab → wd-tabs/types` 是值导入，`wd-tabs/types` 无反向运行时依赖），
 * 因此不需要为它们做「KEY 下沉」式重构 —— 详见 ADR-012。
 */
function findCycles(pairsSubset) {
  let index = 0
  const stack = []
  const onStack = new Set()
  const indices = new Map()
  const low = new Map()
  const sccs = []

  const adj = new Map()
  for (const p of pairsSubset) {
    if (!adj.has(p.from)) adj.set(p.from, [])
    adj.get(p.from).push(p.to)
  }

  function strongConnect(v) {
    indices.set(v, index)
    low.set(v, index)
    index++
    stack.push(v)
    onStack.add(v)

    for (const w of adj.get(v) || []) {
      if (!indices.has(w)) {
        strongConnect(w)
        low.set(v, Math.min(low.get(v), low.get(w)))
      } else if (onStack.has(w)) {
        low.set(v, Math.min(low.get(v), indices.get(w)))
      }
    }

    if (low.get(v) === indices.get(v)) {
      const scc = []
      let w
      do {
        w = stack.pop()
        onStack.delete(w)
        scc.push(w)
      } while (w !== v)
      // 单节点且无自环不算环
      if (scc.length > 1) sccs.push(scc.reverse())
    }
  }

  for (const c of components) if (!indices.has(c.name)) strongConnect(c.name)
  return sccs
}

/** 一条边是否含「值导入」（`import type` 会被擦除，其余都算运行时依赖） */
const isRuntimePair = (p) => p.refs.some((r) => r.kind !== 'type-contract')

const cyclesAll = findCycles(pairs)
const cyclesRuntime = findCycles(pairs.filter(isRuntimePair))

/**
 * 组件族（family）：**不可分割的原子单元**。
 *
 * 父子组件对（`wd-tabs` + `wd-tab`）必然互引：父引子的 `.vue` 做组合，
 * 子引父的 `types` 拿注入 KEY。这不是缺陷，而是 Vue 父子契约的固有形态——
 * 强行「解环」只能靠把 KEY 搬到中立模块，代价是 Provide 类型失去组件上下文
 * （`common` 层会反过来知道「tabs 上下文」这种组件知识，违反 INV-2）。
 *
 * 因此采用**族内允许、族间禁止**的判据：
 *   - 环上所有组件同属一族 → 允许（原子单元）
 *   - 环跨越两个族 → 违规（说明两个本该独立的单元耦合了）
 *
 * 这条规则同时给出拆包约束：**按族拆，永不拆族内**。
 *
 * ⚠️ 族是**声明式**的，不是自动推断的（`docs/architecture/families.json`）。
 * 理由：自动推断只能识别双向边，漏掉单向的 provide/inject 父子对
 * （wd-col → wd-row 只引 ROW_KEY，没有反向边），而那 9 对恰恰是最典型的原子单元。
 * 靠启发式猜族会在「漏判」（把合法契约当违规）和「滥判」（掩盖真耦合）之间反复横跳。
 * 声明式则把判断摆到明面上：每个族必须写 reason，且本脚本会校验声明的真实性。
 */
function loadFamilies() {
  const file = join(ROOT, 'docs/architecture/families.json')
  if (!existsSync(file)) {
    console.error(`✖ 缺少组件族声明：${relative(ROOT, file)}`)
    process.exit(1)
  }
  const raw = JSON.parse(readFileSync(file, 'utf8'))
  const families = (raw.families || []).map((f) => ({
    id: f.id || f.members.join('+'),
    members: [...f.members].sort(),
    reason: f.reason || ''
  }))

  // --- 校验声明：不允许声明与图不符 ---
  const errors = []
  const nameSet = new Set(components.map((c) => c.name))
  const seen = new Map()
  for (const f of families) {
    if (f.members.length < 2) errors.push(`族 ${f.id} 成员少于 2 个`)
    if (!f.reason.trim()) errors.push(`族 ${f.id} 缺少 reason（为什么不能独立演进）`)
    for (const m of f.members) {
      if (!nameSet.has(m)) errors.push(`族 ${f.id} 的成员 ${m} 不存在`)
      if (seen.has(m)) errors.push(`${m} 同时属于族 ${seen.get(m)} 与 ${f.id}`)
      seen.set(m, f.id)
    }
    // 族内必须真的存在依赖边，否则是过期声明
    const inner = pairs.filter((p) => f.members.includes(p.from) && f.members.includes(p.to))
    if (inner.length === 0) errors.push(`族 ${f.id} 成员之间没有任何依赖边（声明已过期？）`)
  }

  // --- 反向校验：双向依赖对必须被某个族覆盖，不允许用沉默掩盖耦合 ---
  const edgeSet = new Set(pairs.map((p) => `${p.from}->${p.to}`))
  for (const p of pairs) {
    if (!edgeSet.has(`${p.to}->${p.from}`)) continue
    if (p.from > p.to) continue // 每对只报一次
    const fam = seen.get(p.from)
    if (fam && fam === seen.get(p.to)) continue
    errors.push(
      `${p.from} ↔ ${p.to} 是双向依赖，但未被任何族声明覆盖。` +
        `若它们是原子单元请在 families.json 中声明并写明 reason；` +
        `否则这是真环，必须解掉。`
    )
  }

  if (errors.length) {
    console.error('✖ 组件族声明校验失败：')
    for (const e of errors) console.error(`   - ${e}`)
    process.exit(1)
  }
  return families
}

const families = loadFamilies()
const familyOf = new Map()
for (const family of families) for (const name of family.members) familyOf.set(name, family.id)

/** 环是否跨族 */
function isCrossFamilyCycle(cycle) {
  const fams = new Set(cycle.map((n) => familyOf.get(n) || n))
  return fams.size > 1
}

const cyclesCrossFamily = cyclesAll.filter(isCrossFamilyCycle)

/** 是否同一组件族（族内互引是 provide/inject 契约，不是缺陷） */
const inSameFamily = (a, b) => {
  const fa = familyOf.get(a)
  return fa !== undefined && fa === familyOf.get(b)
}

/**
 * 契约借用 —— **跨族、业务 ↔ 业务** 的 types/utils 借用。
 *
 * 只有这一类是问题：它让两个本该独立演进的组件在类型层耦合，
 * 拆包时必须连带、改动会无声波及。以下三类**不算**（否则指标会虚高到没有指导意义）：
 *   - 业务 → 基础件：这是期望的依赖方向，基础件的 types 本来就是给业务用的；
 *   - 基础件 ↔ 基础件：primitives 之间可互引（popup → overlay → transition）；
 *   - 族内父子组件：子组件 import 父组件的 `*_KEY` 是 provide/inject 契约。
 */
const contractBorrow = pairs.filter(
  (p) =>
    byName.get(p.from).layer === 'business' &&
    byName.get(p.to).layer === 'business' &&
    !inSameFamily(p.from, p.to) &&
    p.refs.some((r) => r.kind !== 'compose')
)

// ---------------------------------------------------------------------------
// 违规判定
// ---------------------------------------------------------------------------

const violations = []

for (const p of coreToBusiness) {
  violations.push({
    rule: 'dep/primitives-purity',
    detail: `基础件 ${p.from} 依赖业务组件 ${p.to}（基础件只能依赖 L3/L2/L0）`
  })
}
// 注意：core → core 是**合法**的（popup → overlay → transition 是必要的组合链）。
// 只需保证这条链不成环，环由全局 Tarjan 检测负责，故此处不判违规。
for (const cycle of cyclesCrossFamily) {
  violations.push({
    rule: 'dep/cross-family-cycle',
    detail: `跨族循环依赖：${cycle.join(' → ')} → ${cycle[0]}（族内互引允许，跨族不允许）`
  })
}
for (const p of businessToBusiness) {
  // 族内互引（父子组件的 .vue 组合 + 注入 KEY 借用）是原子单元的内部实现，
  // 不是可拆解的耦合，因此不进违规清单。
  if (inSameFamily(p.from, p.to)) continue
  const isContract = p.refs.some((r) => r.kind !== 'compose')
  violations.push({
    rule: isContract ? 'dep/lateral-contract' : 'dep/lateral-component',
    detail: `${p.from} → ${p.to}（${[...p.kinds].join(' + ')}）`
  })
}

// ---------------------------------------------------------------------------
// 基线
// ---------------------------------------------------------------------------

const metrics = {
  components: components.length,
  core: coreNames.size,
  business: components.length - coreNames.size,
  importLines: edges.length,
  edges: pairs.length,
  businessToBusiness: businessToBusiness.length,
  businessToCore: businessToCore.length,
  coreToCore: coreToCore.length,
  coreToBusiness: coreToBusiness.length,
  contractBorrow: contractBorrow.length,
  cycles: cyclesAll.length,
  cyclesRuntime: cyclesRuntime.length,
  cyclesCrossFamily: cyclesCrossFamily.length,
  families: families.length,
  kinds: kindCount
}

const baseline = {
  $comment: '由 scripts/analyze-deps.mjs 生成。业务↔业务边数是单调收敛指标：允许下降，禁止上升（ADR-012）。',
  generatedAt: new Date().toISOString().slice(0, 10),
  metrics,
  families: families.map((f) => f.members.join('+')),
  businessPairs: businessToBusiness.map((p) => `${p.from}->${p.to}`).sort()
}

// ---------------------------------------------------------------------------
// --check：与基线比较
// ---------------------------------------------------------------------------

if (checkMode) {
  if (!existsSync(BASELINE_PATH)) {
    console.error(`✖ 基线不存在：${relative(ROOT, BASELINE_PATH)}`)
    console.error('  先运行 node scripts/analyze-deps.mjs 生成基线。')
    process.exit(1)
  }
  const prev = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'))
  const failures = []

  const prevB2B = prev.metrics?.businessToBusiness ?? 0
  if (metrics.businessToBusiness > prevB2B) {
    const prevSet = new Set(prev.businessPairs || [])
    const added = businessToBusiness.map((p) => `${p.from}->${p.to}`).filter((k) => !prevSet.has(k))
    failures.push(
      `业务↔业务依赖边增长：${prevB2B} → ${metrics.businessToBusiness}（+${metrics.businessToBusiness - prevB2B}）\n` +
        added.map((a) => `       新增：${a}`).join('\n')
    )
  }
  // 环的判据是「族间禁止、族内允许」：
  //   父子组件对（wd-tabs + wd-tab）是不可分割的原子单元，其互引不是缺陷；
  //   跨族环才说明两个本该独立的单元耦合了。
  if (metrics.cyclesCrossFamily > 0) {
    failures.push(
      `存在跨族循环依赖：${metrics.cyclesCrossFamily} 个\n` +
        cyclesCrossFamily.map((c) => `       ${c.join(' → ')} → ${c[0]}`).join('\n')
    )
  }
  if (metrics.contractBorrow > (prev.metrics?.contractBorrow ?? 0)) {
    failures.push(`契约借用增长：${prev.metrics?.contractBorrow ?? 0} → ${metrics.contractBorrow}`)
  }
  if (metrics.coreToBusiness > (prev.metrics?.coreToBusiness ?? 0)) {
    failures.push(`基础件反向依赖业务组件：${metrics.coreToBusiness} 处（dep/primitives-purity）`)
  }

  if (failures.length) {
    console.error('✖ 横向依赖退化（ADR-012 要求单调收敛）：\n')
    for (const f of failures) console.error(`   - ${f}\n`)
    process.exit(1)
  }

  console.log(
    `✅ 横向依赖未退化（业务↔业务 ${metrics.businessToBusiness} ≤ 基线 ${prevB2B}，` +
      `族间环 ${metrics.cyclesCrossFamily}，族内环 ${metrics.cycles}，契约借用 ${metrics.contractBorrow}）`
  )
  process.exit(0)
}

if (jsonMode) {
  console.log(JSON.stringify({ metrics, violations, cycles: cyclesAll, cyclesRuntime, pairs: pairs.map((p) => `${p.from}->${p.to}`) }, null, 2))
  process.exit(violations.length || cyclesRuntime.length ? 1 : 0)
}

// ---------------------------------------------------------------------------
// 写报告 + 基线
// ---------------------------------------------------------------------------

mkdirSync(OUT_DIR, { recursive: true })
writeFileSync(BASELINE_PATH, `${JSON.stringify(baseline, null, 2)}\n`)

const topFanIn = Object.entries(fanIn)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 15)
const topFanOut = Object.entries(fanOut)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 12)

const lines = []
lines.push('# 组件横向依赖报告')
lines.push('')
lines.push('> 由 `scripts/analyze-deps.mjs` 自动生成，请勿手动编辑。')
lines.push(`> 生成日期：${baseline.generatedAt} ｜ 判据见 [ADR-012](../adr/012-primitives-layer.md)`)
lines.push('')
lines.push('## 总量')
lines.push('')
lines.push('| 指标 | 数值 | 目标 |')
lines.push('|---|---|---|')
lines.push(`| 组件数 | ${metrics.components}（core ${metrics.core} / business ${metrics.business}） | — |`)
lines.push(`| import 行数 | ${metrics.importLines} | — |`)
lines.push(`| 去重依赖边 | ${metrics.edges} | — |`)
lines.push(`| 业务 → 基础件 | ${metrics.businessToCore} | ↑ 越多越好 |`)
lines.push(`| **业务 ↔ 业务** | **${metrics.businessToBusiness}** | ≤ 60（拆包门槛 ≤ 30） |`)
lines.push(`| 契约借用 | ${metrics.contractBorrow} | 0 |`)
lines.push(`| **跨族环** | **${metrics.cyclesCrossFamily}** | 0 |`)
lines.push(`| 族内环（父子组件对） | ${metrics.cycles} | 允许（原子单元） |`)
lines.push(`| 组件族 | ${metrics.families} | — |`)
lines.push(`| 基础件反向依赖 | ${metrics.coreToBusiness} | 0 |`)
lines.push('')
lines.push('## 边类型分布')
lines.push('')
lines.push('| 类型 | 条数 | 说明 |')
lines.push('|---|---|---|')
lines.push('| compose | ' + (kindCount.compose || 0) + ' | 引 `.vue`，组件组合（合法） |')
lines.push('| type-contract | ' + (kindCount['type-contract'] || 0) + ' | `import type` 借契约（应下沉） |')
lines.push('| other | ' + (kindCount.other || 0) + ' | 值导入 `types` 内 KEY 常量（应下沉） |')
lines.push('| util-borrow | ' + (kindCount['util-borrow'] || 0) + ' | 借 utils（应下沉 common） |')
lines.push('')
lines.push('## fan-in Top（被依赖最多）')
lines.push('')
lines.push('| 组件 | 层 | fan-in | fan-out |')
lines.push('|---|---|---|---|')
for (const [name, count] of topFanIn) {
  lines.push(`| \`${name}\` | ${byName.get(name).layer} | ${count} | ${fanOut[name] || 0} |`)
}
lines.push('')
lines.push('## fan-out Top（依赖最多）')
lines.push('')
lines.push('| 组件 | 层 | fan-out |')
lines.push('|---|---|---|')
for (const [name, count] of topFanOut) {
  lines.push(`| \`${name}\` | ${byName.get(name).layer} | ${count} |`)
}
lines.push('')
lines.push('## 循环依赖')
lines.push('')
lines.push('判据是**族间禁止、族内允许**：父子组件对（如 `wd-tabs` + `wd-tab`）是')
lines.push('不可分割的原子单元，父引子 `.vue`、子引父 `types` 的 KEY 是 Vue 父子契约的')
lines.push('固有形态，不构成缺陷。跨族环才说明两个本该独立的单元耦合了。')
lines.push('')
if (cyclesAll.length === 0) {
  lines.push('无 ✅')
} else {
  lines.push('| # | 环 | 判定 |')
  lines.push('|---|---|---|')
  const runtimeSet = new Set(cyclesRuntime.map((c) => c.slice().sort().join('|')))
  cyclesAll.forEach((c, i) => {
    const cross = isCrossFamilyCycle(c)
    const runtime = runtimeSet.has(c.slice().sort().join('|'))
    const verdict = cross ? '🔴 跨族' : `✅ 族内${runtime ? '（含值导入）' : '（纯类型）'}`
    lines.push(`| ${i + 1} | ${c.map((n) => `\`${n}\``).join(' → ')} → \`${c[0]}\` | ${verdict} |`)
  })
}
lines.push('')
if (families.length) {
  // 族是顶级章节：它同时决定「环是否违规」与「横向边是否违规」两个判据，
  // 埋在「循环依赖」下会让人误以为只跟环有关。
  lines.push('## 组件族（原子单元，拆包时不可拆分）')
  lines.push('')
  lines.push('声明于 `docs/architecture/families.json`，由 `analyze-deps.mjs` 校验真实性。')
  lines.push('族内互引（父引子 `.vue`、子引父 `types` 的 KEY）合法；跨族互引违规。')
  lines.push('')
  for (const f of families) {
    lines.push(`- **${f.id}**：${f.members.map((n) => `\`${n}\``).join(' + ')}`)
    if (f.reason) lines.push(`  - ${f.reason}`)
  }
  lines.push('')
}
lines.push('')
lines.push('## 违规清单（按规则）')
lines.push('')
if (violations.length === 0) {
  lines.push('无 ✅')
} else {
  const grouped = {}
  for (const v of violations) (grouped[v.rule] ||= []).push(v.detail)
  for (const [rule, items] of Object.entries(grouped)) {
    lines.push(`### ${rule}（${items.length}）`)
    lines.push('')
    for (const it of items.slice(0, 40)) lines.push(`- ${it}`)
    if (items.length > 40) lines.push(`- … 另有 ${items.length - 40} 条，见 \`--json\``)
    lines.push('')
  }
}
if (unresolved.length) {
  lines.push('## 未解析的引用（目标组件不存在）')
  lines.push('')
  for (const u of unresolved.slice(0, 20)) lines.push(`- \`${u.from}\` → \`${u.target}\`（${u.file}:${u.line}）`)
  lines.push('')
}

writeFileSync(REPORT_PATH, `${lines.join('\n')}\n`)

console.log('✅ 依赖分析完成')
console.log(`   组件 ${metrics.components}（core ${metrics.core} / business ${metrics.business}）`)
console.log(
  `   依赖边 ${metrics.edges}｜业务↔业务 ${metrics.businessToBusiness}｜契约借用 ${metrics.contractBorrow}` +
    `｜跨族环 ${metrics.cyclesCrossFamily}｜族内环 ${metrics.cycles}｜组件族 ${metrics.families}`
)
console.log(`   报告：${relative(ROOT, REPORT_PATH)}`)
console.log(`   基线：${relative(ROOT, BASELINE_PATH)}`)
if (violations.length || cyclesCrossFamily.length) {
  console.log(`   ⚠️  违规 ${violations.length} 条（已写入报告，--check 会阻断增长）`)
}
