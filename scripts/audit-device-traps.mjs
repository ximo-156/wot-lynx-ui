#!/usr/bin/env node
/**
 * audit-device-traps — 扫描「Web 预览全绿、真机翻车」的已知 CSS/模板陷阱。
 *
 * 背景：Lynx 3.x 的 CSS 引擎对若干 Web 语义静默丢弃或按不同规则结算。
 * 这类缺陷在 Web 预览（DOM 渲染）里完全看不出来，只能靠真机复现，而
 * 106 个组件不可能每次都人工过一遍。本脚本把 CONVENTIONS §15 / §19
 * 「真机引擎行为差异清单」里已经踩过的坑固化成静态规则，一次扫全库。
 *
 * 规则来源与判据：
 *   visibility-hide  差异 #5  `visibility: hidden` 不生效 → 显隐必须 v-if
 *   ellipsis-clip    差异 #9  圆角容器上的 overflow:hidden 会把内容裁空
 *   current-paint    差异 #1  background/fill/stroke 不解析 currentColor
 *   inline-flex      §15     引擎只认 flex / none / linear
 *   display-block    §15     同上（flex 子项宽度会塌成 padding 宽）
 *   inline-min-width 差异 #8  内联 min-width 不生效 → 用内联 width
 *   flex-wrap-grid   差异 #6  多行 wrap 容器高度只按前两行结算
 *   em-unit          §3      Lynx 对 em 基准支持不稳定
 *   string-style     §19     字符串 :style 被 vue-lynx 静默丢弃
 *
 * 用法：
 *   node scripts/audit-device-traps.mjs            # 表格输出，有 error 时 exit 1
 *   node scripts/audit-device-traps.mjs --json     # 机器可读
 *   node scripts/audit-device-traps.mjs --warn-only  # 仅打印，不因 error 退出
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = join(root, 'packages/ui/src')
const ROOTS = ['primitives', 'components']

const args = new Set(process.argv.slice(2))
const asJson = args.has('--json')
const warnOnly = args.has('--warn-only')

/** 规则表：severity=error 的必须修，warn 的需人工判断 */
const RULES = {
  'visibility-hide': { severity: 'error', msg: 'visibility:hidden 在真机不生效 → 显隐改 v-if' },
  'ellipsis-clip': { severity: 'error', msg: 'overflow:hidden + text-overflow 会把文字裁空 → 用 text-maxline' },
  'current-paint': { severity: 'error', msg: 'background/fill/stroke 不解析 currentColor → 用具体令牌色' },
  'inline-flex': { severity: 'error', msg: 'inline-flex/inline-block 不被识别 → display:flex + flex-direction' },
  'display-block': { severity: 'warn', msg: 'display:block 被丢弃，flex 子项宽度会塌陷' },
  'inline-min-width': { severity: 'warn', msg: '内联 min-width 不生效 → 宽度确定时用 width' },
  'flex-wrap-grid': { severity: 'warn', msg: '多行 wrap 容器高度只按前两行结算 → 显式行结构' },
  'em-unit': { severity: 'warn', msg: 'em 单位在真机基准不稳定 → 用 px / calc 派生' },
  'calc-var-mul': { severity: 'error', msg: 'calc(N * var(--wot-n-*)) 在真机求值不可靠 → 令牌恒为 1px，直接写像素值' },
  'string-style': { severity: 'error', msg: '字符串 :style 被静默丢弃 → 对象语法' }
}

