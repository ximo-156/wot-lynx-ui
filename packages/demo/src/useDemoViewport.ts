import { onBeforeUnmount } from 'vue-lynx'
import { getViewportOverride, setViewportOverride } from 'wot-lynx-ui'

/** Report the unpadded app root, never the scroll content or an inset-reduced box. */
export function useDemoViewport() {
  const previous = getViewportOverride()
  let owned: { width: number; height: number } | null = null
  let disposed = false
  function onViewportLayout(event: any) {
    if (disposed) return
    const layout = event?.detail?.layout ?? event?.detail
    const width = Number(layout?.width)
    const height = Number(layout?.height)
    if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0) return
    owned = { width, height }
    setViewportOverride(owned)
  }
  onBeforeUnmount(() => {
    disposed = true
    const current = getViewportOverride()
    if (owned && current?.width === owned.width && current?.height === owned.height) setViewportOverride(previous)
  })
  return { onViewportLayout }
}
