/**
 * 极简 QR Code 编码器（Byte 模式，版本 1-10，ECC Level M）。
 *
 * 流程：数据编码 → Reed-Solomon 纠错 → 分块交织 → 矩阵构建 →
 * 掩码评估。产出模块矩阵（true = 深色）。
 */

// ===== GF(256) 算术（本原多项式 0x11D） =====
const EXP = new Uint8Array(512)
const LOG = new Uint8Array(256)
;(() => {
  let x = 1
  for (let i = 0; i < 255; i++) {
    EXP[i] = x
    LOG[x] = i
    x <<= 1
    if (x & 0x100) x ^= 0x11d
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255]
})()

function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0
  return EXP[LOG[a] + LOG[b]]
}

/** 生成多项式 */
function generatorPoly(degree: number): Uint8Array {
  let poly = new Uint8Array([1])
  for (let i = 0; i < degree; i++) {
    const next = new Uint8Array(poly.length + 1)
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= poly[j]
      next[j + 1] ^= gfMul(poly[j], EXP[i])
    }
    poly = next
  }
  return poly
}

/** Reed-Solomon 纠错码 */
function rsEncode(data: Uint8Array, eccLen: number): Uint8Array {
  const gen = generatorPoly(eccLen)
  const result = new Uint8Array(eccLen)
  for (const byte of data) {
    const factor = byte ^ result[0]
    result.copyWithin(0, 1)
    result[eccLen - 1] = 0
    for (let i = 0; i < eccLen; i++) {
      result[i] ^= gfMul(gen[i + 1], factor)
    }
  }
  return result
}

// ===== 版本参数（ECC Level M：数据码字 / 纠错码字 / 每块） =====
// [version, totalDataCodewords, eccPerBlock, group1Blocks, group1DataPerBlock, group2Blocks, group2DataPerBlock]
const VERSION_TABLE: number[][] = [
  [1, 16, 10, 1, 16, 0, 0],
  [2, 28, 16, 1, 28, 0, 0],
  [3, 44, 26, 1, 44, 0, 0],
  [4, 64, 18, 2, 32, 0, 0],
  [5, 86, 24, 2, 43, 0, 0],
  [6, 108, 16, 4, 27, 0, 0],
  [7, 124, 18, 4, 31, 0, 0],
  [8, 154, 22, 2, 38, 2, 39],
  [9, 182, 22, 3, 36, 2, 37],
  [10, 216, 26, 4, 43, 1, 44]
]

/** 对齐图案中心位置 */
function alignmentPositions(version: number): number[] {
  if (version === 1) return []
  const num = Math.floor(version / 7) + 2
  const step = version === 32 ? 26 : Math.ceil((version * 4 + 4) / (num * 2 - 2)) * 2
  const result: number[] = []
  const size = version * 4 + 17
  let pos = size - 7
  while (pos > 6) {
    result.unshift(pos)
    pos -= step
  }
  result.unshift(6)
  return result
}

/** 选择版本（Byte 模式，ECC M） */
function selectVersion(byteLen: number): number {
  for (const [version, dataCodewords] of VERSION_TABLE) {
    const ccBits = version >= 10 ? 16 : 8
    const needed = 4 + ccBits + byteLen * 8
    if (needed <= dataCodewords * 8) return version
  }
  throw new Error('content too long for qr-code (max version 10)')
}

/** UTF-8 编码 */
function toUtf8(text: string): Uint8Array {
  const bytes: number[] = []
  for (const ch of text) {
    const code = ch.codePointAt(0)!
    if (code < 0x80) bytes.push(code)
    else if (code < 0x800) bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f))
    else if (code < 0x10000) bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f))
    else bytes.push(0xf0 | (code >> 18), 0x80 | ((code >> 12) & 0x3f), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f))
  }
  return new Uint8Array(bytes)
}

/** 位缓冲 */
class BitBuffer {
  bits: number[] = []
  put(value: number, length: number) {
    for (let i = length - 1; i >= 0; i--) {
      this.bits.push((value >>> i) & 1)
    }
  }
}

/** 构建最终码字流（数据 + 纠错，按标准交织） */
function buildCodewords(data: Uint8Array, version: number): Uint8Array {
  const row = VERSION_TABLE[version - 1]
  const eccPerBlock = row[2]
  const g1 = row[3]
  const g1Data = row[4]
  const g2 = row[5]
  const g2Data = row[6]

  // 数据分块
  const blocks: Uint8Array[] = []
  let offset = 0
  for (let i = 0; i < g1; i++) {
    blocks.push(data.slice(offset, offset + g1Data))
    offset += g1Data
  }
  for (let i = 0; i < g2; i++) {
    blocks.push(data.slice(offset, offset + g2Data))
    offset += g2Data
  }

  // 每块计算纠错
  const eccBlocks = blocks.map((b) => rsEncode(b, eccPerBlock))

  // 交织数据
  const maxDataLen = Math.max(...blocks.map((b) => b.length))
  const result: number[] = []
  for (let i = 0; i < maxDataLen; i++) {
    for (const b of blocks) {
      if (i < b.length) result.push(b[i])
    }
  }
  // 交织纠错
  for (let i = 0; i < eccPerBlock; i++) {
    for (const e of eccBlocks) {
      result.push(e[i])
    }
  }
  return new Uint8Array(result)
}

