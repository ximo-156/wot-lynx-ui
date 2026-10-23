#!/usr/bin/env node
/**
 * API 变更检测：语义 diff 两个 meta 版本 → 变更清单 + 迁移计划（ADR-019）。
 *
 * meta.json 是源码的函数（ADR-017），所以「两个 commit 的 meta 之差」就是
 * 「这两个 commit 的公开 API 之差」。本脚本把这个差变成三样东西：
 *
 *   1. 变更清单（人读，进 PR 摘要 / CHANGELOG）
 *   2. 迁移计划 JSON（机器读，喂给 scripts/codemod.mjs）
 *   3. 破坏性变更的迁移指引（人读）
 *
 * ## 为什么不是文本 diff
 *
 * `git diff meta.json` 会把「一个 prop 改类型」显示成一行巨长的 JSON，
 * 且无法区分「改描述」和「删 prop」——两者对使用者的影响完全不同。
 * 这里按**语义单元**（组件 / prop / event / slot）比较，只输出真正的契约变化。
 *
 * ## 严重级映射
 *
 * | 变更 | 级别 | 依据 |
 * |---|---|---|
 * | 删组件 / 删 prop / 删 event / 删 slot | major | 使用者代码会编译失败或静默失效 |
 * | 组件换根（primitives ↔ components） | major | 深层导入路径失效 |
 * | v-model 契约变化 | major | 双向绑定的对外约定 |
 * | prop 类型收窄 / 不兼容 | major | 传入值可能不再合法 |
 * | prop 可选值移除 | major | 已写死的取值不再合法 |
 * | prop 由可选变必填 | major | 现有用法缺参 |
 * | 新增组件 / 新增 prop / event / slot | minor | 向后兼容 |
 * | prop 类型放宽 | minor | 旧值仍然合法 |
 * | prop 默认值变化 | minor | 不改类型，但改变默认行为 |
 * | prop 由必填变可选 | minor | 向后兼容 |
 * | 族归属变化 | patch | 内部组织，不影响使用者 |
 * | 描述变化 | docs | 纯文档，不影响版本号 |
 *
 * ## 用法
 *
 *   node scripts/api-diff.mjs --base v0.1.0
 *   node scripts/api-diff.mjs --base v0.1.0 --md api-changes.md --json api-changes.json --plan codemod-plan.json
 *   node scripts/api-diff.mjs --base v0.1.0 --fail-on major     # CI 用，命中即 exit 1
 *
 * `--base` 既可以是 git ref（读该 commit 的 packages/ui/meta.json），
 * 也可以是本地文件路径（便于对比任意两份快照）。
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DEFAULT_HEAD = path.join(ROOT, 'packages/ui/meta.json')
const META_IN_REPO = 'packages/ui/meta.json'

/** 严重级排序；`--fail-on` 与排序都用它 */
export const SEVERITY_ORDER = { docs: 0, patch: 1, minor: 2, major: 3 }

/** 严重级 → 章节标题（顺序即输出顺序，破坏性在前） */
const SEVERITY_TITLE = {
  major: '破坏性变更',
  minor: '新增能力',
  patch: '内部调整',
  docs: '文档'
}

// ---------------------------------------------------------------------------
// 类型表达式比较
// ---------------------------------------------------------------------------

/**
 * 按顶层分隔符切分类型表达式。
 *
 * 必须跳过引号与成对括号：`Record<string, any>` 里的逗号、`'a' | 'b'` 里的
 * 竖线都不是顶层分隔符。`=>` 的 `>` 要单独跳过，否则箭头函数类型会把深度
 * 减到 -1，后续所有分隔符都判错。
 */
