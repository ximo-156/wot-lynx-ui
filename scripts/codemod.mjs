#!/usr/bin/env node
/**
 * codemod：按迁移计划改写消费方模板中的属性名（ADR-019）。
 *
 * 输入是 `scripts/api-diff.mjs --plan <file>` 产出的计划 JSON，只执行其中
 * `rules` 部分——也就是「删掉一个 prop、新增一个 prop，且类型/默认值/可选值
 * 完全相同」这种**能证明等价**的改名。
 *
 * ## 为什么只做改名
 *
 * 其余破坏性变更（删 prop、删事件、类型收窄）都无法从 meta 推出「怎么改才对」：
 * 删掉的 prop 该换成什么、事件该迁到哪个，取决于使用者的业务语义。自动改写
 * 只会把编译错误变成静默的行为错误——那比不改更糟。这类变更由 api-diff 输出
 * 的 `manual` 指引交给人工。
 *
 * ## 作用范围
 *
 * 只改 `.vue` / `.html` 的模板区，**跳过 script 与 style 块**：`const legacy = 1`
 * 这样的局部变量与 prop 同名是常态，误改会让代码语义反转。render 函数（`.ts`
 * 里的 `h()`）不在支持范围——那是表达式而非属性，需要 AST。
 *
 * ## 用法
 *
 *   node scripts/codemod.mjs --plan codemod-plan.json --dir packages/demo/src
 *   node scripts/codemod.mjs --plan codemod-plan.json --dir . --write
 *
 * 默认 dry-run，只打印将要改的行；加 `--write` 才落盘。
 */
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

/** 不进入的目录：产物、依赖、版本库内部 */
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'coverage', '.temp', '.wot-ref', '.workbuddy-ai'])

const SUPPORTED_EXT = new Set(['.vue', '.html'])

// ---------------------------------------------------------------------------
// 文本扫描工具
// ---------------------------------------------------------------------------

/** 驼峰 → 短横线（模板里两种拼写都要认） */
export function kebabCase(name) {
  return name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()
}

/** 按引号切成「引号内 / 引号外」两类片段，只有引号外允许改写 */
function splitQuoted(text) {
  const segments = []
  let cur = ''
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
      if (ch === quote) {
        segments.push({ text: cur, quoted: true })
        cur = ''
        quote = null
      }
      continue
    }
    if (ch === '"' || ch === "'") {
      if (cur) segments.push({ text: cur, quoted: false })
      cur = ch
      quote = ch
      continue
    }
    cur += ch
  }
  if (cur) segments.push({ text: cur, quoted: Boolean(quote) })
  return segments
}

/** 从 `<` 起找标签结束的 `>`，跳过引号内的 `>`（属性值里可以有 `>`） */
function findTagEnd(text, start) {
  let quote = null
  for (let i = start + 1; i < text.length; i++) {
    const ch = text[i]
    if (quote) {
      if (ch === quote) quote = null
      continue
    }
    if (ch === '"' || ch === "'") {
      quote = ch
      continue
    }
    if (ch === '>') return i
  }
  return -1
}

/** `<script>` / `<style>` 区间，这些区间内的文本一律不动 */
function protectedRanges(text) {
  const ranges = []
  const re = /<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi
  let m
  while ((m = re.exec(text)) !== null) ranges.push([m.index, m.index + m[0].length])
  return ranges
}

/**
 * 把源码切成「可编辑 / 受保护」交替的片段。
 *
 * 受保护片段必须**留在输出里**：只返回可编辑片段再拼接，会把整段 `<script>`
 * 与 `<style>` 从文件里删掉——改一个属性名，顺带毁掉组件逻辑。
 */
function segmentsOf(text) {
  const ranges = protectedRanges(text)
  const segments = []
  let cursor = 0
  for (const [start, end] of ranges) {
    if (start > cursor) segments.push({ text: text.slice(cursor, start), editable: true })
    segments.push({ text: text.slice(start, end), editable: false })
    cursor = end
  }
  if (cursor < text.length) segments.push({ text: text.slice(cursor), editable: true })
  return segments
}

// ---------------------------------------------------------------------------
// 属性改写
// ---------------------------------------------------------------------------

/**
 * 把规则编译成正则。
 *
 * 边界 `(?=[\s=/>])` 是必需的：没有它，改名 `legacy` → `modern` 会把
 * `:legacy-suffix` 里的 `legacy` 也换掉，而 `:modern-suffix` 是个不存在的属性。
 *
 * 导出给测试用：测试必须走这条真实的编译路径，否则测的是测试自己的副本，
 * 生产代码里的边界写错也照样绿（本轮负向验证就踩到了这个坑）。
 */
export function compileRules(rules) {
  return rules.map((rule) => {
    const fromSpellings = [...new Set([rule.from, kebabCase(rule.from)])]
    const toSpellings = new Map([
      [rule.from, rule.to],
      [kebabCase(rule.from), kebabCase(rule.to)]
    ])
    return fromSpellings.map((from) => {
      const escaped = from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      return {
        // 捕获 1：前导空白；捕获 2：`: ` 或 `v-bind:` 前缀（改写时保留）
        regex: new RegExp(`(^|[\\s])((?::|v-bind:)?)(${escaped})(?=[\\s=/>])`, 'g'),
        to: toSpellings.get(from)
      }
    })
  }).flat()
}

