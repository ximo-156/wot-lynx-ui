import {
  computed,
  getCurrentInstance,
  getCurrentScope,
  onActivated,
  onBeforeUnmount,
  onDeactivated,
  onScopeDispose,
  ref,
  watch,
  type ComputedRef,
  type InjectionKey
} from 'vue-lynx'

/** Popup 与其遮罩共用一个 owner；嵌套 Popup 则建立自己的 owner。 */
export const SCROLL_LOCK_OWNER_KEY: InjectionKey<symbol> = Symbol('wot-scroll-lock-owner')

// 原生滚动是 scroll-view 自身的默认行为，BG 的 catch/stop 只停止事件冒泡。
// 每个 useLockScroll 实例持有一个幂等 lease，同一 owner 的多个 lease 只计一层。
const owners = new Map<symbol, Set<symbol>>()
const ownerCount = ref(0)
const pageScrollLocked = computed(() => ownerCount.value > 0)

let bodySnapshot: { body: HTMLElement; overflow: string; priority: string } | undefined

/** DOM 只是兼容通道：运行时按需检测，不能把模块初始化时的无 DOM 状态固化。 */
function syncBodyOverflow() {
  if (ownerCount.value === 0) {
    if (bodySnapshot) {
      const { body, overflow, priority } = bodySnapshot
      body.style.setProperty('overflow', overflow, priority)
      bodySnapshot = undefined
    }
    return
  }
  const body = typeof document !== 'undefined' ? document.body : undefined
  if (!body || !body.style) return
  if (!bodySnapshot) {
    bodySnapshot = {
      body,
      overflow: body.style.getPropertyValue('overflow'),
      priority: body.style.getPropertyPriority('overflow')
    }
  }
  body.style.setProperty('overflow', 'hidden')
}

/**
 * 宿主页面背景 scroll-view 的只读锁状态。
 *
 * 原生绑定 :scroll-enable="!pageScrollLocked"，明确保留 scroll-orientation；
 * Lynx Web 0.12 的同一开关名为 enable-scroll，可同时绑定兼容。
 * 不要把此状态绑定到 Popup 内部 scroll-view，否则会禁掉弹层内容滚动。
 */
export function usePageScrollLock(): ComputedRef<boolean> {
  return pageScrollLocked
}

/**
 * 保留 lock/unlock API；重复 lock、重复 unlock、卸载/停用均幂等。
 * shouldLock 初始为 true 时立即锁定。弹层应以“仍在场（含 leave）”作为条件，
 * 在 after-leave 后才置 false，而不是在开始离场时提前解锁。
 * owner 为 Popup/Overlay 内部去重通道，普通调用不必传入。
 */
export function useLockScroll(shouldLock: () => boolean, owner: symbol = Symbol('scroll-lock-owner')) {
  const lease = Symbol('scroll-lock-lease')
  let held = false
  let active = true
  let disposed = false

  function lock() {
    if (!active || disposed) return
    if (!held) {
      let leases = owners.get(owner)
      if (!leases) owners.set(owner, (leases = new Set()))
      leases.add(lease)
      held = true
      ownerCount.value = owners.size
    }
    syncBodyOverflow()
  }

  function unlock() {
    if (!held) return
    held = false
    const leases = owners.get(owner)
    leases?.delete(lease)
    if (leases?.size === 0) owners.delete(owner)
    ownerCount.value = owners.size
    syncBodyOverflow()
  }

  function destroy() {
    disposed = true
    unlock()
  }

  watch(shouldLock, (value) => { value ? lock() : unlock() }, { immediate: true, flush: 'sync' })

  if (getCurrentInstance()) {
    onDeactivated(() => {
      active = false
      unlock()
    })
    onActivated(() => {
      active = true
      if (shouldLock()) lock()
    })
    onBeforeUnmount(destroy)
  }
  if (getCurrentScope()) onScopeDispose(destroy)

  return { lock, unlock }
}
