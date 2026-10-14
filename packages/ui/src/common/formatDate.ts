/**
 * 轻量级日期格式化工具，用于替代 dayjs
 */

/**
 * 日期格式化函数，替代 dayjs.format()
 * @param date 日期（时间戳或 Date 对象）
 * @param format 格式模板，如 'YYYY-MM-DD HH:mm:ss'
 * @returns 格式化后的字符串
 */
export function formatDate(date: number | Date, format: string): string {
  const d = date instanceof Date ? date : new Date(date)

  if (isNaN(d.getTime())) {
    return 'Invalid Date'
  }

  const year = d.getFullYear()
  const month = d.getMonth() + 1
  const day = d.getDate()
  const hours = d.getHours()
  const minutes = d.getMinutes()
  const seconds = d.getSeconds()

  const tokens: Record<string, string> = {
    YYYY: String(year),
    YY: String(year).slice(-2),
    MM: String(month).padStart(2, '0'),
    M: String(month),
    DD: String(day).padStart(2, '0'),
    D: String(day),
    HH: String(hours).padStart(2, '0'),
    H: String(hours),
    mm: String(minutes).padStart(2, '0'),
    m: String(minutes),
    ss: String(seconds).padStart(2, '0'),
    s: String(seconds)
  }

  const pattern = Object.keys(tokens)
    .sort((a, b) => b.length - a.length)
    .join('|')

  return format.replace(new RegExp(pattern, 'g'), (match) => tokens[match] || match)
}

/**
 * 获取月份天数
 */
export function getMonthDays(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

/**
 * 获取某月第一天是星期几（0-6，0 为周日）
 */
export function getFirstDayOfWeek(year: number, month: number): number {
  return new Date(year, month - 1, 1).getDay()
}
