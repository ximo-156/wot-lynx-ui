import { ref, onUnmounted } from 'vue-lynx'
import { isDef, isNumber, warnOnce } from '../common/util'

const hasNativeRaf = typeof (globalThis as any).lynx?.requestAnimationFrame === 'function'

// 定义回调函数类型
type RafCallback = (time: number) => void | Promise<unknown>

export function useRaf(callback: RafCallback, onError?: (error: unknown) => void) {
  const requestRef = ref<number | null | ReturnType<typeof setTimeout>>(null)

  /**
   * 回调异常的兜底出口。
   *
   * raf 回调跑在 setTimeout / requestAnimationFrame 里：同步 throw 会变成未捕获
   * 异常（Node 里直接让进程崩溃，Lynx 宿主里变成 Sentry 上报的
   * USER_RUNTIME_ERROR），async 回调的 rejection 则会变成未处理的 Promise
   * 拒绝——两者都拿不到现场也崩不掉页面。这里统一接住：优先交给调用方的
   * onError，否则按 key 去重告警一次。
   */
  const reportError = (error: unknown) => {
    if (onError) {
      onError(error)
      return
    }
    warnOnce('use-raf-callback', '[wot-lynx-ui] useRaf 回调执行失败（已兜底，未向上抛出）', error)
  }

  /** 执行回调，接住同步异常与异步 rejection */
  const runCallback = (time: number) => {
    try {
      const result = callback(time) as unknown
      if (result && typeof (result as Promise<unknown>).then === 'function') {
        ;(result as Promise<unknown>).then(undefined, reportError)
      }
    } catch (error) {
      reportError(error)
    }
  }

  // 启动动画帧
  const start = () => {
    if (hasNativeRaf) {
      requestRef.value = (globalThis as any).lynx.requestAnimationFrame(runCallback)
    } else {
      requestRef.value = setTimeout(() => runCallback(Date.now()), 1000 / 30)
    }
  }

  // 取消动画帧
  const cancel = () => {
    if (hasNativeRaf && isNumber(requestRef.value)) {
      ;(globalThis as any).lynx.cancelAnimationFrame(requestRef.value)
    } else if (isDef(requestRef.value)) {
      clearTimeout(requestRef.value)
    }
  }

  onUnmounted(() => {
    cancel()
  })

  return { start, cancel }
}
