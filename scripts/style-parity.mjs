#!/usr/bin/env node
/**
 * wot-ui 2.3.2 非主题 CSS 审计。它只比较声明，不是截图/真机视觉证明。
 * 使用 PostCSS AST，单规则 --csslib-* 展开与各自默认亮色 token 表；
 * 不把 presets 当默认，不把关键帧选择器当普通规则，也不静默吞伪元素差异。
 * node scripts/style-parity.mjs [wd-* ...] [--detail] [--json] [--viewport=375]
 */
import { createRequire } from 'node:module'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { dirname, resolve, join } from 'node:path'
import { fileURLToPath } from 'node:url'
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(join(ROOT, 'packages/ui/package.json'))
const sass = require('sass')
const postcss = require('postcss')
const REF = join(ROOT, '.wot-ref/src-2.3.2')
const LOCAL = join(ROOT, 'packages/ui/src')
const viewport = Number(process.argv.find((arg) => arg.startsWith('--viewport='))?.split('=')[1]) || 375

export function parseRules(css) {
  const rules = []
  postcss.parse(css).walkRules((rule) => {
    let parent = rule.parent
    const conditions = []
    while (parent && parent.type !== 'root') {
      if (parent.type === 'atrule') {
        if (/keyframes$/i.test(parent.name)) return
        conditions.unshift(`@${parent.name} ${parent.params}`)
      }
      parent = parent.parent
    }
    const declarations = {}
    rule.nodes?.forEach((node) => { if (node.type === 'decl') declarations[node.prop] = node.value })
    for (const selector of postcss.list.comma(rule.selector)) rules.push({ selector, declarations, condition: conditions.join(' / ') })
  })
  return rules
}

/** 括号/引号配平，支持任意嵌套 fallback，不用脆弱的正则取最外 var。 */
export function resolveCssValue(value, variables, stack = []) {
  let output = ''
  for (let offset = 0; offset < value.length;) {
    const start = value.indexOf('var(', offset)
    if (start < 0) { output += value.slice(offset); break }
    output += value.slice(offset, start)
    let end = start + 4, depth = 1, quote = ''
    for (; end < value.length; end++) {
      const char = value[end]
      if (quote) { if (char === quote && value[end - 1] !== '\\') quote = ''; continue }
      if (char === '"' || char === "'") quote = char
      else if (char === '(') depth++
      else if (char === ')' && --depth === 0) break
    }
    if (depth !== 0) { output += value.slice(start); break }
    const body = value.slice(start + 4, end)
    let comma = -1, innerDepth = 0
    for (let i = 0; i < body.length; i++) {
      if (body[i] === '(') innerDepth++
      else if (body[i] === ')') innerDepth--
      else if (body[i] === ',' && innerDepth === 0) { comma = i; break }
    }
    const name = (comma < 0 ? body : body.slice(0, comma)).trim()
    const fallback = comma < 0 ? undefined : body.slice(comma + 1).trim()
    const raw = variables[name]
    if (raw !== undefined && !stack.includes(name)) output += resolveCssValue(raw, variables, [...stack, name])
    else if (fallback !== undefined) output += resolveCssValue(fallback, variables, stack)
    else output += `UNRESOLVED(${name})`
    offset = end + 1
  }
  return output.trim()
}

function themeTokens(dir) {
  const source = join(dir, 'styles/theme/index.scss')
  if (!existsSync(source)) return {}
  const vars = {}
  for (const rule of parseRules(sass.compile(source, { style: 'compressed' }).css)) {
    // Only default page/raw scales/light semantics, never preset or dark overrides.
    if (rule.condition || (rule.selector !== 'page' && rule.selector !== '.wot-theme-light')) continue
    Object.entries(rule.declarations).forEach(([key, value]) => { if (key.startsWith('--')) vars[key] = value })
  }
  return vars
}
const refTokens = themeTokens(REF)
const localTokens = themeTokens(LOCAL)

