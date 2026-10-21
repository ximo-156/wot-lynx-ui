import type { SpanMethodResult } from './types'

/** Lynx lacks CSS Grid; shared row tracks preserve independent column/merge positions. */
export interface TableCellMeasure { rowIndex: number; rowspan: number; height: number }
export interface TableRowTracks { heights: number[]; offsets: number[]; total: number }

export function resolveTableRows(count: number, fallback: number, virtual: boolean, measures: TableCellMeasure[]): TableRowTracks {
  const heights = Array.from({ length: count }, () => virtual ? fallback : 0)
  if (!virtual) {
    for (const cell of measures) {
      if (cell.rowspan === 1 && cell.rowIndex >= 0 && cell.rowIndex < count) {
        heights[cell.rowIndex] = Math.max(heights[cell.rowIndex], cell.height)
      }
    }
    for (let i = 0; i < count; i++) if (!heights[i]) heights[i] = fallback
    for (const cell of measures) {
      if (cell.rowspan <= 1 || cell.rowIndex < 0 || cell.rowIndex >= count) continue
      const end = Math.min(count, cell.rowIndex + cell.rowspan)
      const current = heights.slice(cell.rowIndex, end).reduce((sum, height) => sum + height, 0)
      if (cell.height > current) {
        const extra = (cell.height - current) / (end - cell.rowIndex)
        for (let i = cell.rowIndex; i < end; i++) heights[i] += extra
      }
    }
  }
  const offsets = [0]
  for (const height of heights) offsets.push(offsets[offsets.length - 1] + height)
  return { heights, offsets, total: offsets[offsets.length - 1] }
}

export function normalizeTableSpan(result: SpanMethodResult | void): SpanMethodResult {
  if (!result) return { rowspan: 1, colspan: 1 }
  const valid = (value: number) => Number.isFinite(value) && value >= 0 ? Math.floor(value) : 1
  return { rowspan: valid(result.rowspan), colspan: valid(result.colspan) }
}
