/**
 * 最小 PNG 编解码（零依赖，只用 node:zlib）。
 *
 * 视觉回归只需要「读 Chrome 的截图 → 比像素 → 写差异图」三件事。为这点需求
 * 装 sharp / pngjs 会把一个开发期工具变成运行时依赖，且 sharp 还要下载原生包。
 * PNG 的规范足够小，自己实现反而更可控。
 *
 * ## 支持范围（刻意收窄）
 *
 * - 位深 8，非隔行（Chrome 的 `Page.captureScreenshot` 只产出这种）
 * - colorType 2（RGB，Chrome 默认）与 6（RGBA，带透明时）
 * - 滤波类型 0–4 全部（Chrome 实测会用到 0 和 4）
 *
 * 不支持的输入直接抛错，**不猜**：静默产出错误像素会让视觉回归的结论失去意义。
 */
import { deflateSync, inflateSync } from 'node:zlib'

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

/** 每通道字节数（位深 8 时等于通道数） */
const CHANNELS = { 0: 1, 2: 3, 4: 2, 6: 4 }

// ---------------------------------------------------------------------------
// CRC32（PNG 每个 chunk 尾部都有）
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

function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

// ---------------------------------------------------------------------------
// 解码
// ---------------------------------------------------------------------------

/** Paeth 预测器（PNG 规范 §9.4） */
function paeth(a, b, c) {
  const p = a + b - c
  const pa = Math.abs(p - a)
  const pb = Math.abs(p - b)
  const pc = Math.abs(p - c)
  if (pa <= pb && pa <= pc) return a
  if (pb <= pc) return b
  return c
}

/**
 * 解码 PNG → `{ width, height, data }`，`data` 恒为 RGBA（每像素 4 字节）。
 *
 * 统一成 RGBA 是为了让「RGB 截图」与「带透明截图」能用同一套比较逻辑。
 */
export function decodePng(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 8 || !buffer.subarray(0, 8).equals(SIGNATURE)) {
    throw new Error('不是 PNG：签名不匹配')
  }

  let width = 0
  let height = 0
  let bitDepth = 0
  let colorType = 0
  let interlace = 0
  const idat = []

  let offset = 8
  while (offset + 8 <= buffer.length) {
    const length = buffer.readUInt32BE(offset)
    const type = buffer.toString('ascii', offset + 4, offset + 8)
    const dataStart = offset + 8
    const dataEnd = dataStart + length
    if (dataEnd + 4 > buffer.length) throw new Error(`PNG 截断：chunk ${type} 声明 ${length} 字节但数据不足`)

    if (type === 'IHDR') {
      const d = buffer.subarray(dataStart, dataEnd)
      width = d.readUInt32BE(0)
      height = d.readUInt32BE(4)
      bitDepth = d[8]
      colorType = d[9]
      if (d[10] !== 0) throw new Error(`不支持的压缩方法：${d[10]}`)
      if (d[11] !== 0) throw new Error(`不支持的滤波方法：${d[11]}`)
      interlace = d[12]
    } else if (type === 'IDAT') {
      idat.push(buffer.subarray(dataStart, dataEnd))
    } else if (type === 'IEND') {
      break
    }

    offset = dataEnd + 4
  }

  if (bitDepth !== 8) throw new Error(`只支持位深 8，实际 ${bitDepth}`)
  if (interlace !== 0) throw new Error('不支持隔行 PNG')
  const channels = CHANNELS[colorType]
  if (!channels) throw new Error(`不支持的 colorType：${colorType}（只支持 0/2/4/6）`)
  if (idat.length === 0) throw new Error('PNG 缺少 IDAT')
  if (width <= 0 || height <= 0) throw new Error(`PNG 尺寸非法：${width}x${height}`)

  const raw = inflateSync(Buffer.concat(idat))
  const stride = width * channels
  const expected = height * (stride + 1)
  if (raw.length !== expected) {
    throw new Error(`解压后字节数不符：期望 ${expected}，实际 ${raw.length}`)
  }

  const pixels = Buffer.alloc(width * height * 4)
  const prior = Buffer.alloc(stride)
  const line = Buffer.alloc(stride)

  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)]
    const src = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1))
    for (let i = 0; i < stride; i++) {
      const left = i >= channels ? line[i - channels] : 0
      const up = prior[i]
      const upLeft = i >= channels ? prior[i - channels] : 0
      let value
      switch (filter) {
        case 0:
          value = src[i]
          break
        case 1:
          value = src[i] + left
          break
        case 2:
          value = src[i] + up
          break
        case 3:
          value = src[i] + ((left + up) >> 1)
          break
        case 4:
          value = src[i] + paeth(left, up, upLeft)
          break
        default:
          throw new Error(`第 ${y} 行滤波类型未知：${filter}`)
      }
      line[i] = value & 0xff
    }

    // 统一成 RGBA
    for (let x = 0; x < width; x++) {
      const s = x * channels
      const d = (y * width + x) * 4
      if (channels === 1) {
        pixels[d] = pixels[d + 1] = pixels[d + 2] = line[s]
        pixels[d + 3] = 255
      } else if (channels === 2) {
        pixels[d] = pixels[d + 1] = pixels[d + 2] = line[s]
        pixels[d + 3] = line[s + 1]
      } else if (channels === 3) {
        pixels[d] = line[s]
        pixels[d + 1] = line[s + 1]
        pixels[d + 2] = line[s + 2]
        pixels[d + 3] = 255
      } else {
        pixels[d] = line[s]
        pixels[d + 1] = line[s + 1]
        pixels[d + 2] = line[s + 2]
        pixels[d + 3] = line[s + 3]
      }
    }

    line.copy(prior)
  }

  return { width, height, data: pixels }
}

// ---------------------------------------------------------------------------
// 编码
// ---------------------------------------------------------------------------

function chunk(type, data) {
  const head = Buffer.alloc(8)
  head.writeUInt32BE(data.length, 0)
  head.write(type, 4, 'ascii')
  const crcInput = Buffer.concat([head.subarray(4, 8), data])
  const tail = Buffer.alloc(4)
  tail.writeUInt32BE(crc32(crcInput), 0)
  return Buffer.concat([head, data, tail])
}

/**
 * 编码 RGBA 数据 → PNG。
 *
 * 一律用滤波类型 0（None）：差异图是给人看的，压缩率不重要，而实现越简单
 * 越不容易写错。产物只进 CI 产物目录，不进仓库。
 */
export function encodePng({ width, height, data }) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
    throw new Error(`尺寸非法：${width}x${height}`)
  }
  if (data.length !== width * height * 4) {
    throw new Error(`数据长度不符：期望 ${width * height * 4}，实际 ${data.length}`)
  }

  const stride = width * 4
  const raw = Buffer.alloc(height * (stride + 1))
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0
    data.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride)
  }

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // 位深
  ihdr[9] = 6 // RGBA
  ihdr[10] = 0
  ihdr[11] = 0
  ihdr[12] = 0

  return Buffer.concat([
    SIGNATURE,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ])
}