function selector(value) {
  return value.replace(/:deep\(([^()]*)\)/g, '$1').replace(/\s*:deep\(\)\s*/g, ' ')
    .replace(/-enter(?=$|\s|,)/g, '-enter-from').replace(/\s+/g, ' ').trim()
}
const colorProperty = /^(?:color|background(?:-color)?|(?:border(?:-(?:top|right|bottom|left))?|outline|text-decoration)-(?:color)|fill|stroke|caret-color)$/
const webOnly = new Set(['cursor', 'outline', 'user-select', 'appearance', '-webkit-appearance', '-webkit-tap-highlight-color', '-webkit-font-smoothing', '-moz-osx-font-smoothing'])
function normalizeValue(value) {
  return value.toLowerCase().replace(/!important/g, '').replace(/(-?\d*\.?\d+)rpx\b/g, (_, number) => `${Number(number) * viewport / 750}px`)
    .replace(/(-?\d*\.?\d+)(px|em|rem|s|ms)\b/g, (_, number, unit) => Number(number) === 0 ? '0' : `${Number(number)}${unit}`)
    .replace(/#[\da-f]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\)|\b(?:transparent|currentcolor|white|black)\b/g, 'COLOR')
    .replace(/\s*([(),/*])\s*/g, '$1').replace(/\s+/g, ' ').trim()
}
function nonThemeDeclarations(declarations, tokens) {
  const vars = { ...tokens, ...Object.fromEntries(Object.entries(declarations).filter(([key]) => key.startsWith('--'))) }
  const result = {}
  for (const [property, raw] of Object.entries(declarations)) {
    if (property.startsWith('--') || colorProperty.test(property) || webOnly.has(property)) continue
    const value = normalizeValue(resolveCssValue(raw, vars))
    if ((property === 'background-image' && /gradient\(/.test(value)) || property === 'mask' || property === '-webkit-mask') {
      result[property] = value // kept as a platform candidate, not counted as equal color.
    } else if (property === 'padding' || property === 'margin') {
      const pieces = postcss.list.space(value)
      if (pieces.length <= 4) {
        const [top, right = top, bottom = top, left = right] = pieces
        for (const [side, part] of Object.entries({ top, right, bottom, left })) result[`${property}-${side}`] = part
      } else result[property] = value
    } else result[property] = value
  }
  return result
}
function ruleMap(rules, tokens) {
  const map = new Map()
  for (const rule of rules) {
    const key = `${rule.condition ? rule.condition + ' :: ' : ''}${selector(rule.selector)}`
    const aggregate = map.get(key) || {}
    Object.assign(aggregate, rule.declarations)
    map.set(key, aggregate)
  }
  return new Map([...map].map(([key, declarations]) => [key, nonThemeDeclarations(declarations, tokens)]))
}
export function auditComponent(name) {
  const refPath = join(REF, 'components', name, 'index.scss')
  const localPath = join(LOCAL, 'components', name, 'index.css')
  if (!existsSync(refPath) || !existsSync(localPath)) return { name, error: 'Missing reference SCSS or generated local CSS' }
  const reference = ruleMap(parseRules(sass.compile(refPath, { style: 'compressed' }).css), refTokens)
  const local = ruleMap(parseRules(readFileSync(localPath, 'utf8')), localTokens)
  const differences = [], unmatchedRules = [], structuralRules = []
  let compared = 0, matched = 0
  for (const [key, declarations] of reference) {
    if (/::?(?:before|after)\b|:(?:nth|first|last|only)-/.test(key)) {
      structuralRules.push({ selector: key, declarations, reason: 'Requires real-element/index-class mapping; not verified by selector matching' })
      continue
    }
    const actual = local.get(key)
    if (!actual) { if (Object.keys(declarations).length) unmatchedRules.push({ selector: key, declarations }); continue }
    for (const [property, expected] of Object.entries(declarations)) {
      compared++
      if (actual[property] === expected) matched++
      else differences.push({ selector: key, property, expected, actual: actual[property] ?? '<missing>' })
    }
  }
  return { name, compared, matched, differences, unmatchedRules, structuralRules,
    extraRules: [...local.keys()].filter((key) => !reference.has(key)) }
}

const isCli = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isCli) {
  const names = process.argv.slice(2).filter((arg) => !arg.startsWith('--'))
  const components = names.length ? names : readdirSync(join(LOCAL, 'components')).filter((name) => existsSync(join(REF, 'components', name, 'index.scss'))).sort()
  const results = components.map((name) => {
    try { return auditComponent(name) } catch (error) { return { name, error: error.message } }
  })
  const report = { version: '2.3.2', viewportWidth: viewport,
    scope: 'Non-theme declaration audit only; not a visual equivalence or native rendering claim',
    tokenResolution: 'Default light per-source tokens + same-rule CSS variables; keyframes excluded; structural adaptations retained for review',
    components: results }
  if (process.argv.includes('--json')) console.log(JSON.stringify(report, null, 2))
  else {
    console.log('组件 | 同选择器匹配声明/比较声明 | 值差异 | 待映射结构规则 | 未命中规则')
    for (const result of results) console.log(result.error ? `${result.name} | ERROR: ${result.error}`
      : `${result.name} | ${result.matched}/${result.compared} | ${result.differences.length} | ${result.structuralRules.length} | ${result.unmatchedRules.length}`)
    console.log(`\n审计 ${results.length} 个有官方 SCSS 的组件。数值仅为声明匹配，不是视觉对齐率。`)
    if (process.argv.includes('--detail')) for (const result of results) {
      if (result.error) continue
      console.log(`\n### ${result.name}`)
      for (const item of result.differences) console.log(`~ ${item.selector} { ${item.property}: ${item.actual} } expected=${item.expected}`)
      for (const item of result.unmatchedRules) console.log(`? ${item.selector}`)
      for (const item of result.structuralRules) console.log(`STRUCTURAL ${item.selector}`)
    }
  }
  if (results.some((result) => result.error)) process.exitCode = 1
}