export function splitTopLevel(text, sep) {
  const out = []
  let cur = ''
  let depth = 0
  let quote = null
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (quote) {
      cur += ch
      if (ch === '\\') {
        cur += text[i + 1] ?? ''
        i++
        continue
      }
      if (ch === quote) quote = null
      continue
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      quote = ch
      cur += ch
      continue
    }
    if (ch === '=' && text[i + 1] === '>') {
      cur += '=>'
      i++
      continue
    }
    if (ch === '<' || ch === '(' || ch === '[' || ch === '{') depth++
    else if (ch === '>' || ch === ')' || ch === ']' || ch === '}') depth--
    if (ch === sep && depth === 0) {
      out.push(cur)
      cur = ''
      continue
    }
    cur += ch
  }
  out.push(cur)
  return out.map((s) => s.trim()).filter(Boolean)
}

/** 类型文本归一：压空白、统一联合类型两侧空格 */
export function normalizeType(type) {
  return String(type ?? '')
    .replace(/\s+/g, ' ')
    .replace(/\s*\|\s*/g, ' | ')
    .trim()
}

/**
 * 类型变化分类。
 *
 * 只看联合成员集合的包含关系：新集合是旧集合的子集 → 收窄；超集 → 放宽；
 * 互有增减 → 不兼容。对使用者而言，放宽可以安全升级，收窄与不兼容都不行。
 */
export function classifyTypeChange(before, after) {
  const b = normalizeType(before)
  const a = normalizeType(after)
  if (b === a) return 'same'
  const bSet = new Set(splitTopLevel(b, '|'))
  const aSet = new Set(splitTopLevel(a, '|'))
  const onlyBefore = [...bSet].filter((x) => !aSet.has(x))
  const onlyAfter = [...aSet].filter((x) => !bSet.has(x))
  if (onlyAfter.length === 0 && onlyBefore.length > 0) return 'narrowed'
  if (onlyBefore.length === 0 && onlyAfter.length > 0) return 'widened'
  return 'incompatible'
}

const TYPE_SEVERITY = { narrowed: 'major', incompatible: 'major', widened: 'minor' }
const TYPE_LABEL = { narrowed: '收窄', incompatible: '不兼容', widened: '放宽' }

// ---------------------------------------------------------------------------
// 语义 diff
// ---------------------------------------------------------------------------

const asSet = (list) => new Set(Array.isArray(list) ? list : [])

/** 集合差异 → 变更项（events / slots 共用） */
function diffStringSet(component, before, after, kindAdded, kindRemoved, out) {
  const b = asSet(before)
  const a = asSet(after)
  for (const name of a) {
    if (!b.has(name)) {
      out.push({
        component,
        kind: kindAdded,
        target: name,
        severity: 'minor',
        detail: `新增 ${name}`
      })
    }
  }
  for (const name of b) {
    if (!a.has(name)) {
      out.push({
        component,
        kind: kindRemoved,
        target: name,
        severity: 'major',
        detail: `移除 ${name}`
      })
    }
  }
}

/** prop 的「同一性签名」：用于识别改名（删一个、加一个，签名完全相同） */
function propSignature(prop) {
  return [normalizeType(prop.type), String(prop.default ?? '\u0000'), String(prop.options ?? '')].join('\u0001')
}

/**
 * 识别改名。
 *
 * 判据是「删掉的 prop 与新增的 prop 类型、默认值、可选值全部相同」。
 * 为什么不用描述：描述常被顺手改，反而是最不稳定的信号。
 *
 * 签名桶里只要有一侧超过 1 个，就无法确定配对关系（`a`/`b` 删、`c`/`d` 加），
 * 此时**不猜**，退回「删 + 加」两条独立变更，交给人工判断。猜错的代价是
 * 一个静默改坏使用者代码的 codemod，比不给 codemod 糟得多。
 */
function detectRenames(removed, added) {
  const buckets = new Map()
  const push = (prop, side) => {
    const key = propSignature(prop)
    if (!buckets.has(key)) buckets.set(key, { removed: [], added: [] })
    buckets.get(key)[side].push(prop)
  }
  for (const p of removed) push(p, 'removed')
  for (const p of added) push(p, 'added')

  const renames = []
  for (const bucket of buckets.values()) {
    if (bucket.removed.length === 1 && bucket.added.length === 1) {
      renames.push({ from: bucket.removed[0], to: bucket.added[0] })
    }
  }
  return renames
}