/** 改写单个开标签内的属性名，返回 { text, count } */
export function rewriteTagAttributes(tagText, compiledRules) {
  let count = 0
  const segments = splitQuoted(tagText).map((seg) => {
    if (seg.quoted) return seg.text
    let text = seg.text
    for (const rule of compiledRules) {
      text = text.replace(rule.regex, (_m, lead, prefix) => {
        count++
        return `${lead}${prefix}${rule.to}`
      })
    }
    return text
  })
  return { text: segments.join(''), count }
}

/**
 * 改写一份源码。
 *
 * `rulesByComponent` 形如 `Map<'wd-alpha', compiledRules[]>`：只改目标组件的
 * 标签，避免同名 prop 在别的组件上被误改。
 */
export function rewriteSource(source, rulesByComponent) {
  let total = 0
  const out = segmentsOf(source).map((segment) => {
    if (!segment.editable) return segment.text
    const inner = segment.text
    let result = ''
    let i = 0
    while (i < inner.length) {
      const lt = inner.indexOf('<', i)
      if (lt < 0) {
        result += inner.slice(i)
        break
      }
      result += inner.slice(i, lt)
      const tagMatch = /^<([a-zA-Z][\w-]*)/.exec(inner.slice(lt, lt + 80))
      if (!tagMatch) {
        result += '<'
        i = lt + 1
        continue
      }
      const end = findTagEnd(inner, lt)
      if (end < 0) {
        result += inner.slice(lt)
        break
      }
      const raw = inner.slice(lt, end + 1)
      const rules = rulesByComponent.get(tagMatch[1])
      if (!rules) {
        result += raw
      } else {
        const rewritten = rewriteTagAttributes(raw, rules)
        result += rewritten.text
        total += rewritten.count
      }
      i = end + 1
    }
    return result
  })
  return { text: out.join(''), count: total }
}

// ---------------------------------------------------------------------------
// 文件遍历
// ---------------------------------------------------------------------------

function walk(dir, out) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue
      walk(path.join(dir, entry.name), out)
      continue
    }
    if (!entry.isFile()) continue
    if (SUPPORTED_EXT.has(path.extname(entry.name))) out.push(path.join(dir, entry.name))
  }
  return out
}

/** 逐行对比，只报变了的行（属性改名不改变行数） */
function changedLines(before, after) {
  const a = before.split('\n')
  const b = after.split('\n')
  const out = []
  const n = Math.max(a.length, b.length)
  for (let i = 0; i < n; i++) {
    if (a[i] !== b[i]) out.push({ line: i + 1, before: a[i] ?? '', after: b[i] ?? '' })
  }
  return out
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const args = { plan: null, dir: null, write: false }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--plan') args.plan = argv[++i]
    else if (a === '--dir') args.dir = argv[++i]
    else if (a === '--write') args.write = true
    else if (a === '--help' || a === '-h') args.help = true
    else throw new Error(`未知参数：${a}`)
  }
  return args
}

function usage() {
  return [
    '用法：node scripts/codemod.mjs --plan <file> --dir <path> [--write]',
    '',
    '选项：',
    '  --plan <file>   api-diff 产出的迁移计划 JSON',
    '  --dir <path>    要扫描的目录（递归，跳过 node_modules/dist 等）',
    '  --write         真正写盘；默认只打印将要改的行',
    '  -h, --help      显示本帮助'
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
  if (!args.plan || !args.dir) {
    console.error('✖ 缺少 --plan 或 --dir')
    console.error(usage())
    process.exit(2)
  }
  if (!existsSync(args.plan)) {
    console.error(`✖ 计划文件不存在：${args.plan}`)
    process.exit(2)
  }
  if (!existsSync(args.dir) || !statSync(args.dir).isDirectory()) {
    console.error(`✖ 目录不存在：${args.dir}`)
    process.exit(2)
  }

  const plan = JSON.parse(readFileSync(args.plan, 'utf8'))
  const rules = Array.isArray(plan.rules) ? plan.rules : []
  if (rules.length === 0) {
    console.log('计划里没有可自动改写的规则，无需处理。')
    if (Array.isArray(plan.manual) && plan.manual.length) {
      console.log(`另有 ${plan.manual.length} 项需人工确认，见计划文件的 manual 字段。`)
    }
    return
  }

  // 按组件分组，避免同名 prop 在别的组件上被误改
  const grouped = new Map()
  for (const rule of rules) {
    if (rule.kind !== 'rename-prop') continue
    if (!grouped.has(rule.component)) grouped.set(rule.component, [])
    grouped.get(rule.component).push({ from: rule.from, to: rule.to })
  }
  const rulesByComponent = new Map([...grouped].map(([tag, list]) => [tag, compileRules(list)]))

  const files = walk(path.resolve(args.dir), [])
  let hitFiles = 0
  let hitCount = 0

  for (const file of files) {
    const before = readFileSync(file, 'utf8')
    const { text: after, count } = rewriteSource(before, rulesByComponent)
    if (count === 0 || after === before) continue
    hitFiles++
    hitCount += count
    console.log(`\n${path.relative(ROOT, file) || file}  （${count} 处）`)
    for (const line of changedLines(before, after)) {
      console.log(`  L${line.line}  - ${line.before.trim()}`)
      console.log(`  L${line.line}  + ${line.after.trim()}`)
    }
    if (args.write) writeFileSync(file, after)
  }

  console.log(
    `\n扫描 ${files.length} 个文件，命中 ${hitFiles} 个 / ${hitCount} 处。` +
      (args.write ? '已写入。' : '未写入（加 --write 应用）。')
  )
  if (hitFiles === 0) console.log('未发现需要改写的用法。')
}

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (invokedDirectly) main()
