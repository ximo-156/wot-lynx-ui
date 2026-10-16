/**
 * formatDate（dayjs 方案）行为锁定。
 *
 * 历史：本工具原为自研令牌替换实现（为"替代 dayjs"而写），现改用 dayjs
 * （成熟方案）。本测试锁定对外行为不变：
 * 1. 常用令牌与 locale 格式串（YYYY年MM月DD日 / YY-MM-DD HH:mm:ss 等）；
 * 2. 非法输入返回 'Invalid Date'（与 dayjs 原生一致）；
 * 3. 日历辅助函数 getMonthDays / getFirstDayOfWeek（含闰年 2 月）。
 */
import { describe, it, expect } from 'vitest'
import { formatDate, getFirstDayOfWeek, getMonthDays } from '../src/common/formatDate'

describe('formatDate（dayjs）', () => {
  it('按令牌格式化时间戳', () => {
    // 2025-01-01 00:00:00（本地时区）
    const ts = new Date(2025, 0, 1, 9, 5, 3).getTime()
    expect(formatDate(ts, 'YYYY-MM-DD')).toBe('2025-01-01')
    expect(formatDate(ts, 'YYYY-MM-DD HH:mm:ss')).toBe('2025-01-01 09:05:03')
    expect(formatDate(ts, 'YY/M/D H:m:s')).toBe('25/1/1 9:5:3')
  })

  it('支持中文等字面量格式串（locale 场景）', () => {
    const ts = new Date(2024, 11, 31, 23, 59, 58).getTime()
    expect(formatDate(ts, 'YYYY年MM月DD日 HH:mm:ss')).toBe('2024年12月31日 23:59:58')
    expect(formatDate(ts, 'YYYY年MM月')).toBe('2024年12月')
  })

  it('Date 对象入参', () => {
    expect(formatDate(new Date(2023, 4, 9), 'YYYY-MM-DD')).toBe('2023-05-09')
  })

  it('非法输入返回 Invalid Date', () => {
    expect(formatDate(Number.NaN, 'YYYY-MM-DD')).toBe('Invalid Date')
    expect(formatDate('not-a-date' as any, 'YYYY-MM-DD')).toBe('Invalid Date')
  })
})

describe('日历辅助函数', () => {
  it('getMonthDays：平年 / 闰年 2 月', () => {
    expect(getMonthDays(2023, 2)).toBe(28)
    expect(getMonthDays(2024, 2)).toBe(29)
    expect(getMonthDays(2024, 1)).toBe(31)
    expect(getMonthDays(2024, 4)).toBe(30)
  })

  it('getFirstDayOfWeek：0 为周日', () => {
    // 2024-06-01 是周六
    expect(getFirstDayOfWeek(2024, 6)).toBe(6)
    // 2024-09-01 是周日
    expect(getFirstDayOfWeek(2024, 9)).toBe(0)
  })
})