function diffProps(component, beforeProps, afterProps, out) {
  const bMap = new Map(beforeProps.map((p) => [p.name, p]))
  const aMap = new Map(afterProps.map((p) => [p.name, p]))

  const removed = [...bMap.values()].filter((p) => !aMap.has(p.name))
  const added = [...aMap.values()].filter((p) => !bMap.has(p.name))
  const renames = detectRenames(removed, added)

  const renamedFrom = new Set(renames.map((r) => r.from.name))
  const renamedTo = new Set(renames.map((r) => r.to.name))

  for (const r of renames) {
    out.push({
      component,
      kind: 'prop-renamed',
      target: r.from.name,
      before: r.from.name,
      after: r.to.name,
      severity: 'major',
      detail: `改名 \`${r.from.name}\` → \`${r.to.name}\`（类型/默认值/可选值一致，判定为改名）`
    })
  }

  for (const p of removed) {
    if (renamedFrom.has(p.name)) continue
    out.push({
      component,
      kind: 'prop-removed',
      target: p.name,
      severity: 'major',
      detail: `移除 prop \`${p.name}\`${p.type ? `（${p.type}）` : ''}`
    })
  }

  for (const p of added) {
    if (renamedTo.has(p.name)) continue
    // 新增必填 prop 对老代码是破坏性的：原本没传这个参数
    out.push({
      component,
      kind: 'prop-added',
      target: p.name,
      severity: p.required ? 'major' : 'minor',
      detail: p.required ? `新增必填 prop \`${p.name}\`` : `新增 prop \`${p.name}\``
    })
  }

  for (const [name, b] of bMap) {
    const a = aMap.get(name)
    if (!a) continue

    const typeChange = classifyTypeChange(b.type, a.type)
    if (typeChange !== 'same') {
      out.push({
        component,
        kind: 'prop-type-changed',
        target: name,
        before: normalizeType(b.type),
        after: normalizeType(a.type),
        severity: TYPE_SEVERITY[typeChange],
        detail: `\`${name}\` 类型${TYPE_LABEL[typeChange]}：${normalizeType(b.type)} → ${normalizeType(a.type)}`
      })
    }

    // 可选值单独比较：type 可能是别名（`BadgeType`），字面量集合只在 options 里
    const bOpts = splitTopLevel(String(b.options ?? ''), '|')
    const aOpts = splitTopLevel(String(a.options ?? ''), '|')
    if (bOpts.length || aOpts.length) {
      const bSet = new Set(bOpts)
      const aSet = new Set(aOpts)
      const removedOpts = bOpts.filter((x) => !aSet.has(x))
      const addedOpts = aOpts.filter((x) => !bSet.has(x))
      if (removedOpts.length) {
        out.push({
          component,
          kind: 'prop-options-removed',
          target: name,
          options: removedOpts,
          severity: 'major',
          detail: `\`${name}\` 移除可选值 ${removedOpts.join('、')}`
        })
      }
      if (addedOpts.length) {
        out.push({
          component,
          kind: 'prop-options-added',
          target: name,
          options: addedOpts,
          severity: 'minor',
          detail: `\`${name}\` 新增可选值 ${addedOpts.join('、')}`
        })
      }
    }

    const bDefault = b.default === undefined ? undefined : String(b.default).trim()
    const aDefault = a.default === undefined ? undefined : String(a.default).trim()
    if (bDefault !== aDefault) {
      out.push({
        component,
        kind: 'prop-default-changed',
        target: name,
        before: bDefault ?? '(无)',
        after: aDefault ?? '(无)',
        severity: 'minor',
        detail: `\`${name}\` 默认值变化：${bDefault ?? '(无)'} → ${aDefault ?? '(无)'}`
      })
    }

    const bRequired = Boolean(b.required)
    const aRequired = Boolean(a.required)
    if (bRequired !== aRequired) {
      out.push({
        component,
        kind: 'prop-required-changed',
        target: name,
        before: bRequired,
        after: aRequired,
        severity: aRequired ? 'major' : 'minor',
        detail: aRequired ? `\`${name}\` 由可选变必填` : `\`${name}\` 由必填变可选`
      })
    }

    if ((b.description ?? '') !== (a.description ?? '')) {
      out.push({
        component,
        kind: 'prop-description-changed',
        target: name,
        severity: 'docs',
        detail: `\`${name}\` 描述更新`
      })
    }
  }
}

