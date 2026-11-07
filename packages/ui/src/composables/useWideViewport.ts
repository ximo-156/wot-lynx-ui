/** Reactive application dimensions, including Lynx Web Worker host events. */
import { computed, onBeforeUnmount, onMounted, ref, type ComputedRef, type Ref } from 'vue-lynx'
import { getBrowserViewport, getSystemInfo } from '../common/util'

// Some runtimes expose the SDK as a script binding rather than an own global property.
declare const lynx: any
import { getUniAdapter } from '../common/uniAdapter'
import { getViewportSize, isWideViewport } from '../common/viewport'
import { normalizeViewportSize, setViewportOverride, subscribeViewportChange, VIEWPORT_CHANGE_EVENT } from '../common/viewport-state'

export interface ReactiveViewport {
  width: Ref<number>
  height: Ref<number>
  /** Re-read host dimensions, e.g. before reopening an overlay. */
  refresh: () => void
}

export function useViewportSize(): ReactiveViewport {
  const initial = getViewportSize()
  const width = ref(initial.width)
  const height = ref(initial.height)
  let stop: (() => void) | undefined

  function refresh() {
    const next = getViewportSize()
    width.value = next.width
    height.value = next.height
  }

  function hostChanged(event: unknown) {
    const raw = Array.isArray(event) ? event[0] : event
    const value = raw as any
    const payload = value?.data ?? value
    const data = payload?.size || payload?.detail || payload
    const size = normalizeViewportSize({ width: data?.width ?? data?.windowWidth, height: data?.height ?? data?.windowHeight })
    if (size) setViewportOverride(size)
    else refresh()
  }

  // Subscribe during setup so an override forwarded before mounted is not lost.
  const unsubscribe = subscribeViewportChange(refresh)
  onMounted(() => {
    refresh()
    const g = globalThis as any
    const runtime = typeof lynx !== 'undefined' ? lynx : g.lynx
    const emitter = runtime?.getJSModule?.('GlobalEventEmitter')
    if (typeof emitter?.addListener === 'function') emitter.addListener(VIEWPORT_CHANGE_EVENT, hostChanged)
    const context = getSystemInfo().platform === 'web' ? runtime?.getCoreContext?.() : null
    context?.addEventListener?.(VIEWPORT_CHANGE_EVENT, hostChanged)
    const onResize = getUniAdapter('onWindowResize')
    const offResize = getUniAdapter('offWindowResize')
    onResize?.(hostChanged)
    const win = getBrowserViewport() ? g.window : null
    win?.addEventListener?.('resize', refresh)
    stop = () => {
      emitter?.removeListener?.(VIEWPORT_CHANGE_EVENT, hostChanged)
      context?.removeEventListener?.(VIEWPORT_CHANGE_EVENT, hostChanged)
      offResize?.(hostChanged)
      win?.removeEventListener?.('resize', refresh)
    }
  })
  onBeforeUnmount(() => {
    unsubscribe()
    stop?.()
  })
  return { width, height, refresh }
}

export function useViewportWidth(): Ref<number> {
  return useViewportSize().width
}

export function useIsWideViewport(width?: Ref<number>): ComputedRef<boolean> {
  const source = width ?? useViewportWidth()
  return computed(() => isWideViewport(source.value))
}
