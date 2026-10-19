/**
 * 设计令牌一致性测试（ARCHITECTURE §3.7 / INV-4「契约有源」）。
 *
 * `common/theme.ts` 是 `styles/theme/base/color.scss`（wot-ui 2.3.2 色阶）的
 * **JS 侧镜像**：SCSS 变量在 JS 中不可读，而 svg content 又不继承 CSS 变量 /
 * currentColor，少数场景（wd-icon 默认色、内嵌 loading 圆弧颜色）只能用 JS
 * 常量下发。
 *
 * 两份必然漂移——本测试把一致性升级为机器守护：theme.ts 的每个色阶档位必须与
 * color.scss 的 `--wot-<family>-<step>` 同色。
 *
 * 归一化规则：SCSS 统一写 8 位 `#RRGGBBAA`（Lynx 引擎约定），JS 侧照抄 8 位；
 * 仅在 alpha 为 FF 时把 8 位归一为 6 位比较，其余 alpha 差异仍然算漂移。
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import * as theme from '../src/common/theme'

const COLOR_SCSS = path.resolve(__dirname, '..', 'src/styles/theme/base/color.scss')

/** 解析 `--wot-<name>: <value>;` 为 name → value（name 不含 --wot- 前缀） */
function readColorTokens(): Map<string, string> {
  const source = readFileSync(COLOR_SCSS, 'utf8')
  const tokens = new Map<string, string>()
  for (const match of source.matchAll(/--wot-([a-z0-9-]+)\s*:\s*([^;]+);/gi)) {
    tokens.set(match[1].toLowerCase(), match[2].trim())
  }
  return tokens
}

/** 递归解析 var(--x) 引用，取最终字面值 */
function resolveToken(name: string, tokens: Map<string, string>, depth = 0): string {
  const raw = tokens.get(name)
  if (raw === undefined || depth > 10) return ''
  const ref = /^var\((--wot-[\w-]+)\)$/.exec(raw)
  if (ref) return resolveToken(ref[1].slice(6), tokens, depth + 1)
  return raw
}

/** 6 位与 8 位（alpha=FF）十六进制视为同色 */
function normalizeHex(value: string): string {
  const hex = value.trim().toUpperCase()
  const short = /^#([0-9A-F]{6})FF$/.exec(hex)
  return short ? `#${short[1]}` : hex
}

/** theme.ts 中导出的色阶对象（排除语义色与其它常量） */
const PALETTES: Record<string, Record<string, string>> = {}
for (const [key, value] of Object.entries(theme)) {
  if (
    key === 'THEME_ICON_COLOR' ||
    key === 'THEME_TEXT_COLOR' ||
    typeof value !== 'object' ||
    value === null
  ) {
    continue
  }
  PALETTES[key] = value as Record<string, string>
}

describe('theme.ts 色板镜像与 theme/base/color.scss 一致', () => {
  const tokens = readColorTokens()

  it('color.scss 令牌可被解析（防止 SCSS 结构变动后测试静默失效）', () => {
    expect(tokens.size).toBeGreaterThan(50)
    expect(tokens.get('blue-6')).toBeTruthy()
  })

  for (const [palette, scale] of Object.entries(PALETTES)) {
    const scssName = palette.toLowerCase()
    describe(scssName, () => {
      for (const [step, color] of Object.entries(scale)) {
        it(`${scssName}-${step} 与 --wot-${scssName}-${step} 同色`, () => {
          const scssValue = resolveToken(`${scssName}-${step}`, tokens)
          expect(scssValue, `color.scss 缺少 --wot-${scssName}-${step}`).toBeTruthy()
          expect(normalizeHex(color)).toBe(normalizeHex(scssValue))
        })
      }
    })
  }

  it('语义色镜像与 coolgrey 文字/图标主色一致', () => {
    // --wot-text-main / --wot-icon-main（亮色）均指向 coolgrey-10
    expect(normalizeHex(theme.THEME_ICON_COLOR.light)).toBe(
      normalizeHex(resolveToken('coolgrey-10', tokens))
    )
    expect(normalizeHex(theme.THEME_TEXT_COLOR.light)).toBe(
      normalizeHex(resolveToken('coolgrey-10', tokens))
    )
    // 暗色主文字/图标为 coolgrey-1
    expect(normalizeHex(theme.THEME_ICON_COLOR.dark)).toBe(
      normalizeHex(resolveToken('coolgrey-1', tokens))
    )
  })
})
