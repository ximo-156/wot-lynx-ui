#!/usr/bin/env node
/**
 * design-audit.mjs — 设计规范静态审计器
 *
 * 与 review-lint.mjs 的分工：
 *   review-lint   管「能不能跑」——Lynx 平台约束、架构依赖方向、事件注册表。
 *   design-audit  管「好不好看、对不对齐」——令牌闭环、尺度一致性、无障碍下限。
 *
 * 两者都不该互相包含：把设计规则塞进 review-lint 会让「平台约束」和「视觉一致性」
 * 混成一个失败信号，改一个色值要跑一遍架构检查。
 *
 * 用法：
 *   node scripts/design-audit.mjs                 # 全量，控制台分组报告
 *   node scripts/design-audit.mjs --json          # 机器可读（CI / 看板）
 *   node scripts/design-audit.mjs --strict        # 只对「新增」error 退出码 1
 *   node scripts/design-audit.mjs --only D001,D011
 *   node scripts/design-audit.mjs --update-baseline  # 把当前问题冻结为存量
 *
 * 规则编号稳定，报告与 ADR 引用编号，不引用文案。
 *
 * 基线（baseline）说明：
 *   指纹 = rule|file|message，**不含行号**——行号会随无关改动漂移，
 *   基线一旦跟行号绑死，每次格式化都要重签一遍。
 *   代价是「同一文件同一规则同一取值」只记一条：文件里再多一个 12px 不会被拦。
 *   这是刻意的取舍：基线管的是「不要变多」，不是「精确计数」。
 */

