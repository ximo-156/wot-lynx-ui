/**
 * 真机巡检回归 — wd-qr-code 的 SVG 码点几何（扫码可读性）。
 *
 * 缺陷形态（2026-11-10 真机截图）：码点坐标按模块逐个 Math.ceil 量化
 * （"ceil 对齐"），带来两个扫码致命问题——
 *   1. 三个 finder 图案宽度不一致。真机实测左上 103px / 右上 99px / 左下 103px
 *      （离散 3.9%），扫码器按 finder 反推模块尺寸时产生约 -1.6% 偏差；而 QR
 *      解码对模块尺寸误差的容差约为 ±1/(2N)（N 为模块数，v11 起仅 ±0.8%），
 *      网格累积漂移超过半个模块 → 整码读不出。
 *   2. 末边界 `count * tile` 存在浮点超界（如 29 * (120/29) =
 *      120.00000000000001），ceil 后变 121，被 viewBox 裁掉 1px，右上 finder
 *      直接比左上窄一个模块像素。
 * 另：fill 只写在 g 上，违反 CONVENTIONS §8「真机 SVG 不继承 g 元素的展示
 * 属性」，colorDark / 渐变降级色在真机不生效（回落默认黑）。
 *
 * 参考源是 canvas fillRect，分数坐标由画布抗锯齿消化；SVG 侧必须原样保留
 * 分数几何，因此断言落在与平台无关的几何事实上。
 */
import { describe, it, expect } from 'vitest'
import { render, cleanup } from '../render'
import { pause } from '@wot-lynx/core/common/util'
import QrCode from '@wot-lynx/ui-display/wd-qr-code'
import { generateQRCode, QRErrorCorrectLevel } from '../../../ui-display/src/wd-qr-code/qrcode'

interface Rect {
  x: number
  y: number
  w: number
  h: number
}

/** 数值收敛（与组件 n() 一致：2 位小数） */
function n(value: number): number {
  return Math.round(value * 100) / 100
}

/** 解析码点 rect（背景 rect 无 x/y，不会命中） */
function parseRects(content: string): Rect[] {
  return [...content.matchAll(/<rect x="(-?[\d.]+)" y="(-?[\d.]+)" width="([\d.]+)" height="([\d.]+)"/g)].map((m) => ({
    x: Number(m[1]),
    y: Number(m[2]),
    w: Number(m[3]),
    h: Number(m[4])
  }))
}

interface Geometry {
  count: number
  tile: number
  rects: Rect[]
  /** 三个 finder 的顶行 run（各 7 模块宽） */
  tl: Rect
  tr: Rect
  bl: Rect
  /** 扫码器按 finder 反推的模块尺寸（TL/TR 平均） */
  estimatedModule: number
  /** 反推偏差（相对真实 tile） */
  estimateError: number
  /** 网格累积漂移（模块数）：误差 × 模块数，应 < 0.5 */
  drift: number
}

function geometryOf(content: string, text: string, size: number, margin: number, level = 'H'): Geometry {
  const modules = generateQRCode(text, { errorCorrectLevel: QRErrorCorrectLevel[level] }).modules
  const count = modules.length
  const tile = (size - margin * 2) / count
  const rects = parseRects(content)
  expect(rects.length, '应解析出码点 rect').toBeGreaterThan(0)

  const rows = new Map<number, Rect[]>()
  for (const r of rects) {
    const key = n(r.y)
    if (!rows.has(key)) rows.set(key, [])
    rows.get(key)!.push(r)
  }
  const firstRow = rows.get(n(margin))
  const lastRow = rows.get(n((count - 1) * tile + margin))
  expect(firstRow, '应存在首行码点').toBeTruthy()
  expect(lastRow, '应存在末行码点').toBeTruthy()
  const tl = firstRow![0]
  const tr = firstRow![firstRow!.length - 1]
  const bl = lastRow![0]
  const estimatedModule = (tl.w / 7 + tr.w / 7) / 2
  const estimateError = (estimatedModule - tile) / tile
  return { count, tile, rects, tl, tr, bl, estimatedModule, estimateError, drift: Math.abs(estimateError) * count }
}

async function renderContent(props: Record<string, unknown>): Promise<string> {
  const { container } = render(QrCode as any, props)
  await pause(30)
  const svg = container.querySelector('svg')
  expect(svg, '码图应经原生 svg content 渲染').not.toBeNull()
  const content = svg!.getAttribute('content') || ''
  cleanup()
  return content
}