/** 放置功能图案（finder / separator / timing / alignment / dark module） */
function placeFunctional(matrix: (boolean | null)[][], size: number, version: number) {
  const reserved: boolean[][] = matrix.map(() => new Array(size).fill(false))

  const setFn = (r: number, c: number, v: boolean) => {
    matrix[r][c] = v
    reserved[r][c] = true
  }

  // Finder 图案（三个角）
  const finder = [
    [0, 0],
    [0, size - 7],
    [size - 7, 0]
  ]
  for (const [r0, c0] of finder) {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const rr = r0 + r
        const cc = c0 + c
        if (rr < 0 || rr >= size || cc < 0 || cc >= size) continue
        const inRing = r >= 0 && r <= 6 && c >= 0 && c <= 6
        const dark = inRing && (r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4))
        setFn(rr, cc, dark)
      }
    }
  }

  // Timing 图案
  for (let i = 8; i < size - 8; i++) {
    const dark = i % 2 === 0
    setFn(6, i, dark)
    setFn(i, 6, dark)
  }

  // Alignment 图案
  const positions = alignmentPositions(version)
  for (const r of positions) {
    for (const c of positions) {
      // 跳过 finder 区域
      if ((r <= 8 && c <= 8) || (r <= 8 && c >= size - 9) || (r >= size - 9 && c <= 8)) continue
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          const dark = Math.max(Math.abs(dr), Math.abs(dc)) !== 1
          setFn(r + dr, c + dc, dark)
        }
      }
    }
  }

  // Dark module
  setFn(size - 8, 8, true)

  // 格式信息预留
  for (let i = 0; i < 9; i++) {
    if (!reserved[8][i]) setFn(8, i, false)
    if (!reserved[i][8]) setFn(i, 8, false)
  }
  for (let i = 0; i < 8; i++) {
    if (!reserved[8][size - 1 - i]) setFn(8, size - 1 - i, false)
    if (!reserved[size - 1 - i][8]) setFn(size - 1 - i, 8, false)
  }

  // 版本信息（v7+）：BCH(18,6) 版本位，生成多项式 0x1F25（ISO/IEC 18004 §7.9）
  // 历史版本只预留位置不写入（全 false），解码器读到的版本信息恒为 0，
  // v7+ 的码（UTF-8 ≥107 字节）全部不可解码（jsQR 实证：v1-v6 正常、
  // v8/v9/v10 失败，写回正确版本位后立即解码成功）。
  if (version >= 7) {
    const vBits = versionInfoBits(version)
    for (let i = 0; i < 18; i++) {
      const r = Math.floor(i / 3)
      const c = size - 11 + (i % 3)
      setFn(r, c, vBits[i] === 1) // 右上块（rows 0-5 × cols size-11..size-9）
      setFn(c, r, vBits[i] === 1) // 左下块（rows size-11..size-9 × cols 0-5）
    }
  }

  return reserved
}

/**
 * 版本信息位（BCH(18,6)，generator 0x1F25）。
 * 返回 18 位、低位在前（i=0 为 bit0），与放置循环的 i=0..17 对应：
 * 放置几何（右上 rows 0-5 × cols size-11..size-9，左下为其转置）下，
 * i=17 的位置承载 18 位值的最高位（jsQR/ZXing 均按此序读取，
 * 已双解码器实证：v8/v9/v10 精确解码）。
 */
function versionInfoBits(version: number): number[] {
  let rem = version
  for (let i = 0; i < 12; i++) {
    rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25)
  }
  const bits = (version << 12) | (rem & 0xfff)
  const result: number[] = []
  for (let i = 0; i < 18; i++) result.push((bits >>> i) & 1)
  return result
}

/** 数据位放置（Z 字形） */
function placeData(matrix: (boolean | null)[][], reserved: boolean[][], size: number, bits: number[]) {
  let bitIndex = 0
  let upward = true
  for (let col = size - 1; col >= 1; col -= 2) {
    if (col === 6) col = 5 // 跳过 timing 列
    for (let i = 0; i < size; i++) {
      const row = upward ? size - 1 - i : i
      for (const c of [col, col - 1]) {
        if (reserved[row][c]) continue
        const bit = bitIndex < bits.length ? bits[bitIndex++] : 0
        matrix[row][c] = bit === 1
      }
    }
    upward = !upward
  }
}

