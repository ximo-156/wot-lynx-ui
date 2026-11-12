import { onUnmounted } from 'vue-lynx'

/**
 * 组件存活守卫。
 *
 * 背景：getRect 的 SelectorQuery 回调、beforeConfirm 等 Promise 拦截器的
 * done、防抖定时器续段都可能晚于组件卸载落地。此时再写响应式 ref，
 * vue-lynx 会在已销毁的组件树上继续 patch，产生晚到的 remove/insert
 * 操作——真机表现为 PaintingContext.removeNode 未知签名（错误码 9902）：
 *
 *   java.lang.RuntimeException: Trying to remove unknown ui signature
 *
 * 用法（setup 内取一次，异步回调入口先判存活）：
 *
 * ```ts
 * const isAlive = useAlive()
 * getRect('.x').then((rect) => {
 *   if (!isAlive()) return
 *   state.value.style = …
 * })
 * ```
 *
 * 注意：onUnmounted 只在组件 setup 上下文中有效；本 composable 不得在
 * 组件外（如模块级）调用。
 */
export function useAlive(): () => boolean {
  let alive = true
  onUnmounted(() => {
    alive = false
  })
  return () => alive
}
