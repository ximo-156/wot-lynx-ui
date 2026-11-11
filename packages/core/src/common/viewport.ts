/**
 * Shared responsive breakpoints. Dimensions use the same source as getSystemInfo:
 * explicit application override > host window dimensions > browser viewport (Web
 * only) > native SystemInfo. A Lynx Web Worker has no window; its browser host must
 * forward the lynx-view dimensions (pluginWotLynxWebViewport does this).
 */
import { getSystemInfo } from './util'

export type { ViewportSize } from './viewport-state'
export { getViewportOverride, hasViewportOverride, setViewportOverride } from './viewport-state'

export const VIEWPORT_BREAKPOINTS = {
  wide: 768,
  desktop: 1024
} as const

/** Read on demand; override changes also notify mounted useViewportSize consumers. */
export function getViewportSize(): { width: number; height: number } {
  const info = getSystemInfo()
  return { width: info.windowWidth, height: info.windowHeight }
}

export function isWideViewport(width: number): boolean {
  return Number.isFinite(Number(width)) && Number(width) >= VIEWPORT_BREAKPOINTS.wide
}

export function isDesktopViewport(width: number): boolean {
  return Number.isFinite(Number(width)) && Number(width) >= VIEWPORT_BREAKPOINTS.desktop
}
