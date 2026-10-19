/**
 * 设计令牌一致性测试（ARCHITECTURE §3.7 / INV-4「契约有源」）。
 *
 * `common/theme.ts` 是 `styles/tokens/_primitive.scss` 的 **JS 侧手抄镜像**：
 * SCSS 变量在 JS 中不可读，而 svg content 又不继承 CSS 变量 / currentColor，
 * 少数场景（wd-icon 默认色、button 内嵌 loading 颜色）只能用 JS 常量下发。
 *
 * 两份手抄必然漂移——已发生：`AMBER` 十档全部是另一版色板（#FFFAEB… vs
 * #FDF6E9…），SCSS 侧改版后 JS 镜像没跟上，警告色在「CSS 画的主体」与
 * 「JS 画的图标」之间出现色差。本测试把一致性升级为机器守护。
 *
 * 归一化规则：SCSS 统一写 8 位 `#RRGGBBAA`（Lynx 引擎约定），JS 侧写 6 位；
 * 仅在 alpha 为 FF 时视为等价，其余 alpha 差异仍然算漂移。
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { AMBER, GRAY, GREEN, PURPLE, RED } from '../src/common/theme'

const PRIMITIVE_SCSS = path.resolve(__dirname, '..', 'src/styles/tokens/_primitive.scss')

/** 解析 `--wd-<name>: <value>;` 为 name → value（name 不含 --wd- 前缀） */
function readPrimitiveTokens(): Map<string, string> {
  const source = readFileSync(PRIMITIVE_SCSS, 'utf8')
  const tokens = new Map<string, string>()
  for (const match of source.matchAll(/--wd-([a-z0-9-]+)\s*:\s*([^;]+);/gi)) {
    tokens.set(match[1].toLowerCase(), match[2].trim())
  }
  return tokens
}

/** 6 位与 8 位（alpha=FF）十六进制视为同色 */
function normalizeHex(value: string): string {
  const hex = value.trim().toUpperCase()
  const short = /^#([0-9A-F]{6})FF$/.exec(hex)
  return short ? `#${short[1]}` : hex
}

const PALETTES = { purple: PURPLE, gray: GRAY, green: GREEN, amber: AMBER, red: RED }

describe('theme.ts 色板镜像与 _primitive.scss 一致', () => {
  const tokens = readPrimitiveTokens()

  it('primitive 令牌可被解析（防止 SCSS 结构变动后测试静默失效）', () => {
    expect(tokens.size).toBeGreaterThan(50)
    expect(tokens.get('purple-6')).toBeTruthy()
  })

  for (const [palette, scale] of Object.entries(PALETTES)) {
    describe(palette, () => {
      for (const [step, color] of Object.entries(scale)) {
        it(`${palette}-${step} 与 --wd-${palette}-${step} 同色`, () => {
          const scssValue = tokens.get(`${palette}-${step}`)
          expect(scssValue, `_primitive.scss 缺少 --wd-${palette}-${step}`).toBeTruthy()
          expect(normalizeHex(color)).toBe(normalizeHex(scssValue as string))
        })
      }
    })
  }
})
