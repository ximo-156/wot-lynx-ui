#!/usr/bin/env node
/**
 * style-parity.mjs — 组件样式与 wot-ui 2.3.2 的客观对齐度审计。
 *
 * 做法：
 *  1. 用 sass 编译参考源组件 SCSS（.wot-ref/src-2.3.2/components/<c>/index.scss）
 *     与本地组件产物（packages/ui/src/components/<c>/index.css）；
 *  2. 归一化：
 *     - 剔除参考源中的伪元素规则（::before / ::after —— Lynx 无伪元素，
 *       端口已按 CONVENTIONS 改写为真实元素 / border，属于既定适配）；
 *     - `:deep()` 直接删除（Lynx 无 shadow DOM）；
 *     - 参考源 hover-class `--active` 映射为 `:active`（Lynx 按压态写法）；
 *     - var(--x, fallback) 递归解析为最终值（令牌表取自 theme/index.css）；
 *  3. 按选择器对比 声明（属性: 值） 集合，输出缺失 / 多余 / 值不一致清单。
 *
 * 用法：node scripts/style-parity.mjs [组件目录...]
 */
import { createRequire } from 'node:module'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, basename, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const REF = join(ROOT, '.wot-ref/src-2.3.2/components')
const LOCAL = join(ROOT, 'packages/ui/src/components')
const THEME_CSS = join(ROOT, 'packages/ui/src/styles/theme/index.css')

const require = createRequire(join(ROOT, 'packages/ui/package.json'))
const sass = require('sass')

// ---------------------------------------------------------------------------
// 令牌表：从 theme/index.css 解析 --wot-* 变量（page 规则 + 主题类规则）
// ---------------------------------------------------------------------------
function loadTokenTable() {
  const css = readFileSync(THEME_CSS, 'utf8')
  const table = {}
  // 所有 :root/page/.wd-root-portal 上的原始刻度 + 亮色语义（page 规则，亮色在后覆盖）
  const re = /([^{}]+)\{([^{}]*)\}/g
  let m
  while ((m = re.exec(css))) {
    const sel = m[1].trim()
    // 只取不含 wot-theme-dark 的规则（亮色基准；暗色值由主题类决定，默认按亮色比对）
    if (sel.includes('wot-theme-dark')) continue
    const body = m[2]
    const declRe = /(--[\w-]+)\s*:\s*([^;]+)/g
    let d
    while ((d = declRe.exec(body))) {
      table[d[1]] = d[2].trim()
    }
  }
  return table
}

const TOKENS = loadTokenTable()

/** 递归解析 var(--x, fallback) */
function resolveValue(value, depth = 0) {
  if (depth > 12) return value
  let out = value
  let guard = 0
  while (out.includes('var(') && guard++ < 12) {
    out = out.replace(/var\((--[\w-]+)(?:,\s*([^()]*(?:\([^()]*\)[^()]*)*))?\)/g, (_, name, fallback) => {
      if (TOKENS[name] !== undefined) return TOKENS[name]
      if (fallback !== undefined) return resolveValue(fallback, depth + 1)
      return `«${name}»`
    })
  }
  return out.trim()
}