function diffComponent(name, b, h, out) {
  if (b.layer !== h.layer) {
    out.push({
      component: name,
      kind: 'component-layer-changed',
      before: b.layer,
      after: h.layer,
      severity: 'major',
      detail: `组件根 ${b.layer} → ${h.layer}（深层导入路径失效）`
    })
  }
  if ((b.family ?? null) !== (h.family ?? null)) {
    out.push({
      component: name,
      kind: 'family-changed',
      before: b.family ?? null,
      after: h.family ?? null,
      severity: 'patch',
      detail: `族归属 ${b.family ?? '(无)'} → ${h.family ?? '(无)'}`
    })
  }
  if (Boolean(b.modelValue) !== Boolean(h.modelValue)) {
    out.push({
      component: name,
      kind: 'model-value-changed',
      before: Boolean(b.modelValue),
      after: Boolean(h.modelValue),
      severity: 'major',
      detail: `v-model 支持 ${b.modelValue ? '有' : '无'} → ${h.modelValue ? '有' : '无'}`
    })
  }
  diffStringSet(name, b.events, h.events, 'event-added', 'event-removed', out)
  diffStringSet(name, b.slots, h.slots, 'slot-added', 'slot-removed', out)
  diffProps(name, Array.isArray(b.props) ? b.props : [], Array.isArray(h.props) ? h.props : [], out)
}

/**
 * 两份 meta → 变更清单。
 *
 * 纯函数、不碰文件系统，便于测试与复用。
 * 返回顺序：组件名升序，组件内按「组件级 → event → slot → prop」的固定次序，
 * 保证同样的输入永远产出同样的输出（报告 diff 才稳定）。
 */
export function diffMeta(baseMeta, headMeta) {
  const out = []
  const baseNames = Object.keys(baseMeta ?? {})
  const headNames = Object.keys(headMeta ?? {})
  const baseSet = new Set(baseNames)
  const headSet = new Set(headNames)

  for (const name of headNames) {
    if (!baseSet.has(name)) {
      out.push({
        component: name,
        kind: 'component-added',
        severity: 'minor',
        detail: '新增组件'
      })
    }
  }
  for (const name of baseNames) {
    if (!headSet.has(name)) {
      out.push({
        component: name,
        kind: 'component-removed',
        severity: 'major',
        detail: '移除组件'
      })
    }
  }
  for (const name of headNames) {
    if (!baseSet.has(name)) continue
    diffComponent(name, baseMeta[name], headMeta[name], out)
  }

  const order = [
    'component-added',
    'component-removed',
    'component-layer-changed',
    'family-changed',
    'model-value-changed'
  ]
  const rank = (c) => {
    const i = order.indexOf(c.kind)
    if (i >= 0) return i
    if (c.kind.startsWith('event-')) return 10
    if (c.kind.startsWith('slot-')) return 11
    return 12
  }
  // 比较器必须对所有字段给出确定序：同一个 prop 可能同时有「类型变化」和
  // 「描述变化」两条记录，只比 target 会让相等项恒返回 1，排序结果依赖引擎。
  const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0)
  return out.sort(
    (x, y) =>
      cmp(x.component, y.component) ||
      rank(x) - rank(y) ||
      cmp(String(x.target ?? ''), String(y.target ?? '')) ||
      cmp(x.kind, y.kind)
  )
}

