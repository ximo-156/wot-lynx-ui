/** Application-local viewport overrides and notifications (no Vue/DOM dependency). */
export interface ViewportSize {
  width: number
  height: number
}

export const VIEWPORT_CHANGE_EVENT = 'wot:viewport-change'

let override: ViewportSize | null = null
const listeners = new Set<() => void>()

export function normalizeViewportSize(size: unknown): ViewportSize | null {
  const value = size as Partial<ViewportSize> | null
  const width = Number(value?.width)
  const height = Number(value?.height)
  return Number.isFinite(width) && width > 0 && Number.isFinite(height) && height > 0
    ? { width, height }
    : null
}

/** Invalid dimensions clear the override, rather than propagating NaN/Infinity/zero. */
export function setViewportOverride(size: ViewportSize | null): void {
  const next = normalizeViewportSize(size)
  if (next?.width === override?.width && next?.height === override?.height) return
  override = next
  for (const notify of [...listeners]) notify()
}

export function getViewportOverride(): ViewportSize | null {
  return override ? { ...override } : null
}

export function hasViewportOverride(): boolean {
  return override !== null
}

export function subscribeViewportChange(notify: () => void): () => void {
  listeners.add(notify)
  return () => { listeners.delete(notify) }
}