/** 去掉 SCSS 注释（行注释 + 块注释），保留行号 */
function stripScssComments(text) {
  const out = []
  let inBlock = false
  for (const line of text.split('\n')) {
    let result = ''
    let i = 0
    while (i < line.length) {
      if (inBlock) {
        const end = line.indexOf('*/', i)
        if (end === -1) { i = line.length; break }
        inBlock = false
        i = end + 2
        continue
      }
      const lineComment = line.indexOf('//', i)
      const blockComment = line.indexOf('/*', i)
      if (lineComment !== -1 && (blockComment === -1 || lineComment < blockComment)) {
        result += line.slice(i, lineComment)
        i = line.length
        break
      }
      if (blockComment !== -1) {
        result += line.slice(i, blockComment)
        inBlock = true
        i = blockComment + 2
        continue
      }
      result += line.slice(i)
      i = line.length
    }
    out.push(result)
  }
  return out
}

/** 去掉 vue 文件里的注释与 HTML 注释，避免误报 */
function stripVueComments(text) {
  return text
    .replace(/<!--[\s\S]*?-->/g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/^\s*\/\/.*$/gm, '')
}

/** 把 SCSS 按「最内层花括号块」切开，用于「同一规则块内」判定。
 *  必须取最内层：外层组件块包含所有嵌套，拿它判定会把不同选择器的
 *  overflow 与 text-overflow 拼成一条误报。 */
function innermostBlocks(lines) {
  const blocks = []
  const stack = []
  lines.forEach((line, index) => {
    const selector = line.split('{')[0].trim()
    const opens = (line.match(/{/g) || []).length
    const closes = (line.match(/}/g) || []).length
    if (opens > 0 && selector) {
      stack.push({ selector, lines: [], start: index + 1 })
    } else if (stack.length) {
      stack[stack.length - 1].lines.push(line)
    }
    for (let c = 0; c < closes; c++) {
      const block = stack.pop()
      if (block) blocks.push(block)
    }
    // 同一行既开又闭（单行规则）也要落块
    if (opens > 0 && closes > 0 && stack.length) {
      const block = stack.pop()
      if (block) blocks.push(block)
    }
  })
  return blocks
}

const findings = []

/** 豁免：源码里 `audit-ignore` 注释所在行及其下一行不参与判定。
 *  用于「保留 CSS 兜底但真机走另一条通路」的场景（例如 loading 的颜色
 *  由 JS 内联具体值，类里的 currentColor 只是 Web 兜底）。豁免必须写
 *  在代码旁，不能集中放白名单文件——集中白名单会随行号漂移而失效。 */
let ignoreLines = new Set()

function isIgnored(line) {
  return ignoreLines.has(line) || ignoreLines.has(line - 1)
}

function report(rule, file, line, snippet) {
  if (isIgnored(line)) return
  findings.push({
    rule,
    severity: RULES[rule].severity,
    file: relative(root, file).replace(/\\/g, '/'),
    line,
    snippet: snippet.trim().slice(0, 120)
  })
}

