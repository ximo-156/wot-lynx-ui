/**
 * vue-lynx 内置 Transition 的兼容层。
 *
 * 背景（vue-lynx 0.5.1）：其导出的 `Transition` 是 functional component，
 * 未像 Vue DOM 版那样经 `decorate()` 声明 props。在 Vue 3.5 中，
 * functional component 未声明的 props 会以 attrs 形态经
 * `renderComponentRoot → cloneVNode/mergeProps` 回落，与 Transition
 * 内部包装的同名 `on*` 钩子被 mergeProps 合并成**数组**
 * （`[wrapper, userHook]`）；BaseTransition 的
 * `callWithAsyncErrorHandling` 会遍历数组逐一调用——导致每个生命周期
 * 回调（before-enter / enter / after-enter / before-leave / leave /
 * after-leave）被触发两次。
 *
 * 修法：与 Vue DOM 版 Transition 的 decorate 对齐，一次性为 Transition
 * 补齐 props 声明（幂等，vue-lynx 后续版本自行声明时自动跳过）。声明后
 * 钩子作为 props 被消费、不再回落合并；`name` / `duration` / `css` /
 * `*Class` 等同时不再作为 attrs 穿透到子元素。
 *
 * 本模块不从 index.ts 导出，仅供 wd-transition 内部使用。
 */
import { Transition } from 'vue-lynx'

/** 与 @vue/runtime-dom 3.5 的 TransitionPropsValidators 对齐 */
const LYNX_TRANSITION_PROPS: Record<string, unknown> = {
  // BaseTransitionPropsValidators（@vue/runtime-core 3.5）
  mode: String,
  appear: Boolean,
  persisted: Boolean,
  onBeforeEnter: [Function, Array],
  onEnter: [Function, Array],
  onAfterEnter: [Function, Array],
  onEnterCancelled: [Function, Array],
  onBeforeLeave: [Function, Array],
  onLeave: [Function, Array],
  onAfterLeave: [Function, Array],
  onLeaveCancelled: [Function, Array],
  onBeforeAppear: [Function, Array],
  onAppear: [Function, Array],
  onAfterAppear: [Function, Array],
  onAppearCancelled: [Function, Array],
  // DOMTransitionPropsValidators（@vue/runtime-dom 3.5，Lynx 版同名复用）
  name: String,
  type: String,
  css: { type: Boolean, default: true },
  duration: [String, Number, Object],
  enterFromClass: String,
  enterActiveClass: String,
  enterToClass: String,
  appearFromClass: String,
  appearActiveClass: String,
  appearToClass: String,
  leaveFromClass: String,
  leaveActiveClass: String,
  leaveToClass: String
}

if (!(Transition as unknown as { props?: unknown }).props) {
  ;(Transition as unknown as { props?: unknown }).props = LYNX_TRANSITION_PROPS
}

export { Transition }