// ---------------------------------------------------------------------------
// 迁移计划（喂给 codemod）
// ---------------------------------------------------------------------------

/** 每种破坏性变更的手工迁移指引 */
function guidanceFor(change) {
  const c = change.component
  const t = change.target
  switch (change.kind) {
    case 'component-removed':
      return `组件 ${c} 已移除。搜索 \`<${c}\` 与 \`wot-lynx-ui/\` 下指向它的深层导入，替换为替代组件。`
    case 'component-layer-changed':
      return `组件 ${c} 的分发根从 ${change.before} 改为 ${change.after}：把深层导入里的 \`/${change.before}/\` 改成 \`/${change.after}/\`（barrel 导入不受影响）。`
    case 'model-value-changed':
      return `${c} 的 v-model 支持已${change.after ? '新增' : '移除'}，检查 \`v-model\` / \`v-model:xxx\` 用法。`
    case 'prop-removed':
      return `${c} 的 prop \`${t}\` 已移除：搜索 \`:${t}=\` / \`${t}=\`，按新版 API 改写。`
    case 'prop-added':
      return `${c} 新增必填 prop \`${t}\`：现有用法必须补传，否则运行期取到 undefined。`
    case 'prop-type-changed':
      return `${c} 的 \`${t}\` 类型由 ${change.before} 变为 ${change.after}：检查传入值是否仍在范围内。`
    case 'prop-options-removed':
      return `${c} 的 \`${t}\` 不再接受 ${(change.options ?? []).join('、')}：检查写死的取值。`
    case 'prop-required-changed':
      return `${c} 的 \`${t}\` 变为必填：现有用法需补传。`
    case 'event-removed':
      return `${c} 不再触发 \`${t}\`：搜索 \`@${t}\` 监听器，迁移到新事件。`
    case 'slot-removed':
      return `${c} 移除了插槽 \`${t}\`：检查 \`<template #${t}>\` 用法。`
    default:
      return `${c} 的 ${change.kind} 需要人工确认。`
  }
}

/**
 * 变更清单 → 迁移计划。
 *
 * `rules` 是**可自动执行**的改写（当前只有 prop 改名），`manual` 是必须人看的部分。
 * 分开的原因：codemod 只做能证明等价的事，其余一律交给人工——静默改坏比不改更糟。
 */
export function buildPlan(changes, source) {
  const rules = []
  const manual = []
  for (const change of changes) {
    if (change.kind === 'prop-renamed') {
      rules.push({
        kind: 'rename-prop',
        component: change.component,
        from: change.before,
        to: change.after
      })
      continue
    }
    if (change.severity === 'major') {
      manual.push({
        component: change.component,
        kind: change.kind,
        target: change.target ?? null,
        guidance: guidanceFor(change)
      })
    }
  }
  return { generatedFrom: source, rules, manual }
}

// ---------------------------------------------------------------------------
// 渲染
// ---------------------------------------------------------------------------

/** 表格单元格：GFM 里裸竖线会断列 */
const cell = (value) => String(value ?? '').replace(/\|/g, '\\|').replace(/\n+/g, ' ').trim()
const inlineCode = (value) => `\`${String(value ?? '').replace(/`/g, "'").replace(/\|/g, '\\|')}\``

function countBySeverity(changes) {
  const counts = { major: 0, minor: 0, patch: 0, docs: 0 }
  for (const c of changes) counts[c.severity] = (counts[c.severity] ?? 0) + 1
  return counts
}