function auditScss(file) {
  const raw = readFileSync(file, 'utf8')
  ignoreLines = new Set()
  raw.split('\n').forEach((l, i) => { if (/audit-ignore/.test(l)) ignoreLines.add(i + 1) })
  const lines = stripScssComments(raw)

  // 逐行规则
  lines.forEach((line, index) => {
    const n = index + 1
    // backface-visibility 与显隐无关，不能用 `visibility: hidden` 判定
    if (/(?<!backface-)visibility\s*:\s*hidden/.test(line)) report('visibility-hide', file, n, line)
    if (/display\s*:\s*(inline-flex|inline-block)/.test(line)) report('inline-flex', file, n, line)
    if (/display\s*:\s*block/.test(line)) report('display-block', file, n, line)
    if (/(background|background-color|fill|stroke)\s*:\s*[^;]*currentColor/.test(line)) report('current-paint', file, n, line)
    if (/\b\d+(\.\d+)?em\b/.test(line) && !/--[\w-]+\s*:/.test(line)) report('em-unit', file, n, line)
    // 运行时 var 参与 calc 乘法（源码写作 calc(N * #{$n-1})，编译后是
    // calc(N * var(--wot-n-1, 1px))）：真机 CSS 引擎求值失败会让整条声明失效
    // （height 回落成内容高度，弹层塌高、列表被裁）。令牌恒为 1px，直接用像素值。
    if (/calc\([^)]*\*\s*(?:#\{\$n-|var\(--wot-n-)/.test(line)) report('calc-var-mul', file, n, line)
  })

  // 最内层规则块内：overflow:hidden 与 text-overflow 同时出现
  for (const block of innermostBlocks(lines)) {
    const body = block.lines.join('\n')
    if (/overflow\s*:\s*hidden/.test(body) && /text-overflow\s*:/.test(body)) {
      const hit = block.lines.findIndex((l) => /text-overflow\s*:/.test(l))
      report('ellipsis-clip', file, block.start + Math.max(0, hit), block.selector || '(block)')
    }
  }
}

function auditVue(file) {
  const raw = readFileSync(file, 'utf8')
  ignoreLines = new Set()
  raw.split('\n').forEach((l, i) => { if (/audit-ignore/.test(l)) ignoreLines.add(i + 1) })
  const lines = stripVueComments(raw).split('\n')
  lines.forEach((line, index) => {
    const n = index + 1
    // 只有「字面量字符串」才是违规：表达式以引号/反引号开头。
    // 对象字面量、函数调用（parseStyle / resolveStyle / itemStyle）、
    // 成员访问与索引（popover.arrowStyle.value / columnStyles[i]）都返回
    // 对象，属于正确用法，不能报。
    const styleMatch = line.match(/:style\s*=\s*"([^"]*)"/)
    if (styleMatch) {
      const expr = styleMatch[1].trim()
      if (/^['"`]/.test(expr)) report('string-style', file, n, line)
    }
    if (/'min-width'|"min-width"/.test(line)) report('inline-min-width', file, n, line)
  })
}

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    const stat = statSync(full)
    if (stat.isDirectory()) walk(full)
    else if (full.endsWith('.scss')) auditScss(full)
    else if (full.endsWith('.vue')) auditVue(full)
  }
}

for (const r of ROOTS) walk(join(SRC, r))

// flex-wrap 单独统计（按文件聚合，避免噪声）
const wrapFiles = []
for (const r of ROOTS) {
  const base = join(SRC, r)
  for (const comp of readdirSync(base)) {
    const dir = join(base, comp)
    if (!comp.startsWith('wd-') || !statSync(dir).isDirectory()) continue
    const scss = join(dir, 'index.scss')
    try {
      const lines = stripScssComments(readFileSync(scss, 'utf8'))
      lines.forEach((line, index) => {
        if (/flex-wrap\s*:\s*wrap/.test(line)) {
          report('flex-wrap-grid', scss, index + 1, line)
          wrapFiles.push(comp)
        }
      })
    } catch { /* 无 scss 的组件跳过 */ }
  }
}

findings.sort((a, b) => (a.severity === b.severity ? a.file.localeCompare(b.file) : a.severity === 'error' ? -1 : 1))

if (asJson) {
  console.log(JSON.stringify({
    total: findings.length,
    error: findings.filter((f) => f.severity === 'error').length,
    warn: findings.filter((f) => f.severity === 'warn').length,
    findings
  }, null, 2))
} else {
  let lastRule = ''
  for (const f of findings) {
    if (f.rule !== lastRule) {
      console.log(`\n── ${f.rule} [${f.severity}] — ${RULES[f.rule].msg}`)
      lastRule = f.rule
    }
    console.log(`   ${f.file}:${f.line}  ${f.snippet}`)
  }
  const errors = findings.filter((f) => f.severity === 'error').length
  const warns = findings.length - errors
  console.log(`\n合计 ${findings.length} 条（error ${errors} / warn ${warns}）`)
  if (new Set(wrapFiles).size) console.log(`涉及 flex-wrap 的组件：${[...new Set(wrapFiles)].join(' ')}`)
}

if (!warnOnly && findings.some((f) => f.severity === 'error')) process.exit(1)