/** 掩码 */
function maskBit(mask: number, r: number, c: number): boolean {
  switch (mask) {
    case 0: return (r + c) % 2 === 0
    case 1: return r % 2 === 0
    case 2: return c % 3 === 0
    case 3: return (r + c) % 3 === 0
    case 4: return (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0
    case 5: return ((r * c) % 2) + ((r * c) % 3) === 0
    case 6: return (((r * c) % 2) + ((r * c) % 3)) % 2 === 0
    case 7: return (((r + c) % 2) + ((r * c) % 3)) % 2 === 0
    default: return false
  }
}

/** 格式信息（ECC M = 0b00） */
function formatInfoBits(mask: number): number[] {
  const data = (0b00 << 3) | mask
  let rem = data
  for (let i = 0; i < 10; i++) {
    rem = (rem << 1) ^ ((rem >>> 9) * 0x537)
  }
  const bits = ((data << 10) | (rem & 0x3ff)) ^ 0x5412
  const result: number[] = []
  for (let i = 14; i >= 0; i--) result.push((bits >>> i) & 1)
  return result
}

/** 放置格式信息 */
function placeFormatInfo(matrix: (boolean | null)[][], size: number, mask: number) {
  const bits = formatInfoBits(mask)
  // 第一份（绕左上）
  for (let i = 0; i <= 5; i++) matrix[8][i] = bits[i] === 1
  matrix[8][7] = bits[6] === 1
  matrix[8][8] = bits[7] === 1
  matrix[7][8] = bits[8] === 1
  for (let i = 9; i < 15; i++) matrix[14 - i][8] = bits[i] === 1
  // 第二份（右下 + 左下）
  for (let i = 0; i < 8; i++) matrix[size - 1 - i][8] = bits[i] === 1
  for (let i = 8; i < 15; i++) matrix[8][size - 15 + i] = bits[i] === 1
  matrix[size - 8][8] = true // dark module
}

/** 掩码惩罚评估（简化版） */
function penalty(matrix: boolean[][], size: number): number {
  let score = 0
  // 规则 1：连续同色
  for (let r = 0; r < size; r++) {
    let run = 1
    for (let c = 1; c < size; c++) {
      if (matrix[r][c] === matrix[r][c - 1]) run++
      else {
        if (run >= 5) score += run - 2
        run = 1
      }
    }
    if (run >= 5) score += run - 2
  }
  for (let c = 0; c < size; c++) {
    let run = 1
    for (let r = 1; r < size; r++) {
      if (matrix[r][c] === matrix[r - 1][c]) run++
      else {
        if (run >= 5) score += run - 2
        run = 1
      }
    }
    if (run >= 5) score += run - 2
  }
  return score
}

/**
 * 编码文本为 QR 模块矩阵。
 * @returns { rows: boolean[][], size: number }
 */
export function encodeQr(text: string): { rows: boolean[][]; size: number } {
  const bytes = toUtf8(text)
  const version = selectVersion(bytes.length)
  const size = version * 4 + 17
  const ccBits = version >= 10 ? 16 : 8

  // 数据编码
  const buffer = new BitBuffer()
  buffer.put(0b0100, 4) // Byte 模式
  buffer.put(bytes.length, ccBits)
  for (const b of bytes) buffer.put(b, 8)

  const row = VERSION_TABLE[version - 1]
  const totalDataBits = row[1] * 8
  // Terminator
  const terminator = Math.min(4, totalDataBits - buffer.bits.length)
  buffer.put(0, terminator)
  // 位对齐
  while (buffer.bits.length % 8 !== 0) buffer.put(0, 1)

  // 填充字节
  const padBytes = [0xec, 0x11]
  let padIndex = 0
  while (buffer.bits.length < totalDataBits) {
    buffer.put(padBytes[padIndex % 2], 8)
    padIndex++
  }

  const dataCodewords = new Uint8Array(totalDataBits / 8)
  for (let i = 0; i < buffer.bits.length; i++) {
    if (buffer.bits[i]) dataCodewords[i >> 3] |= 1 << (7 - (i & 7))
  }

  const codewords = buildCodewords(dataCodewords, version)

  // 矩阵构建
  const matrix: (boolean | null)[][] = Array.from({ length: size }, () => new Array(size).fill(null))
  const reserved = placeFunctional(matrix, size, version)

  // 选择最佳掩码
  let bestMask = 0
  let bestScore = Infinity
  let bestMatrix: boolean[][] = []

  for (let mask = 0; mask < 8; mask++) {
    // 重置数据区
    const work: (boolean | null)[][] = matrix.map((r) => [...r])
    const bits: number[] = []
    for (const byte of codewords) {
      for (let i = 7; i >= 0; i--) bits.push((byte >>> i) & 1)
    }
    placeData(work, reserved, size, bits)

    // 应用掩码
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (!reserved[r][c] && maskBit(mask, r, c)) {
          work[r][c] = !work[r][c]
        }
      }
    }
    placeFormatInfo(work, size, mask)

    const finalized = work.map((r) => r.map((v) => v === true))
    const score = penalty(finalized, size)
    if (score < bestScore) {
      bestScore = score
      bestMask = mask
      bestMatrix = finalized
    }
  }

  return { rows: bestMatrix, size }
}
