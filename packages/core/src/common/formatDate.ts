/**
 * 日期时间工具 —— 基于 dayjs（成熟方案，不自研格式解析）。
 *
 * dayjs 为纯 JS、无 DOM 依赖、体积约 2KB，可在 Lynx 后台线程直接运行；
 * 其格式令牌（YYYY / MM / DD / HH / mm / ss）与本库 locale 的
 * dateFormat / timeFormat / monthFormat 完全一致。
 */

import dayjs from 'dayjs'

/**
 * 日期格式化函数
 * @param date 日期（时间戳或 Date 对象）
 * @param format 格式模板，如 'YYYY-MM-DD HH:mm:ss'
 * @returns 格式化后的字符串（非法输入返回 'Invalid Date'，与 dayjs 一致）
 */
export function formatDate(date: number | Date, format: string): string {
  return dayjs(date).format(format)
}

/**
 * 获取月份天数
 */
export function getMonthDays(year: number, month: number): number {
  return dayjs(new Date(year, month, 0)).date()
}

/**
 * 获取某月第一天是星期几（0-6，0 为周日）
 */
export function getFirstDayOfWeek(year: number, month: number): number {
  return dayjs(new Date(year, month - 1, 1)).day()
}