import { readFileSync, readdirSync, statSync, existsSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import process from 'node:process'

const ROOT = process.cwd()
const SRC = 'packages/ui/src'
const THEME = 'packages/ui/src/styles/theme'
const SCAN = [`${SRC}/components`, `${SRC}/primitives`]
const BASELINE_FILE = 'docs/design/audit-baseline.json'

// ---------------------------------------------------------------------------
// 规则元数据
// ---------------------------------------------------------------------------

/**
 * severity:
 *   error —— 已经产生可见缺陷，或违反无障碍下限，必须修。
 *   warn  —— 令牌纪律问题，当前渲染正确但会让主题/暗色/定制失效。
 */
const RULES = {
  D001: { severity: 'error', title: '引用了未声明的令牌', why: 'var() 回退链全空 → 整条声明在计算值阶段失效（border 直接不渲染）' },
  D002: { severity: 'warn', title: '硬编码颜色', why: '不随主题/暗色/品牌覆盖变化' },
  D003: { severity: 'warn', title: '硬编码尺寸', why: '绕开 n-* 刻度，无法整体缩放' },
  D004: { severity: 'warn', title: '字号不在字阶上', why: '字阶外的字号会破坏垂直韵律' },
  D005: { severity: 'warn', title: '字重不在字重表上', why: '500 不在令牌表内，换字体后回退到最近字重' },
  D006: { severity: 'warn', title: '硬编码圆角', why: '圆角应走 radius-* 阶梯' },
  D007: { severity: 'warn', title: '阴影未走令牌', why: '同一套三层阴影在三处逐字复制，改不动' },
  D008: { severity: 'warn', title: '动效未走令牌', why: '时长/缓动各写各的，节奏不统一' },
  D009: { severity: 'warn', title: 'transition: all', why: '会连带动画无关属性，掉帧来源' },
  D010: { severity: 'warn', title: '禁用态透明度不一致', why: '有的 0.4 有的 0.5，同一屏里禁用观感不同' },
  D011: { severity: 'error', title: '触控目标小于 44px', why: '低于 iOS HIG 44pt / Material 48dp 下限，误触率高' },
  D012: { severity: 'error', title: '文字对比度不达 AA', why: '正文需 4.5:1，大字号需 3:1（WCAG 2.1）' }
}

// 字阶（由 theme/base/typography.scss 反推，含 2 个历史遗留档位）
const FONT_SCALE = new Set([9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 20, 24, 26, 28, 32, 34])
// 字重表（theme/base/font.scss 只有 100/200/300/400/600/700）
const WEIGHT_SCALE = new Set([100, 200, 300, 400, 600, 700])
// 圆角阶梯（px）
const RADIUS_SCALE = new Set([0, 2, 4, 8, 12, 16, 20])

/** 触控目标：只登记「默认可点」的控件，避免把 badge/loading 误判 */
const TOUCH_TARGETS = [
  { file: 'primitives/wd-button/index.scss', token: '--wot-button-height-mini', expect: 28 },
  { file: 'primitives/wd-button/index.scss', token: '--wot-button-height-small', expect: 32 },
  { file: 'primitives/wd-button/index.scss', token: '--wot-button-height-medium', expect: 40 },
  { file: 'primitives/wd-button/index.scss', token: '--wot-button-height-large', expect: 44 },
  { file: 'components/wd-search/index.scss', token: '--wot-search-input-height', expect: 36 },
  { file: 'components/wd-input-number/index.scss', token: '--wot-input-number-input-height', expect: 28 },
  { file: 'components/wd-navbar-capsule/index.scss', token: '--wot-navbar-capsule-height', expect: 32 },
  { file: 'components/wd-navbar/index.scss', token: '--wot-navbar-height', expect: 44 },
  { file: 'components/wd-tabbar/index.scss', token: '--wot-tabbar-height', expect: 50 }
]

/** 对比度检查对：按令牌名取色，令牌改了检查自动跟随 */
const CONTRAST_PAIRS = [
  { name: 'text-main / 白', fg: 'text-main', bg: 'base-white', need: 4.5 },
  { name: 'text-secondary / 白', fg: 'text-secondary', bg: 'base-white', need: 4.5 },
  { name: 'text-secondary / 页面底', fg: 'text-secondary', bg: 'filled-bottom', need: 4.5 },
  { name: 'text-auxiliary / 白', fg: 'text-auxiliary', bg: 'base-white', need: 4.5 },
  { name: 'text-placeholder / 白', fg: 'text-placeholder', bg: 'base-white', need: 4.5 },
  { name: '白字 / primary-6', fg: 'base-white', bg: 'primary-6', need: 4.5 },
  { name: '白字 / primary-7', fg: 'base-white', bg: 'primary-7', need: 4.5 },
  { name: '白字 / danger-main', fg: 'base-white', bg: 'danger-main', need: 4.5 },
  { name: '白字 / success-main', fg: 'base-white', bg: 'success-main', need: 4.5 },
  { name: '白字 / warning-main', fg: 'base-white', bg: 'warning-main', need: 4.5 }
]

// ---------------------------------------------------------------------------
// 工具
// ---------------------------------------------------------------------------

function walk(dir, out = []) {
  if (!existsSync(dir)) return out
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (p.endsWith('.scss')) out.push(p)
  }
  return out
}

