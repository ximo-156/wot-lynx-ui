#!/usr/bin/env node
/**
 * compare-props.mjs — 对照 wot-ui 2.3.2 参考源，列出本地组件 props 差异。
 *
 * 用法：node scripts/compare-props.mjs [组件目录...]
 * 参考源位置：.wot-ref/src-2.3.2/components（本地参考副本，不入库）
 */
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs'
import { join, basename } from 'node:path'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const REF = join(ROOT, '.wot-ref/src-2.3.2/components')
const LOCAL = join(ROOT, 'packages/ui/src/components')

/**
 * 从 types.ts 中提取 props 定义：{ name, default }
 * 支持形式：
 *   name: makeStringProp('x') / makeNumberProp(1) / makeBooleanProp(true)
 *   name: { type: X, default: y }
 *   name: String / Number / Boolean / Array / Object
 *   name: makeRequiredProp(String)
 */
function parseProps(file) {
  const src = readFileSync(file, 'utf8')
  const props = {}
  // 去掉注释，避免误匹配
  const clean = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')
  // 顶层对象定义：export const xxxProps = { ... }
  const objMatch = clean.match(/export\s+const\s+\w*[Pp]rops\w*\s*(?::\s*[\w<>\[\]|{}.,\s]+)?=\s*\{/)
  if (!objMatch) return props
  const start = objMatch.index + objMatch[0].length
  // 括号配平找到对象结尾
  let depth = 1
  let i = start
  while (i < clean.length && depth > 0) {
    const ch = clean[i]
    if (ch === '{') depth++
    else if (ch === '}') depth--
    i++
  }
  const body = clean.slice(start, i - 1)
  // 逐行解析 key: value
  let depth2 = 0
  let cur = ''
  const entries = []
  for (const ch of body) {
    if (ch === '{' || ch === '(' || ch === '[') depth2++
    if (ch === '}' || ch === ')' || ch === ']') depth2--
    if (ch === ',' && depth2 === 0) {
      entries.push(cur)
      cur = ''
    } else {
      cur += ch
    }
  }
  if (cur.trim()) entries.push(cur)
  for (const entry of entries) {
    const m = entry.match(/^\s*['"]?([\w$-]+)['"]?\s*:\s*([\s\S]+)$/)
    if (!m) continue
    const name = m[1]
    let value = m[2].trim()
    let def = '<none>'
    const dm = value.match(/default\s*:\s*([^,}]+)/)
    if (dm) {
      def = dm[1].trim()
    } else {
      const fm = value.match(/make(?:String|Number|Boolean|Array|Object)Prop(?:<[^>]*>)?\(\s*([^)]*?)\s*\)/)
      if (fm) def = fm[1].trim() || '<none>'
      else if (/^String$|^Number$|^Boolean$|^Array$|^Object$/.test(value)) def = '<none>'
      else def = '?'
    }
    props[name] = def
  }
  return props
}

const args = process.argv.slice(2)
let dirs = args.length
  ? args
  : readdirSync(LOCAL).filter((d) => existsSync(join(LOCAL, d, 'types.ts')))

let totalDiffs = 0
const report = []
for (const dir of dirs) {
  const localTypes = join(LOCAL, dir, 'types.ts')
  const refTypes = join(REF, dir, 'types.ts')
  if (!existsSync(localTypes) || !existsSync(refTypes)) {
    report.push({ dir, missing: true })
    continue
  }
  const localProps = parseProps(localTypes)
  const refProps = parseProps(refTypes)
  const diffs = []
  const allKeys = new Set([...Object.keys(localProps), ...Object.keys(refProps)])
  for (const k of allKeys) {
    const l = localProps[k]
    const r = refProps[k]
    if (l === undefined) diffs.push(`  + 缺少 prop: ${k} (ref default: ${r})`)
    else if (r === undefined) diffs.push(`  - 多余 prop: ${k} (local default: ${l})`)
    else if (l !== r) diffs.push(`  ~ 默认值不同: ${k} local=${l} ref=${r}`)
  }
  if (diffs.length) {
    totalDiffs += diffs.length
    report.push({ dir, diffs })
  }
}

for (const r of report) {
  if (r.missing) {
    console.log(`\n### ${r.dir} — types.ts 缺失（本地或参考）`)
    continue
  }
  console.log(`\n### ${r.dir}`)
  console.log(r.diffs.join('\n'))
}
console.log(`\n总计差异行数: ${totalDiffs}`)