/** 变更清单 → Markdown（PR 摘要 / CHANGELOG 素材） */
export function renderMarkdown(changes, source, options = {}) {
  const includeDocs = Boolean(options.includeDocs)
  const visible = includeDocs ? changes : changes.filter((c) => c.severity !== 'docs')
  const counts = countBySeverity(visible)
  const lines = []

  lines.push('# API 变更清单')
  lines.push('')
  lines.push(`基准：${source.base}`)
  lines.push(`目标：${source.head}`)
  lines.push('')
  lines.push(
    `共 ${visible.length} 项：破坏性 ${counts.major} / 新增 ${counts.minor} / 内部 ${counts.patch}` +
      (includeDocs ? ` / 文档 ${counts.docs}` : '')
  )
  lines.push('')

  if (visible.length === 0) {
    // 只有描述变更时不能笼统说「无变更」：文档改动确实发生了，只是默认不占篇幅
    const hiddenDocs = changes.length - visible.length
    lines.push(hiddenDocs > 0 ? `无契约变更（另有 ${hiddenDocs} 项描述变更，加 \`--include-docs\` 显示）。` : '无 API 变更。')
    lines.push('')
    return lines.join('\n')
  }

  for (const severity of ['major', 'minor', 'patch', 'docs']) {
    const group = visible.filter((c) => c.severity === severity)
    if (group.length === 0) continue
    lines.push(`## ${SEVERITY_TITLE[severity]}（${severity}，${group.length} 项）`)
    lines.push('')
    lines.push('| 组件 | 变更 | 详情 |')
    lines.push('| --- | --- | --- |')
    for (const c of group) {
      lines.push(`| ${inlineCode(c.component)} | ${cell(c.kind)} | ${cell(c.detail)} |`)
    }
    lines.push('')
  }

  const plan = buildPlan(changes, source)
  if (plan.rules.length || plan.manual.length) {
    lines.push('## 迁移指引')
    lines.push('')
    if (plan.rules.length) {
      lines.push('### 可自动改写（`pnpm codemod --plan <file>`）')
      lines.push('')
      for (const r of plan.rules) {
        lines.push(
          `- ${inlineCode(r.component)}：属性 ${inlineCode(r.from)} → ${inlineCode(r.to)}（模板内两种拼写都会改写）`
        )
      }
      lines.push('')
    }
    if (plan.manual.length) {
      lines.push('### 需人工确认')
      lines.push('')
      for (const m of plan.manual) lines.push(`- ${m.guidance}`)
      lines.push('')
    }
  }

  return lines.join('\n')
}

/** 控制台摘要 */
export function renderConsole(changes, source) {
  const counts = countBySeverity(changes)
  const lines = []
  lines.push(`API diff：${source.base} → ${source.head}`)
  lines.push(
    `${changes.length} 项（破坏性 ${counts.major} / 新增 ${counts.minor} / 内部 ${counts.patch} / 文档 ${counts.docs}）`
  )
  if (changes.length === 0) {
    lines.push('无变更。')
    return lines.join('\n')
  }
  lines.push('')
  const mark = { major: '✖', minor: '+', patch: '·', docs: ' ' }
  for (const c of changes) {
    lines.push(`  ${mark[c.severity]} [${c.severity}] ${c.component}  ${c.kind}  ${c.detail}`)
  }
  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

/**
 * 解析基准：先当文件，再当 git ref。
 *
 * 返回 `meta: null` 表示「这个 ref 有效，但当时还没有 meta.json」——契约产物
 * 是后加的，任何早于它的 commit 都属于这种情况。此时应跳过比较而不是报错，
 * 否则第一个引入 meta 的 PR 会让 CI 直接崩在 `git show` 上。
 */
function loadBaseMeta(spec) {
  if (existsSync(spec)) {
    return { meta: JSON.parse(readFileSync(spec, 'utf8')), label: path.relative(ROOT, path.resolve(spec)) || spec }
  }

  let refValid = true
  try {
    execFileSync('git', ['rev-parse', '--verify', `${spec}^{commit}`], { cwd: ROOT, stdio: 'ignore' })
  } catch {
    refValid = false
  }
  if (!refValid) {
    throw new Error(
      `无法解析基准：${spec}\n` +
        `  既不是存在的文件，也不是有效的 git ref。\n` +
        `  提示：PR 场景请先 fetch 基准分支（git fetch origin main）。`
    )
  }

  try {
    const raw = execFileSync('git', ['show', `${spec}:${META_IN_REPO}`], {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    })
    return { meta: JSON.parse(raw), label: `${spec}:${META_IN_REPO}` }
  } catch {
    return { meta: null, label: spec }
  }
}

function parseArgs(argv) {
  const args = { base: null, head: DEFAULT_HEAD, json: null, md: null, plan: null, failOn: null, includeDocs: false }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    const next = () => {
      const v = argv[++i]
      if (v === undefined) throw new Error(`${a} 缺少参数`)
      return v
    }
    if (a === '--base') args.base = next()
    else if (a === '--head') args.head = next()
    else if (a === '--json') args.json = next()
    else if (a === '--md') args.md = next()
    else if (a === '--plan') args.plan = next()
    else if (a === '--fail-on') args.failOn = next()
    else if (a === '--include-docs') args.includeDocs = true
    else if (a === '--help' || a === '-h') args.help = true
    else throw new Error(`未知参数：${a}`)
  }
  return args
}

