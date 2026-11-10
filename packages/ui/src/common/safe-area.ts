import { getHost } from './host'
import { getSystemInfo, type SystemInfo } from './util'

/** Logical pixels relative to the current LynxView, not the physical display. */
export interface SafeAreaInsets {
  top: number
  right: number
  bottom: number
  left: number
}
export type SafeAreaEdge = keyof SafeAreaInsets
export interface SafeAreaInfo extends SafeAreaInsets {
  /** Distinguishes an explicitly safe edge (0) from missing host information. */
  known: Record<SafeAreaEdge, boolean>
}

function finite(value: unknown, signed = false): number | undefined {
  if (typeof value !== 'number' && (typeof value !== 'string' || !value.trim())) return undefined
  const number = Number(value)
  return Number.isFinite(number) && (signed || number >= 0) ? number : undefined
}

/**
 * Insets are already window-relative. Legacy safeArea rectangles are screen-relative:
 * intersect them with the window instead of adding screen insets a second time.
 * A zero/invalid placeholder rectangle is not an unsafe area the size of the screen.
 * Missing window origins stay unknown, even when getSystemInfo supplies a legacy 0.
 */
export function resolveSafeAreaInsets(info: SystemInfo, hostInsets?: Partial<SafeAreaInsets> | null): SafeAreaInfo {
  const width = Math.max(0, finite(info.windowWidth) ?? 0)
  const height = Math.max(0, finite(info.windowHeight) ?? 0)
  const topCoordinate = finite(info.windowTop, true)
  const leftCoordinate = finite(info.windowLeft, true)
  const topKnown = info.windowTopKnown !== false && topCoordinate !== undefined
  const leftKnown = info.windowLeftKnown !== false && leftCoordinate !== undefined
  const windowTop = topCoordinate ?? 0
  const windowLeft = leftCoordinate ?? 0
  const area = info.safeArea
  const top = finite(area?.top)
  const bottom = finite(area?.bottom)
  const left = finite(area?.left)
  const right = finite(area?.right)
  const vertical = bottom !== undefined && bottom > (top ?? 0) && bottom <= info.screenHeight
  const horizontal = right !== undefined && right > (left ?? 0) && right <= info.screenWidth
  const statusBar = finite(info.statusBarHeight)
  const rectangle: Partial<SafeAreaInsets> = {
    top: topKnown ? (vertical && top !== undefined ? top - windowTop : statusBar ? statusBar - windowTop : undefined) : undefined,
    bottom: topKnown && vertical ? windowTop + height - bottom! : undefined,
    left: leftKnown && horizontal && left !== undefined ? left - windowLeft : undefined,
    right: leftKnown && horizontal ? windowLeft + width - right! : undefined
  }
  const result: SafeAreaInfo = { top: 0, right: 0, bottom: 0, left: 0, known: { top: false, right: false, bottom: false, left: false } }
  for (const edge of ['top', 'right', 'bottom', 'left'] as const) {
    // Null/invalid per-edge values fall through; an explicit 0 must win.
    const value = finite(hostInsets?.[edge]) ?? finite(info.safeAreaInsets?.[edge]) ?? rectangle[edge]
    if (value === undefined) continue
    const limit = edge === 'top' || edge === 'bottom' ? height : width
    result[edge] = Math.min(limit, Math.max(0, value))
    result.known[edge] = true
  }
  return result
}

/**
 * Native SystemInfo only guarantees screen metrics. The optional host method supplies
 * actual iOS safeAreaInsets / Android WindowInsets, already relative to its LynxView.
 * Read on demand so reopening after host registration or rotation never uses a snapshot.
 */
export function getSafeAreaInsets(info = getSystemInfo()): SafeAreaInfo {
  let hostInsets: Partial<SafeAreaInsets> | null | undefined
  try { hostInsets = getHost().getSafeAreaInsets?.() } catch { /* Retain SystemInfo fallback. */ }
  return resolveSafeAreaInsets(info, hostInsets)
}
