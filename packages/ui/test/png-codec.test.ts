import { describe, it, expect } from 'vitest'
import { deflateSync } from 'node:zlib'
import { decodePng, encodePng } from '../../../scripts/lib/png.mjs'

// ---------------------------------------------------------------------------
// 手写 PNG 构造器
//
// 不能用 `encodePng` 造样本再拿 `decodePng` 解：那样只能测出「两次犯同一个错」。
// 这里按 PNG 规范**正向**做滤波，期望像素由测试自己给定，两条实现路径互相独立。
// ---------------------------------------------------------------------------

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  return table
})()

function crc32(buf: Buffer): number {
  let c = 0xffffffff
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type: string, data: Buffer): Buffer {
  const head = Buffer.alloc(8)
  head.writeUInt32BE(data.length, 0)
  head.write(type, 4, 'ascii')
  const tail = Buffer.alloc(4)
  tail.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])), 0)
  return Buffer.concat([head, data, tail])
}

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c
  const pa = Math.abs(p - a)
  const pb = Math.abs(p - b)
  const pc = Math.abs(p - c)
  if (pa <= pb && pa <= pc) return a
  if (pb <= pc) return b
  return c
}

/**
 * 按规范正向滤波并打包成 PNG。
 *
 * @param rows 每行的原始通道数据（长度 = width * channels）
 * @param filters 每行使用的滤波类型（长度 = height）
 */
function makePng(options: {
  width: number
  height: number
  colorType: 2 | 6
  rows: number[][]
  filters: number[]
  bitDepth?: number
  interlace?: number
}): Buffer {
  const { width, height, colorType, rows, filters } = options
  const channels = colorType === 6 ? 4 : 3
  const stride = width * channels
  const out: number[] = []

  for (let y = 0; y < height; y++) {
    const row = rows[y]
    const prior = y > 0 ? rows[y - 1] : new Array(stride).fill(0)
    const filter = filters[y]
    out.push(filter)
    for (let i = 0; i < stride; i++) {
      const left = i >= channels ? row[i - channels] : 0
      const up = prior[i]
      const upLeft = i >= channels ? prior[i - channels] : 0
      const raw = row[i]
      let encoded
      switch (filter) {
        case 0:
          encoded = raw
          break
        case 1:
          encoded = raw - left
          break
        case 2:
          encoded = raw - up
          break
        case 3:
          encoded = raw - ((left + up) >> 1)
          break
        case 4:
          encoded = raw - paeth(left, up, upLeft)
          break
        default:
          throw new Error(`测试用例给了未知滤波 ${filter}`)
      }
      out.push(encoded & 0xff)
    }
  }

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = options.bitDepth ?? 8
  ihdr[9] = colorType
  ihdr[10] = 0
  ihdr[11] = 0
  ihdr[12] = options.interlace ?? 0

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(Buffer.from(out))),
    chunk('IEND', Buffer.alloc(0))
  ])
}

/** RGBA 取某个像素 */
const px = (img: { width: number; data: Buffer }, x: number, y: number) => {
  const o = (y * img.width + x) * 4
  return [img.data[o], img.data[o + 1], img.data[o + 2], img.data[o + 3]]
}

describe('png：解码', () => {
  it('五种滤波类型都能正确还原像素', () => {
    // 3x2 的 RGBA：两行各用不同滤波，一次覆盖 0–4
    const row0 = [10, 20, 30, 255, 40, 50, 60, 255, 70, 80, 90, 255]
    const row1 = [11, 21, 31, 255, 41, 51, 61, 255, 71, 81, 91, 255]

    for (const filter of [0, 1, 2, 3, 4]) {
      const png = makePng({ width: 3, height: 2, colorType: 6, rows: [row0, row1], filters: [filter, filter] })
      const img = decodePng(png)
      expect(img.width).toBe(3)
      expect(img.height).toBe(2)
      expect(px(img, 0, 0)).toEqual([10, 20, 30, 255])
      expect(px(img, 2, 0)).toEqual([70, 80, 90, 255])
      expect(px(img, 0, 1)).toEqual([11, 21, 31, 255])
      expect(px(img, 2, 1)).toEqual([71, 81, 91, 255])
    }
  })

  it('同一张图不同行可以用不同滤波（混合场景）', () => {
    const rows = [
      [1, 2, 3, 4, 5, 6],
      [7, 8, 9, 10, 11, 12],
      [13, 14, 15, 16, 17, 18]
    ]
    const png = makePng({ width: 2, height: 3, colorType: 2, rows, filters: [0, 1, 4] })
    const img = decodePng(png)
    expect(px(img, 0, 0)).toEqual([1, 2, 3, 255])
    expect(px(img, 1, 1)).toEqual([10, 11, 12, 255])
    expect(px(img, 1, 2)).toEqual([16, 17, 18, 255])
  })

  it('colorType 2（RGB）补出不透明的 alpha', () => {
    const png = makePng({ width: 1, height: 1, colorType: 2, rows: [[9, 8, 7]], filters: [0] })
    expect(px(decodePng(png), 0, 0)).toEqual([9, 8, 7, 255])
  })

  it('拒绝非 PNG 输入', () => {
    expect(() => decodePng(Buffer.from('not a png at all'))).toThrow(/签名/)
  })

  it('拒绝位深 16', () => {
    const png = makePng({ width: 1, height: 1, colorType: 2, rows: [[1, 2, 3]], filters: [0], bitDepth: 16 })
    expect(() => decodePng(png)).toThrow(/位深/)
  })

  it('拒绝隔行 PNG', () => {
    const png = makePng({ width: 1, height: 1, colorType: 2, rows: [[1, 2, 3]], filters: [0], interlace: 1 })
    expect(() => decodePng(png)).toThrow(/隔行/)
  })

  it('拒绝截断的 chunk', () => {
    const png = makePng({ width: 2, height: 1, colorType: 2, rows: [[1, 2, 3, 4, 5, 6]], filters: [0] })
    expect(() => decodePng(png.subarray(0, png.length - 20))).toThrow()
  })
})

describe('png：编码', () => {
  it('编码后再解码得到同样的像素', () => {
    const width = 4
    const height = 3
    const data = Buffer.alloc(width * height * 4)
    for (let i = 0; i < width * height; i++) {
      data[i * 4] = (i * 7) % 256
      data[i * 4 + 1] = (i * 13) % 256
      data[i * 4 + 2] = (i * 29) % 256
      data[i * 4 + 3] = i % 3 === 0 ? 128 : 255
    }
    const decoded = decodePng(encodePng({ width, height, data }))
    expect(decoded.width).toBe(width)
    expect(decoded.height).toBe(height)
    expect(Buffer.compare(decoded.data, data)).toBe(0)
  })

  it('尺寸或数据长度不合法时抛错，而不是写出坏文件', () => {
    expect(() => encodePng({ width: 0, height: 1, data: Buffer.alloc(4) })).toThrow(/尺寸/)
    expect(() => encodePng({ width: 2, height: 2, data: Buffer.alloc(4) })).toThrow(/长度/)
  })
})
