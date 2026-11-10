/** Reactive application dimensions, including Lynx Web Worker host events. */
import { computed, onBeforeUnmount, onMounted, ref, type ComputedRef, type Ref } from 'vue-lynx'
import { getBrowserViewport, getSystemInfo } from '../common/util'

// Some runtimes expose the SDK as a script binding rather than an own global property.
declare const lynx: any
import { getHost, subscribeHostChange, type WotLynxHost } from '../common/host'
import { getViewportSize, isWideViewport } from '../common/viewport'
import { normalizeViewportSize, setViewportOverride, subscribeViewportChange, VIEWPORT_CHANGE_EVENT } from '../common/viewport-state'

export interface ReactiveViewport {
  width: Ref<number>
  height: Ref<number>
  /** Also changes when a host refresh leaves dimensions unchanged (e.g. system bars). */
  revision: Ref<number>
  /** Re-read host dimensions, e.g. before reopening an overlay. */
  refresh: () => void
}

interface HostResizeSubscription {
  host: WotLynxHost
  on: NonNullable<WotLynxHost['onWindowResize']>
  off: WotLynxHost['offWindowResize']
  listener: (event: unknown) => void
}

export function useViewportSize(): ReactiveViewport {
  const initial = getViewportSize()
  const width = ref(initial.width)
  const height = ref(initial.height)
  const revision = ref(0)
  let disposed = false
  let stop: (() => void) | undefined
  let hostSubscription: HostResizeSubscription | undefined
  let syncingHost = false
  let hostChangePending = false

  function stopHostSubscription() {
    const previous = hostSubscription
    // Retire first: an off method may deliver an already queued resize synchronously.
    hostSubscription = undefined
    if (!previous) return
    try { previous.off?.call(previous.host, previous.listener) } catch (error) {
      console.warn('[wot-lynx-ui] 宿主窗口事件解绑失败', error)
    }
  }

  function syncHostSubscription() {
    if (disposed || syncingHost) return
    syncingHost = true
    try {
      do {
        hostChangePending = false
        const host = getHost()
        const on = host.onWindowResize
        const off = host.offWindowResize
        if (hostSubscription?.host === host && hostSubscription.on === on && hostSubscription.off === off) return
        stopHostSubscription()
        // Unbinding can itself replace the host; never install that obsolete snapshot.
        if (disposed) return
        if (hostChangePending) continue
        if (typeof on !== 'function') return
        const record: HostResizeSubscription = {
          host, on, off,
          listener: (event) => {
            if (disposed || hostChangePending || hostSubscription !== record) return
            // Another viewport can be unbinding while this subscriber's notification
            // is still pending. Reject the retired source before it changes shared size.
            const current = getHost()
            if (current !== host || current.onWindowResize !== on || current.offWindowResize !== off) return
            hostChanged(event)
          }
        }
        // Publish before calling the host: onWindowResize may immediately invoke us.
        hostSubscription = record
        try { on.call(host, record.listener) } catch (error) {
          if (hostSubscription === record) stopHostSubscription()
          console.warn('[wot-lynx-ui] 宿主窗口事件订阅失败', error)
        }
      } while (hostChangePending && !disposed)
    } finally {
      syncingHost = false
    }
  }

  function refresh() {
    if (disposed) return
    syncHostSubscription()
    if (disposed) return
    const next = getViewportSize()
    width.value = next.width
    height.value = next.height
    revision.value++
  }

  function hostChanged(event: unknown) {
    if (disposed) return
    const raw = Array.isArray(event) ? event[0] : event
    const value = raw as any
    const payload = value?.data ?? value
    const data = payload?.size || payload?.detail || payload
    const size = normalizeViewportSize({ width: data?.width ?? data?.windowWidth, height: data?.height ?? data?.windowHeight })
    const before = revision.value
    if (size) setViewportOverride(size)
    // setViewportOverride notifies only dimension changes; system bars can change alone.
    if (revision.value === before) refresh()
  }

  // Subscribe during setup so an override forwarded before mounted is not lost.
  const unsubscribe = subscribeViewportChange(refresh)
  const unsubscribeHost = subscribeHostChange(() => {
    hostChangePending = true
    refresh()
  })
  onMounted(() => {
    refresh()
    const g = globalThis as any
    const runtime = typeof lynx !== 'undefined' ? lynx : g.lynx
    const emitter = runtime?.getJSModule?.('GlobalEventEmitter')
    if (typeof emitter?.addListener === 'function') emitter.addListener(VIEWPORT_CHANGE_EVENT, hostChanged)
    const context = getSystemInfo().platform === 'web' ? runtime?.getCoreContext?.() : null
    context?.addEventListener?.(VIEWPORT_CHANGE_EVENT, hostChanged)
    const win = getBrowserViewport() ? g.window : null
    win?.addEventListener?.('resize', refresh)
    stop = () => {
      emitter?.removeListener?.(VIEWPORT_CHANGE_EVENT, hostChanged)
      context?.removeEventListener?.(VIEWPORT_CHANGE_EVENT, hostChanged)
      win?.removeEventListener?.('resize', refresh)
    }
  })
  onBeforeUnmount(() => {
    disposed = true
    unsubscribe()
    unsubscribeHost()
    stopHostSubscription()
    stop?.()
  })
  return { width, height, revision, refresh }
}

export function useViewportWidth(): Ref<number> {
  return useViewportSize().width
}

export function useIsWideViewport(width?: Ref<number>): ComputedRef<boolean> {
  const source = width ?? useViewportWidth()
  return computed(() => isWideViewport(source.value))
}
