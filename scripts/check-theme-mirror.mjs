#!/usr/bin/env node
/**
 * check-theme-mirror —— 校验 JS 侧调色板镜像与 SCSS 令牌逐档一致。
 *
 * 背景：`packages/ui/src/common/theme.ts` 是设计令牌的 **JS 镜像**，供
 * 「必须在 JS 里算颜色」的场景使用（Lynx 的 svg content / 字体字形不继承
 * `currentColor`，wd-icon 默认色、button 内嵌 loading 色等都要 JS 给值）。
 * 一旦它与 `styles/theme/base/color.scss` 的 `--wot-*` 令牌漂移，同一个组件
 * 在「走样式表」和「走 JS 常量」两条路径上会呈现两种颜色——这类缺陷在
 * Web 预览里几乎看不出来，只在真机某些组件上露馅。
 *
 * 本脚本把两侧按「调色板 → 档位」逐项比对，任何一档不一致即失败。
 *
 * 用法：
 *   node scripts/check-theme-mirror.mjs          # 一致则打印摘要，退出 0
 *   node scripts/check-theme-mirror.mjs --json   # 机器可读
 */
import { readFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SCSS_FILE = join(ROOT, 'packages/ui/src/styles/theme/base/color.scss')
const TS_FILE = join(ROOT, 'packages/ui/src/common/theme.ts')

/** theme.ts 的导出名 → SCSS 调色板名 */
const PALETTE_MAP = {
  BRAND: 'brand',
  BLUE: 'blue',
  LIGHTBLUE: 'lightblue',
  PINK: 'pink',
  RED: 'red',
  VOLCANO: 'volcano',
  ORANGE: 'orange',
  YELLOW: 'yellow',
  GREEN: 'green',
  CYAN: 'cyan',
  GRAPE: 'grape',
  PURPLE: 'purple',
  COOLGREY: 'coolgrey',
  NEUTRALGREY: 'neutralgrey',
  WARMGREY: 'warmgrey'
}

/** 单值常量：theme.ts 导出名 → SCSS 变量名 */
const SCALAR_MAP = {
  // PRIMARY_COLOR 是「亮色主题主色」（light.scss 的 --wot-primary-6），因 AA
  // 对比度取 brand-7（brand-6 上白字/作强调文字均仅 4.35:1）；brand-6 仍是品牌色。
  PRIMARY_COLOR: '--wot-brand-7',
  SECONDARY_COLOR: '--wot-brand-5',
  TEXT_MAIN_COLOR: '--wot-brand-text-main',
  TEXT_SECONDARY_COLOR: '--wot-brand-text-secondary'
}

/** 归一化颜色，便于跨写法比较（#abc ↔ #AABBCCFF、rgb() 等一律转小写十六进制） */
function normalizeColor(raw) {
  const value = raw.trim().replace(/^['"]|['"]$/g, '')
  const lower = value.toLowerCase()
  if (lower === 'transparent') return 'transparent'
  if (!lower.startsWith('#')) return lower.replace(/\s+/g, '')
  let hex = lower.slice(1)
  if (hex.length === 3 || hex.length === 4) {
    hex = hex
      .split('')
      .map((ch) => ch + ch)
      .join('')
  }
  if (hex.length === 6) hex += 'ff'
  return `#${hex}`
}

/** 解析 color.scss：返回 { '--wot-brand-1': '#F8F6FFFF', ... } */
export function parseScssTokens(css) {
  const tokens = {}
  const re = /(--wot-[\w-]+)\s*:\s*([^;]+);/g
  let match
  while ((match = re.exec(css)) !== null) {
    tokens[match[1]] = match[2].trim()
  }
  return tokens
}

/** 解析 theme.ts：返回 { BRAND: { 1: '#...', ... }, PRIMARY_COLOR: '#...' } */
export function parseThemeTs(source) {
  const result = {}
  const objectRe = /export const (\w+) = \{([\s\S]*?)\}\s*as const/g
  let match
  while ((match = objectRe.exec(source)) !== null) {
    const [, name, body] = match
    const entries = {}
    const entryRe = /(\d+)\s*:\s*'([^']+)'/g
    let entry
    while ((entry = entryRe.exec(body)) !== null) {
      entries[Number(entry[1])] = entry[2]
    }
    if (Object.keys(entries).length) result[name] = entries
  }
  const scalarRe = /export const (\w+) = '([^']+)'/g
  while ((match = scalarRe.exec(source)) !== null) {
    result[match[1]] = match[2]
  }
  // 引用式常量（如 `export const PRIMARY_COLOR = BRAND[6]`）要回溯到色阶值，
  // 否则这类派生常量会逃过校验——它们恰恰是最容易随色阶改动而漂移的一批。
  const refRe = /export const (\w+) = (\w+)\[(\d+)\]/g
  while ((match = refRe.exec(source)) !== null) {
    const [, name, palette, step] = match
    const value = result[palette]?.[Number(step)]
    if (value) result[name] = value
  }
  return result
}

function main() {
  const scssRaw = readFileSync(SCSS_FILE, 'utf8')
  const tsRaw = readFileSync(TS_FILE, 'utf8')
  const tokens = parseScssTokens(scssRaw)
  const mirror = parseThemeTs(tsRaw)

  const failures = []
  let checked = 0

  for (const [exportName, palette] of Object.entries(PALETTE_MAP)) {
    const entries = mirror[exportName]
    if (!entries) continue
    for (const [step, value] of Object.entries(entries)) {
      const tokenName = `--wot-${palette}-${step}`
      const scssValue = tokens[tokenName]
      checked++
      if (!scssValue) {
        failures.push(`${exportName}[${step}] 在 color.scss 中找不到对应令牌 ${tokenName}`)
        continue
      }
      if (normalizeColor(scssValue) !== normalizeColor(value)) {
        failures.push(
          `${tokenName}: SCSS ${scssValue} ≠ theme.ts ${exportName}[${step}] ${value}`
        )
      }
    }
  }

  for (const [exportName, tokenName] of Object.entries(SCALAR_MAP)) {
    const value = mirror[exportName]
    if (typeof value !== 'string') continue
    const scssValue = tokens[tokenName]
    checked++
    if (!scssValue) {
      failures.push(`${exportName} 在 color.scss 中找不到对应令牌 ${tokenName}`)
      continue
    }
    if (normalizeColor(scssValue) !== normalizeColor(value)) {
      failures.push(`${tokenName}: SCSS ${scssValue} ≠ theme.ts ${exportName} ${value}`)
    }
  }

  if (process.argv.includes('--json')) {
    console.log(JSON.stringify({ checked, failures }, null, 2))
  } else if (failures.length) {
    console.error(
      `调色板镜像不一致（${failures.length}/${checked} 处）：\n` +
        failures.map((item) => `  ✗ ${item}`).join('\n') +
        `\n\n修法：以 ${relative(ROOT, SCSS_FILE)} 为准，同步 ${relative(ROOT, TS_FILE)}。`
    )
  } else {
    console.log(`✓ 调色板镜像一致（${checked} 个档位：theme.ts ↔ color.scss）`)
  }

  if (failures.length) process.exit(1)
}

main()
