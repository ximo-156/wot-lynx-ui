import { describe, it, expect } from 'vitest'
import { analyzeContent, diffImages } from '../../../../scripts/lib/image-diff.mjs'

/** 造一张纯色 RGBA 图 */
function solid(width: number, height: number, rgba: [number, number, number, number]) {
  const data = Buffer.alloc(width * height * 4)
  for (let i = 0; i < width * height; i++) {
    data[i * 4] = rgba[0]
    data[i * 4 + 1] = rgba[1]
    data[i * 4 + 2] = rgba[2]
    data[i * 4 + 3] = rgba[3]
  }
  return { width, height, data }
}

function setPixel(img: { width: number; data: Buffer }, x: number, y: number, rgba: [number, number, number, number]) {
  const o = (y * img.width + x) * 4
  img.data[o] = rgba[0]
  img.data[o + 1] = rgba[1]
  img.data[o + 2] = rgba[2]
  img.data[o + 3] = rgba[3]
}

describe('image-diff：统计', () => {
  it('完全相同的两张图 → 0 差异、无 bbox', () => {
    const a = solid(10, 10, [255, 255, 255, 255])
    const b = solid(10, 10, [255, 255, 255, 255])
    const r = diffImages(a, b)
    expect(r.ratio).toBe(0)
    expect(r.changedPixels).toBe(0)
    expect(r.bbox).toBeNull()
    expect(r.sizeMismatch).toBe(false)
  })

  it('单个像素超出容差 → 恰好 1 个变化像素，bbox 定位到它', () => {
    const a = solid(10, 10, [255, 255, 255, 255])
    const b = solid(10, 10, [255, 255, 255, 255])
    setPixel(b, 3, 7, [0, 0, 0, 255])
    const r = diffImages(a, b)
    expect(r.changedPixels).toBe(1)
    expect(r.totalPixels).toBe(100)
    expect(r.ratio).toBeCloseTo(0.01, 10)
    expect(r.bbox).toEqual({ x: 3, y: 7, width: 1, height: 1 })
  })

  it('容差之内的抖动不算变化', () => {
    const a = solid(4, 4, [100, 100, 100, 255])
    const b = solid(4, 4, [108, 108, 108, 255]) // 恰好等于默认容差 8，不超
    expect(diffImages(a, b).changedPixels).toBe(0)
    expect(diffImages(a, b, { tolerance: 7 }).changedPixels).toBe(16)
  })

  it('容差只看最大通道差，不是通道差之和', () => {
    const a = solid(1, 1, [100, 100, 100, 255])
    const b = solid(1, 1, [108, 108, 108, 255]) // 每通道差 8，和 24
    expect(diffImages(a, b, { tolerance: 8 }).changedPixels).toBe(0)
  })

  it('bbox 覆盖所有变化像素的外接矩形', () => {
    const a = solid(20, 20, [0, 0, 0, 255])
    const b = solid(20, 20, [0, 0, 0, 255])
    setPixel(b, 2, 3, [255, 255, 255, 255])
    setPixel(b, 9, 11, [255, 255, 255, 255])
    const r = diffImages(a, b)
    expect(r.changedPixels).toBe(2)
    expect(r.bbox).toEqual({ x: 2, y: 3, width: 8, height: 9 })
  })

  it('尺寸不同直接判 100%，不逐像素比', () => {
    const a = solid(10, 10, [0, 0, 0, 255])
    const b = solid(10, 12, [0, 0, 0, 255])
    const r = diffImages(a, b)
    expect(r.sizeMismatch).toBe(true)
    expect(r.ratio).toBe(1)
    expect(r.diff).toBeNull()
  })
})

describe('image-diff：内容检测', () => {
  it('内容区纯色 → 判为空白', () => {
    const img = solid(100, 100, [245, 245, 247, 255])
    expect(analyzeContent(img)).toEqual({ distinctColors: 1, blank: true })
  })

  it('中心有一个色块 → 不是空白', () => {
    const img = solid(100, 100, [245, 245, 247, 255])
    setPixel(img, 50, 50, [255, 0, 0, 255])
    const r = analyzeContent(img)
    expect(r.blank).toBe(false)
    expect(r.distinctColors).toBe(2)
  })

  it('只有四角不同仍判为空白（手机屏圆角不该掩盖空白）', () => {
    const img = solid(100, 100, [245, 245, 247, 255])
    for (const [x, y] of [
      [0, 0],
      [99, 0],
      [0, 99],
      [99, 99],
      [3, 2],
      [96, 97]
    ]) {
      setPixel(img, x, y, [0, 0, 0, 255])
    }
    expect(analyzeContent(img).blank).toBe(true)
  })
})

describe('image-diff：差异图', () => {
  it('变化像素涂红，未变区域压成灰阶', () => {
    const a = solid(2, 2, [255, 255, 255, 255])
    const b = solid(2, 2, [255, 255, 255, 255])
    setPixel(b, 1, 0, [0, 0, 0, 255])
    const r = diffImages(a, b)
    expect(r.diff).not.toBeNull()
    const diff = r.diff!
    expect(diff.width).toBe(2)
    expect(diff.height).toBe(2)
    // (1,0) 是变化像素
    const changed = (0 * 2 + 1) * 4
    expect([diff.data[changed], diff.data[changed + 1], diff.data[changed + 2]]).toEqual([255, 0, 0])
    // (0,0) 未变化：三通道相等（灰阶）
    expect(diff.data[0]).toBe(diff.data[1])
    expect(diff.data[1]).toBe(diff.data[2])
  })
})