describe('真机巡检回归 · wd-qr-code 码点几何（扫码可读性）', () => {
  const cases: Array<[string, string, number, number]> = [
    ['短内容（v3，演示同参）', 'https://wot-ui.cn', 120, 0],
    ['短内容带静区', 'https://wot-ui.cn', 120, 8],
    ['中等内容（v11）', 'x'.repeat(100), 200, 0],
    ['较长内容（v22）', 'x'.repeat(400), 300, 0],
    ['长内容（v31）', 'x'.repeat(1200), 400, 0]
  ]

  for (const [label, text, size, margin] of cases) {
    it(`${label}：finder 宽度一致、模块反推偏差不累积超半模块`, async () => {
      const content = await renderContent({ text, size, margin })
      const g = geometryOf(content, text, size, margin)

      // 三个 finder 等宽（各 7 模块）
      expect(Math.abs(g.tl.w - g.tr.w), '左 / 右 finder 应等宽').toBeLessThanOrEqual(0.02)
      expect(Math.abs(g.tl.w - g.bl.w), '上 / 下 finder 应等宽').toBeLessThanOrEqual(0.02)
      expect(g.tl.w, 'finder 宽度应约 7 模块').toBeCloseTo(7 * g.tile, 1)

      // 模块尺寸反推偏差：累积漂移必须小于半个模块，否则扫码器网格错位
      expect(g.drift, `finder 反推模块尺寸偏差 ${(g.estimateError * 100).toFixed(2)}% 在 ${g.count} 模块上累积 ${g.drift.toFixed(2)} 模块`).toBeLessThan(0.5)
    })
  }

  it('无零宽 / 零高码点，且不溢出 viewBox（末边界浮点超界会被裁掉）', async () => {
    const content = await renderContent({ text: 'https://wot-ui.cn', size: 120, margin: 0 })
    const g = geometryOf(content, 'https://wot-ui.cn', 120, 0)
    expect(g.rects.filter((r) => r.w <= 0), '不得出现零宽码点（模块会消失）').toHaveLength(0)
    expect(g.rects.filter((r) => r.h <= 0), '不得出现零高码点').toHaveLength(0)
    const maxRight = Math.max(...g.rects.map((r) => r.x + r.w))
    const maxBottom = Math.max(...g.rects.map((r) => r.y + r.h))
    expect(maxRight, '码点不得超出 viewBox 右边界').toBeLessThanOrEqual(120 + 0.011)
    expect(maxBottom, '码点不得超出 viewBox 下边界').toBeLessThanOrEqual(120 + 0.011)
  })

  it('fill 逐元素显式下发（真机 SVG 不继承 g 的展示属性）', async () => {
    const content = await renderContent({ text: 'https://wot-ui.cn', size: 120, colorDark: '#1C64FD' })
    const rects = parseRects(content)
    expect(rects.length).toBeGreaterThan(0)
    for (const r of rects) {
      const tag = content.match(new RegExp(`<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}"[^>]*>`))![0]
      expect(tag, '每个码点 rect 都应显式带 fill').toMatch(/fill="/)
    }
    expect(content, 'colorDark 应下发到码点').toContain('#1C64FD')
  })

  it('dots / rounded / liquid 码点的 path 也显式带 fill', async () => {
    for (const dotType of ['dots', 'rounded', 'liquid']) {
      const content = await renderContent({ text: 'https://wot-ui.cn', size: 120, dotType, dotScale: 0.8 })
      const paths = content.match(/<path [^>]*>/g) || []
      expect(paths.length, `${dotType} 应产出 path 码点`).toBeGreaterThan(0)
      for (const p of paths) {
        expect(p, `${dotType} 的 path 应显式带 fill`).toMatch(/fill="/)
      }
    }
  })

  it('码点坐标保持分数精度（不得退化成整数量化）', async () => {
    const content = await renderContent({ text: 'https://wot-ui.cn', size: 120, margin: 0 })
    const g = geometryOf(content, 'https://wot-ui.cn', 120, 0)
    // tile = 120/29 ≈ 4.138；旧的逐模块 ceil 量化会把单模块宽度压成 4 / 5 的
    // 整数阶梯（偏差 > 0.13px，约 3%），finder 也随之宽度不一。
    expect(g.tile).toBeCloseTo(4.138, 2)
    const singles = g.rects.filter((r) => r.w < g.tile * 1.5)
    expect(singles.length, '应存在单模块码点').toBeGreaterThan(0)
    const worst = Math.max(...singles.map((r) => Math.abs(r.w - g.tile)))
    expect(worst, `单模块宽度应贴合 tile（最大偏差 ${worst.toFixed(3)}px）`).toBeLessThanOrEqual(0.02)
  })
})