function usage() {
  return [
    '用法：node scripts/api-diff.mjs --base <git-ref|file> [选项]',
    '',
    '选项：',
    '  --head <file>     目标 meta，默认 packages/ui/meta.json',
    '  --md <file>       写出 Markdown 变更清单',
    '  --json <file>     写出完整变更清单 JSON',
    '  --plan <file>     写出迁移计划 JSON（供 codemod 消费）',
    '  --fail-on <级别>  命中该级别及以上时 exit 1（docs|patch|minor|major）',
    '  --include-docs    变更清单包含纯描述变更',
    '  -h, --help        显示本帮助'
  ].join('\n')
}

function main() {
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
  if (!args.base) {
    console.error('✖ 缺少 --base')
    console.error(usage())
    process.exit(2)
  }

  let base
  let headMeta
  try {
    base = loadBaseMeta(args.base)
    headMeta = JSON.parse(readFileSync(args.head, 'utf8'))
  } catch (err) {
    console.error(`✖ ${err.message}`)
    process.exit(2)
  }
  if (base.meta === null) {
    console.log(`基准 ${base.label} 中还没有 ${META_IN_REPO}（该版本早于契约产物），跳过比较。`)
    return
  }
  const source = { base: base.label, head: path.relative(ROOT, path.resolve(args.head)) }

  const changes = diffMeta(base.meta, headMeta)
  console.log(renderConsole(changes, source))

  if (args.md) {
    writeFileSync(args.md, renderMarkdown(changes, source, { includeDocs: args.includeDocs }))
    console.log(`\n已写出 Markdown：${path.relative(ROOT, path.resolve(args.md))}`)
  }
  if (args.json) {
    writeFileSync(args.json, JSON.stringify({ source, changes }, null, 2) + '\n')
    console.log(`已写出变更清单：${path.relative(ROOT, path.resolve(args.json))}`)
  }
  if (args.plan) {
    writeFileSync(args.plan, JSON.stringify(buildPlan(changes, source), null, 2) + '\n')
    console.log(`已写出迁移计划：${path.relative(ROOT, path.resolve(args.plan))}`)
  }

  if (args.failOn) {
    const threshold = SEVERITY_ORDER[args.failOn]
    if (threshold === undefined) {
      console.error(`✖ --fail-on 取值无效：${args.failOn}（可选 docs|patch|minor|major）`)
      process.exit(2)
    }
    const hit = changes.filter((c) => SEVERITY_ORDER[c.severity] >= threshold)
    if (hit.length) {
      console.error(`\n✖ 命中 ${hit.length} 项 ${args.failOn} 及以上变更`)
      process.exit(1)
    }
  }
}

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (invokedDirectly) main()
