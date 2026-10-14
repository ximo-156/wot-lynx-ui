import { onBeforeUnmount, onDeactivated, ref, watch } from 'vue-lynx'

/**
 * 是否具备 DOM 环境（Lynx 双线程运行时均无 document，仅 Web 端具备）。
 * Lynx 中页面滚动由原生滚动容器管理，锁滚由遮罩层的 `disable-touch-move`
 * （touchmove.stop.prevent）完成，见 wd-overlay / wd-transition。
 */
const hasDom = typeof document !== 'undefined' && typeof document.getElementsByTagName === 'function'

export function useLockScroll(shouldLock: () => boolean) {
  const scrollLockCount = ref<number>(0)

  const lock = () => {
    if (!hasDom) return
    if (scrollLockCount.value === 0) {
      document.getElementsByTagName('body')[0].style.overflow = 'hidden'
    }
    scrollLockCount.value++
  }

  const unlock = () => {
    if (!hasDom) return
    if (scrollLockCount.value > 0) {
      scrollLockCount.value--
      if (scrollLockCount.value === 0) {
        document.getElementsByTagName('body')[0].style.overflow = ''
      }
    }
  }

  const destroy = () => {
    shouldLock() && unlock()
  }

  watch(shouldLock, (value) => {
    value ? lock() : unlock()
  })

  onDeactivated(destroy)
  onBeforeUnmount(destroy)

  return {
    lock,
    unlock
  }
}