// ---------------------------------------------------------------------------
// CSS 规则拆分
// ---------------------------------------------------------------------------
function parseRules(css) {
  const rules = []
  // 去掉 keyframes 与注释，简化处理（组件动画单独人工核对）
  css = css.replace(/\/\*[\s\S]*?\*\//g, '')
  const re = /([^{}]+)\{([^{}]*)\}/g
  let m
  while ((m = re.exec(css))) {
    const selector = m[1].trim()
    if (selector.startsWith('@')) continue
    const body = m[2].trim()
    if (!body) continue
    const decls = {}
    for (const decl of body.split(';')) {
      const idx = decl.indexOf(':')
      if (idx === -1) continue
      const prop = decl.slice(0, idx).trim()
      const val = decl.slice(idx + 1).trim()
      if (!prop || !val) continue
      decls[prop] = val
    }
    if (Object.keys(decls).length) rules.push({ selector, decls })
  }
  return rules
}

/** 选择器归一化 */
function normSelector(sel) {
  let s = sel
  // :deep(X) 解包为 X（Lynx 无 shadow DOM，:deep() 包裹无意义）
  s = s.replace(/:deep\(([^()]*)\)/g, '$1')
  s = s.replace(/\s*:deep\(\)\s*/g, ' ')
  // hover-class 活动态 → :active
  s = s.replace(/\.wd-([\w-]+)--active/g, ':active')
  // wot-ui 自有过渡类名为 Vue2 风（-enter），vue-lynx Transition 按 Vue3
  // 约定下发 -enter-from；仅对恰好为 -enter（非 -enter-active/-enter-to）的
  // 片段做映射，便于与本地产物比对。
  s = s.replace(/-enter(?=$|,)/g, '-enter-from')
  s = s.replace(/\s+/g, ' ').trim()
  return s
}

/** Web 专有属性：Lynx 引擎不识别，端口既定剔除 */
const WEB_ONLY_PROPS = new Set([
  'outline', '-webkit-appearance', '-moz-osx-font-smoothing', '-webkit-font-smoothing',
  'cursor', 'user-select', 'pointer-events', '-webkit-tap-highlight-color',
  '-webkit-box-orient', 'appearance', 'float', 'vertical-align'
])

/** 该规则是否属于 Lynx 既定适配而剔除（伪元素相关） */
function isPseudoRule(sel) {
  return /::?(before|after)\b/.test(sel)
}

function compareComponent(dir) {
  const refPath = join(REF, dir, 'index.scss')
  const localPath = join(LOCAL, dir, 'index.css')
  if (!existsSync(refPath)) return { dir, error: '参考源缺失' }
  if (!existsSync(localPath)) return { dir, error: '本地 index.css 缺失' }

  let refCss
  try {
    refCss = sass.compile(refPath, { style: 'compressed' }).css
  } catch (e) {
    return { dir, error: `参考源编译失败: ${e.message.split('\n')[0]}` }
  }
  const localCss = readFileSync(localPath, 'utf8')

  const refRules = parseRules(refCss)
    .filter((r) => !isPseudoRule(r.selector))
    .map((r) => ({ ...r, selector: normSelector(r.selector) }))
  const localRules = parseRules(localCss).map((r) => ({ ...r, selector: normSelector(r.selector) }))

  // 参考源按选择器聚合（本地一条规则一个选择器）
  const refMap = new Map()
  for (const r of refRules) {
    if (!refMap.has(r.selector)) refMap.set(r.selector, {})
    Object.assign(refMap.get(r.selector), r.decls)
  }
  const localMap = new Map()
  for (const r of localRules) {
    if (!localMap.has(r.selector)) localMap.set(r.selector, {})
    Object.assign(localMap.get(r.selector), r.decls)
  }

  const missingSelectors = []
  const valueDiffs = []
  const varCovered = []
  let refDeclCount = 0
  let matchedDeclCount = 0

  // 本地全部自定义属性声明（用于 --active 规则的 var 覆盖判定）
  const localVarDecls = new Set()
  for (const r of localRules) {
    for (const [prop, val] of Object.entries(r.decls)) {
      if (prop.startsWith('--')) localVarDecls.add(`${prop}: ${resolveValue(val)}`)
    }
  }

  for (const [sel, decls] of refMap) {
    // --active（hover-class）规则：本地以 CSS 变量驱动时逐值核对覆盖
    const isActiveRule = sel.includes(':active')
    const local = localMap.get(sel)
    if (!local) {
      if (isActiveRule) {
        let allCovered = true
        for (const [prop, val] of Object.entries(decls)) {
          if (WEB_ONLY_PROPS.has(prop)) continue
          refDeclCount++
          const rv = resolveValue(val)
          if (!localVarDecls.has(`--wot-${dir.slice(3)}-x: ${rv}`) && ![...localVarDecls].some((d) => d.endsWith(`: ${rv}`))) {
            allCovered = false
          } else {
            matchedDeclCount++
          }
        }
        if (allCovered) varCovered.push(sel)
        else missingSelectors.push(sel)
        continue
      }
      missingSelectors.push(sel)
      refDeclCount += Object.keys(decls).length
      continue
    }
    for (const [prop, val] of Object.entries(decls)) {
      if (WEB_ONLY_PROPS.has(prop)) continue
      refDeclCount++
      const rv = resolveValue(val)
      const lv = local[prop] !== undefined ? resolveValue(local[prop]) : undefined
      if (lv === undefined) {
        valueDiffs.push(`  ~ ${sel} { ${prop}: <缺失> }  ref=${rv}`)
      } else if (rv !== lv) {
        valueDiffs.push(`  ~ ${sel} { ${prop}: ${lv} }  ref=${rv}`)
      } else {
        matchedDeclCount++
      }
    }
  }

  // 本地多出的声明（仅统计参考源没有的选择器）
  const extraSelectors = []
  for (const sel of localMap.keys()) {
    if (!refMap.has(sel)) extraSelectors.push(sel)
  }

  return {
    dir,
    refDeclCount,
    matchedDeclCount,
    missingSelectors,
    valueDiffs,
    varCovered,
    extraSelectors,
    parity: refDeclCount ? (matchedDeclCount / refDeclCount * 100).toFixed(1) + '%' : 'n/a'
  }
}

const args = process.argv.slice(2).filter((a) => !a.startsWith('--'))
const dirs = args.length
  ? args
  : readdirSync(LOCAL).filter((d) => statSync(join(LOCAL, d)).isDirectory() && existsSync(join(REF, d, 'index.scss')))

const results = []
for (const dir of dirs) {
  results.push(compareComponent(dir))
}

// 汇总
const withParity = results.filter((r) => r.parity && r.parity !== 'n/a')
withParity.sort((a, b) => parseFloat(b.parity) - parseFloat(a.parity))
console.log('组件 | 声明匹配率 | 缺失选择器数 | 值差异数 | 本地多余选择器数 | var覆盖active规则数')
console.log('--- | --- | --- | --- | ---')
for (const r of withParity) {
  console.log(`${r.dir} | ${r.parity} | ${r.missingSelectors.length} | ${r.valueDiffs.length} | ${r.extraSelectors.length} | ${r.varCovered.length}`)
}
const errors = results.filter((r) => r.error)
for (const e of errors) console.log(`${e.dir} | ERROR: ${e.error}`)

const avg = withParity.length
  ? (withParity.reduce((s, r) => s + parseFloat(r.parity), 0) / withParity.length).toFixed(1)
  : '0'
console.log(`\n平均声明匹配率: ${avg}%  组件数: ${withParity.length}`)

// 明细（传入 --detail 时打印）
if (process.argv.includes('--detail')) {
  for (const r of results) {
    if (r.error) continue
    if (r.missingSelectors.length || r.valueDiffs.length) {
      console.log(`\n### ${r.dir} (${r.parity})`)
      r.missingSelectors.slice(0, 20).forEach((s) => console.log(`  - 缺失选择器: ${s}`))
      r.valueDiffs.slice(0, 30).forEach((d) => console.log(d))
      if (r.valueDiffs.length > 30) console.log(`  ... 其余 ${r.valueDiffs.length - 30} 条值差异`)
    }
  }
}