/** 去掉注释但保留行号 */
function stripComments(line) {
  return line.replace(/\/\/.*$/, '').replace(/\/\*.*?\*\//g, '')
}

function luminance(hex) {
  const ch = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
  const [r, g, b] = ch.map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrast(a, b) {
  const [l1, l2] = [luminance(a), luminance(b)]
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)
}

/**
 * 从主题 SCSS 解析 `--wot-x` 的最终色值。
 *
 * 对比度检查必须跟着令牌走：把色值写死在脚本里，改令牌时检查不会跟着变，
 * 就会得出「已修好但仍报错」或「没修好却通过」两种都更糟的结论。
 * 合并顺序 = 原始刻度 → 语义层（light 覆盖），与运行时层叠一致。
 */
function buildColorResolver() {
  const order = ['base/color.scss', 'base/index.scss', 'light.scss']
  const map = new Map()
  for (const rel of order) {
    const p = join(THEME, rel)
    if (!existsSync(p)) continue
    for (const m of readFileSync(p, 'utf8').matchAll(/(--wot-[a-z0-9_-]+)\s*:\s*([^;]+);/g)) {
      map.set(m[1], m[2].trim())
    }
  }
  return function resolve(name, depth = 0) {
    const raw = map.get(`--wot-${name}`)
    if (!raw || depth > 12) return ''
    const ref = /^var\(\s*(--wot-[a-z0-9_-]+)\s*\)$/.exec(raw)
    if (ref) return resolve(ref[1].slice(6), depth + 1)
    const hex = /^#([0-9a-fA-F]{3,8})$/.exec(raw)
    if (!hex) return ''
    const v = hex[1]
    // 统一成 6 位：8 位时丢弃 alpha（对比度只算不透明部分）
    const six = v.length === 8 ? v.slice(0, 6) : v.length === 4 ? v.slice(0, 3) : v
    return `#${six.length === 3 ? six.split('').map((c) => c + c).join('') : six}`.toUpperCase()
  }
}

// ---------------------------------------------------------------------------
// 收集
// ---------------------------------------------------------------------------

const themeFiles = walk(THEME)
const globalTokens = new Set()
for (const f of themeFiles) {
  for (const m of readFileSync(f, 'utf8').matchAll(/(--wot-[a-z0-9_-]+)\s*:/g)) globalTokens.add(m[1])
}

const files = SCAN.flatMap((d) => walk(d))
const findings = []

function add(rule, file, line, message, detail) {
  findings.push({ rule, severity: RULES[rule].severity, file: relative(SRC, file), line, message, detail })
}

for (const file of files) {
  const raw = readFileSync(file, 'utf8')
  const lines = raw.split('\n')

  // 本文件内声明的令牌（组件私有令牌是合法的第二层）
  const localTokens = new Set()
  for (const m of raw.matchAll(/(--wot-[a-z0-9_-]+)\s*:/g)) localTokens.add(m[1])
  for (const m of raw.matchAll(/\$[\w-]+:\s*var\(\s*(--wot-[a-z0-9_-]+)/g)) localTokens.add(m[1])

  /**
   * 标记「位于 `$x: var(...)` 令牌声明内部」的行。
   *
   * 单行声明靠 isTokenDecl 就能豁免，但多行声明（典型是三层阴影：
   * `$tabbar-round-shadow: var(` 换行写偏移与模糊半径）每一行都不以 `$` 开头，
   * 会被当成规则体里的硬编码尺寸。令牌声明的回退值本来就是合法兜底，
   * 所以按括号深度把整段标记出来。
   */
  const inTokenDecl = new Array(lines.length).fill(false)
  let declDepth = 0
  for (let i = 0; i < lines.length; i++) {
    const code = stripComments(lines[i])
    if (declDepth > 0) inTokenDecl[i] = true
    const opens = (code.match(/\(/g) || []).length
    const closes = (code.match(/\)/g) || []).length
    if (declDepth > 0) declDepth = Math.max(0, declDepth + opens - closes)
    else if (/^\s*\$[\w-]+:\s*var\(/.test(code)) {
      declDepth = Math.max(0, opens - closes)
      if (declDepth > 0) inTokenDecl[i] = true
    }
  }

  lines.forEach((line, idx) => {
    const code = stripComments(line)
    if (!code.trim()) return
    const ln = idx + 1

    // D001 未声明令牌
    for (const m of code.matchAll(/var\(\s*(--wot-[a-z0-9_-]+)/g)) {
      const name = m[1]
      if (globalTokens.has(name) || localTokens.has(name)) continue
      add('D001', file, ln, name, code.trim())
    }

    // 令牌声明行本身不参与硬编码检查（回退值是合法兜底）
    const isTokenDecl = /^\s*\$[\w-]+:\s*var\(/.test(code)
    const usesToken = /var\(\s*--wot-/.test(code)
    if (isTokenDecl || usesToken || inTokenDecl[idx]) return

    // D002 硬编码颜色
    for (const m of code.matchAll(/#[0-9a-fA-F]{3,8}\b/g)) add('D002', file, ln, m[0], code.trim())
    for (const m of code.matchAll(/\brgba?\(/g)) add('D002', file, ln, 'rgb()', code.trim())
    for (const m of code.matchAll(/:\s*(white|black)\b/g)) add('D002', file, ln, m[1], code.trim())

    // D003 硬编码尺寸（排除 0px 与 1px 描边）
    for (const m of code.matchAll(/(?<![\w$.-])(\d+(?:\.\d+)?)px\b/g)) {
      const v = Number(m[1])
      if (v === 0 || v === 1) continue
      add('D003', file, ln, `${v}px`, code.trim())
    }

    // D004 字号
    for (const m of code.matchAll(/font-size:\s*(\d+(?:\.\d+)?)px/g)) {
      if (!FONT_SCALE.has(Number(m[1]))) add('D004', file, ln, `${m[1]}px`, code.trim())
    }
    // D005 字重
    for (const m of code.matchAll(/font-weight:\s*(\d+)\b/g)) {
      if (!WEIGHT_SCALE.has(Number(m[1]))) add('D005', file, ln, m[1], code.trim())
    }
    // D006 圆角
    for (const m of code.matchAll(/border-radius:\s*([^;]+);/g)) {
      const val = m[1].trim()
      if (/[%$]/.test(val)) continue
      const nums = [...val.matchAll(/(\d+(?:\.\d+)?)px/g)].map((x) => Number(x[1]))
      if (nums.some((n) => !RADIUS_SCALE.has(n))) add('D006', file, ln, val, code.trim())
    }
    // D007 阴影（值里带 $ 变量或 var() 视为已令牌化）
    const shadow = code.match(/box-shadow:\s*([^;]+);/)
    if (shadow && !/\$|var\(/.test(shadow[1]) && !/^\s*none\s*$/.test(shadow[1])) {
      add('D007', file, ln, 'box-shadow 字面量', code.trim())
    }
    // D008 动效（时长/缓动写死才算；引用 $ 变量视为已令牌化）
    for (const m of code.matchAll(/transition:\s*([^;]+);/g)) {
      const val = m[1].trim()
      if (/\ball\b/.test(val)) add('D009', file, ln, 'transition: all', code.trim())
      if (/\$|var\(/.test(val)) continue
      if (/\d+m?s\b/.test(val) || /\b(ease|linear|cubic-bezier|steps)\b/.test(val)) {
        add('D008', file, ln, val, code.trim())
      }
    }
    // D010 禁用态透明度
    for (const m of code.matchAll(/(--disabled|is-disabled)[^{]*\{[^}]*opacity:\s*(0\.\d+)/g)) {
      if (Number(m[2]) !== 0.4) add('D010', file, ln, m[2], code.trim())
    }
  })
}

// D011 触控目标
for (const t of TOUCH_TARGETS) {
  const p = join(SRC, t.file)
  if (!existsSync(p)) continue
  const raw = readFileSync(p, 'utf8')
  const line = raw.split('\n').findIndex((l) => l.includes(t.token) && /var\(/.test(l))
  const m = line >= 0 ? raw.split('\n')[line].match(/\$n-(\d+)/) : null
  const size = m ? Number(m[1]) : t.expect
  if (size < 44) {
    add('D011', p, line + 1, `${t.token} = ${size}px`, `低于 44pt 下限 ${44 - size}px`)
  }
}

// D012 对比度（文件级，不指向行）
const resolveColor = buildColorResolver()
for (const p of CONTRAST_PAIRS) {
  const fg = resolveColor(p.fg)
  const bg = resolveColor(p.bg)
  if (!fg || !bg) continue // 令牌改名时宁可不报，也不要用假色值误判
  const ratio = contrast(fg, bg)
  if (ratio < p.need) {
    findings.push({
      rule: 'D012',
      severity: RULES.D012.severity,
      file: 'styles/theme/light.scss',
      line: 0,
      message: `${p.name} = ${ratio.toFixed(2)}:1`,
      detail: `需要 ${p.need}:1（${fg} on ${bg}）`
    })
  }
}

// ---------------------------------------------------------------------------
// 输出
// ---------------------------------------------------------------------------

const only = process.argv.includes('--only')
  ? (process.argv[process.argv.indexOf('--only') + 1] || '').split(',').filter(Boolean)
  : null
const filtered = only ? findings.filter((f) => only.includes(f.rule)) : findings

/** 基线指纹：不含行号，见文件头「基线说明」 */
const fingerprint = (f) => `${f.rule}|${f.file}|${f.message}`

const baseline = existsSync(BASELINE_FILE) ? new Set(Object.keys(JSON.parse(readFileSync(BASELINE_FILE, 'utf8')))) : new Set()

if (process.argv.includes('--update-baseline')) {
  const next = {}
  for (const f of filtered) next[fingerprint(f)] = true
  writeFileSync(BASELINE_FILE, `${JSON.stringify(next, null, 2)}\n`)
  console.log(`已写入 ${BASELINE_FILE}：${Object.keys(next).length} 条存量`)
  process.exit(0)
}

const fresh = filtered.filter((f) => !baseline.has(fingerprint(f)))
const isNew = (f) => !baseline.has(fingerprint(f))

const byRule = new Map()
for (const f of filtered) {
  if (!byRule.has(f.rule)) byRule.set(f.rule, [])
  byRule.get(f.rule).push(f)
}

const errors = filtered.filter((f) => f.severity === 'error').length
const warnings = filtered.filter((f) => f.severity === 'warn').length
const newErrors = fresh.filter((f) => f.severity === 'error').length

if (process.argv.includes('--json')) {
  console.log(
    JSON.stringify(
      {
        scanned: { files: files.length, tokens: globalTokens.size },
        totals: { errors, warnings, findings: filtered.length, newErrors, baselined: filtered.length - fresh.length },
        rules: Object.fromEntries(
          Object.entries(RULES).map(([id, meta]) => [
            id,
            { ...meta, count: (byRule.get(id) || []).length }
          ])
        ),
        findings: filtered.map((f) => ({ ...f, isNew: isNew(f) }))
      },
      null,
      2
    )
  )
} else {
  console.log(`\n设计规范审计 — 扫描 ${files.length} 个 SCSS 文件 / ${globalTokens.size} 个已声明令牌\n`)

  for (const id of Object.keys(RULES).sort()) {
    const list = byRule.get(id)
    if (!list) continue
    const meta = RULES[id]
    const mark = meta.severity === 'error' ? '✗' : '!'
    const nNew = list.filter(isNew).length
    console.log(`${mark} ${id}  ${meta.title}  (${list.length}${nNew ? ` · 新增 ${nNew}` : ''})  — ${meta.why}`)
    const byFile = new Map()
    for (const f of list) {
      if (!byFile.has(f.file)) byFile.set(f.file, [])
      byFile.get(f.file).push(f)
    }
    const shown = [...byFile.entries()].sort((a, b) => b[1].length - a[1].length).slice(0, 5)
    for (const [file, items] of shown) {
      const sample = items
        .slice(0, 3)
        .map((i) => `${i.line ? `L${i.line} ` : ''}${i.message}${isNew(i) ? ' *' : ''}`)
        .join(' · ')
      console.log(`    ${file}  ×${items.length}   ${sample}`)
    }
    if (byFile.size > shown.length) console.log(`    …另有 ${byFile.size - shown.length} 个文件`)
    console.log()
  }

  const baseNote = baseline.size ? `（其中 ${filtered.length - fresh.length} 条已豁免）` : ''
  console.log(`合计：${errors} errors, ${warnings} warnings${baseNote}`)
  if (baseline.size) console.log(`新增：${newErrors} errors（* 标记为新增，--strict 只拦这些）`)
  console.log()
}

if (process.argv.includes('--strict') && newErrors > 0) process.exit(1)
