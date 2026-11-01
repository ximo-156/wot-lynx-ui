/**
 * Code128 编码器验证测试。
 *
 * 两张表各自独立，互相钳制：
 * - 生产表 = src/components/wd-bar-code/code128.ts 的 CODE128_PATTERNS；
 * - 本文件的 SPEC_PATTERNS 是 ISO/IEC 15417（Wikipedia「Code 128」条目的
 *   Pattern 列，2026-10 转录）的**规范值**，不从生产代码推导。
 *
 * 历史事故：码表曾从 value 30 起整体错位且缺失 89-102，ZXing 实证
 * 12345/ABC123/HELLO 全部解码失败。整表对照 + 结构不变量就是防它复发。
 */
import { describe, it, expect } from 'vitest'
import {
  CODE128_PATTERNS,
  CODE128_START_B,
  CODE128_STOP,
  code128Checksum,
  encodeCode128B
} from '../../src/components/wd-bar-code/code128'

/** 规范码表（value 0-102），来源见文件头 */
const SPEC_PATTERNS = [
  '11011001100', '11001101100', '11001100110', '10010011000', '10010001100',
  '10001001100', '10011001000', '10011000100', '10001100100', '11001001000',
  '11001000100', '11000100100', '10110011100', '10011011100', '10011001110',
  '10111001100', '10011101100', '10011100110', '11001110010', '11001011100',
  '11001001110', '11011100100', '11001110100', '11101101110', '11101001100',
  '11100101100', '11100100110', '11101100100', '11100110100', '11100110010',
  '11011011000', '11011000110', '11000110110', '10100011000', '10001011000',
  '10001000110', '10110001000', '10001101000', '10001100010', '11010001000',
  '11000101000', '11000100010', '10110111000', '10110001110', '10001101110',
  '10111011000', '10111000110', '10001110110', '11101110110', '11010001110',
  '11000101110', '11011101000', '11011100010', '11011101110', '11101011000',
  '11101000110', '11100010110', '11101101000', '11101100010', '11100011010',
  '11101111010', '11001000010', '11110001010', '10100110000', '10100001100',
  '10010110000', '10010000110', '10000101100', '10000100110', '10110010000',
  '10110000100', '10011010000', '10011000010', '10000110100', '10000110010',
  '11000010010', '11001010000', '11110111010', '11000010100', '10001111010',
  '10100111100', '10010111100', '10010011110', '10111100100', '10011110100',
  '10011110010', '11110100100', '11110010100', '11110010010', '11011011110',
  '11011110110', '11110110110', '10101111000', '10100011110', '10001011110',
  '10111101000', '10111100010', '11110101000', '11110100010', '10111011110',
  '10111101110', '11101011110', '11110101110'
]

describe('Code128 码表', () => {
  it('103 项齐全（历史事故：缺失 89-102）', () => {
    expect(CODE128_PATTERNS).toHaveLength(103)
  })

  it('逐项等于规范值（value 0-102）', () => {
    for (let v = 0; v < SPEC_PATTERNS.length; v++) {
      expect(CODE128_PATTERNS[v], `value ${v}`).toBe(SPEC_PATTERNS[v])
    }
  })

  it('每个模式 11 模块、6 游程、每游程 1-4（Code128 数据符号不变量）', () => {
    for (let v = 0; v < CODE128_PATTERNS.length; v++) {
      const p = CODE128_PATTERNS[v]
      const runs = p.match(/1+|0+/g)!
      expect(runs, `value ${v} 游程数`).toHaveLength(6)
      for (const r of runs) {
        expect(r.length, `value ${v} 游程宽度`).toBeGreaterThanOrEqual(1)
        expect(r.length, `value ${v} 游程宽度`).toBeLessThanOrEqual(4)
      }
      const dark = runs.filter((_, i) => i % 2 === 0).reduce((s, r) => s + r.length, 0)
      const light = runs.filter((_, i) => i % 2 === 1).reduce((s, r) => s + r.length, 0)
      expect(dark % 2, `value ${v} 黑条宽和应偶`).toBe(0)
      expect(light % 2, `value ${v} 空白宽和应奇`).toBe(1)
      expect(dark + light, `value ${v} 模块总数`).toBe(11)
    }
  })

  it('Start B / Stop 与规范一致', () => {
    expect(CODE128_START_B).toBe('11010010000') // value 104
    expect(CODE128_STOP).toBe('1100011101011') // value 106 + 2 模块终止条
    expect(CODE128_STOP).toHaveLength(13)
  })
})

describe('Code128 校验位', () => {
  it('加权和模 103（Start 占 0 位）', () => {
    // 规范示例：Start B(104) + '1'(17)×1 + '2'(18)×2 = 104+17+36 = 157 → 54
    expect(code128Checksum([104, 17, 18])).toBe(157 % 103)
  })
})

describe('Code128 B 编码', () => {
  it('12345 全位流（历史 ZXing 实证用例）', () => {
    const bits = encodeCode128B('12345')
    // 104 + 17·1 + 18·2 + 19·3 + 20·4 + 21·5 = 399 → 399 % 103 = 90
    const expected =
      CODE128_START_B +
      SPEC_PATTERNS[17] + SPEC_PATTERNS[18] + SPEC_PATTERNS[19] + SPEC_PATTERNS[20] + SPEC_PATTERNS[21] +
      SPEC_PATTERNS[90] +
      CODE128_STOP
    expect(bits).toBe(expected)
    expect(bits).toHaveLength(11 * 7 + 13)
  })

  it('ABC123 与 HELLO 全位流', () => {
    for (const text of ['ABC123', 'HELLO']) {
      const values = [104, ...[...text].map((c) => c.charCodeAt(0) - 32)]
      const check = code128Checksum(values)
      const expected =
        CODE128_START_B +
        values.slice(1).map((v) => SPEC_PATTERNS[v]).join('') +
        SPEC_PATTERNS[check] +
        CODE128_STOP
      expect(encodeCode128B(text), text).toBe(expected)
    }
  })

  it('可打印 ASCII 全集（value 0-94）逐位可解码还原', () => {
    const text = Array.from({ length: 95 }, (_, i) => String.fromCharCode(32 + i)).join('')
    const bits = encodeCode128B(text)
    // 用规范表独立解码（不碰生产编码器的组装逻辑）
    const body = bits.slice(11, bits.length - 13)
    const symbols: number[] = []
    for (let i = 0; i < body.length; i += 11) {
      const v = SPEC_PATTERNS.indexOf(body.slice(i, i + 11))
      expect(v, `第 ${i / 11} 个符号应在规范表中`).toBeGreaterThanOrEqual(0)
      symbols.push(v)
    }
    // 末位是校验位：按规范公式独立重算
    const check = code128Checksum([104, ...symbols.slice(0, -1)])
    expect(symbols[symbols.length - 1]).toBe(check)
    // 数据符号还原原文
    expect(symbols.slice(0, -1).map((v) => String.fromCharCode(v + 32)).join('')).toBe(text)
  })

  it('相同输入输出确定，不同输入输出不同', () => {
    expect(encodeCode128B('ABC')).toBe(encodeCode128B('ABC'))
    expect(encodeCode128B('ABC')).not.toBe(encodeCode128B('ABD'))
  })

  it('非可打印 ASCII 抛错（不静默替换成空格）', () => {
    expect(() => encodeCode128B('中文')).toThrow(/printable ASCII/)
    expect(() => encodeCode128B('a\u0000b')).toThrow()
    expect(() => encodeCode128B('a\u007fb')).toThrow()
  })
})
