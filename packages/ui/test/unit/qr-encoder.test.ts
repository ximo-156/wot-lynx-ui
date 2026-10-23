/**
 * QR 编码器验证测试。
 *
 * 验证结构不变量（finder 图案、timing、尺寸、确定性）与
 * 已知模式（版本选择、填充字节行为）。
 */
import { describe, it, expect } from 'vitest'
import { encodeQr } from '../../src/components/wd-qr-code/qr-encoder'

describe('QR 编码器', () => {
  it('短内容选择版本 1 且尺寸 21', () => {
    const { size } = encodeQr('HELLO')
    expect(size).toBe(21)
  })

  it('finder 图案位于三个角', () => {
    const { rows, size } = encodeQr('TEST')
    // 左上 7×7 外框应为深色
    for (let i = 0; i < 7; i++) {
      expect(rows[0][i]).toBe(true)
      expect(rows[i][0]).toBe(true)
      expect(rows[6][i]).toBe(true)
      expect(rows[i][6]).toBe(true)
    }
    // 左上 3×3 核心应为深色
    for (let r = 2; r <= 4; r++) {
      for (let c = 2; c <= 4; c++) {
        expect(rows[r][c]).toBe(true)
      }
    }
    // 右上 / 左下 finder
    expect(rows[0][size - 1]).toBe(true)
    expect(rows[size - 1][0]).toBe(true)
  })

  it('timing 图案第 6 行/列交替', () => {
    const { rows, size } = encodeQr('TIMING')
    for (let i = 8; i < size - 8; i++) {
      expect(rows[6][i]).toBe(i % 2 === 0)
      expect(rows[i][6]).toBe(i % 2 === 0)
    }
  })

  it('dark module 位于 (size-8, 8)', () => {
    const { rows, size } = encodeQr('DARK')
    expect(rows[size - 8][8]).toBe(true)
  })

  it('相同输入输出确定（掩码评估稳定）', () => {
    const a = encodeQr('deterministic')
    const b = encodeQr('deterministic')
    expect(a.rows).toEqual(b.rows)
  })

  it('不同内容输出不同', () => {
    const a = encodeQr('AAA')
    const b = encodeQr('BBB')
    expect(a.rows).not.toEqual(b.rows)
  })

  it('长内容升级版本（size 随之增大）', () => {
    const short = encodeQr('x')
    const long = encodeQr('x'.repeat(80))
    expect(long.size).toBeGreaterThan(short.size)
  })

  it('UTF-8 中文内容可编码（4 字 = 12 字节，版本 1 可容纳）', () => {
    const { size } = encodeQr('中文内容')
    expect(size).toBe(21)
  })

  it('超长内容抛错（v40 容量上限）', () => {
    // wot-ui 同源编码器支持版本 1-40（Byte 模式 ECC M 上限约 2953 字节），
    // 超出后抛 "Too long data"（对齐参考源行为）
    expect(() => encodeQr('x'.repeat(3000))).toThrow('Too long data')
    // 500 字符在 v40 容量内，正常编码（旧实现的 v10 上限已随同源编码器移除）
    expect(encodeQr('x'.repeat(500)).size).toBeGreaterThan(21)
  })
})
