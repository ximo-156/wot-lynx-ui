/**
 * 事件注册表全覆盖回归测试 — CONVENTIONS §14（业务组件，ADR-023 拆分后收敛范围）。
 *
 * 用户真机反馈（Sentry，手动测试复现）：
 *   TypeError: _getRegistryState_handlers_get is not a function
 *
 * 根因：vue-lynx 把元素事件处理器按 sign 存进
 * globalThis.__VUE_LYNX_EVENT_REGISTRY__ 的 Map，原生事件到来时由
 * lynx_core 调 publishEvent(sign, data) 取出并**直接调用**——只容忍函数值。
 * 当消费方在组件上绑某个原生事件（Lynx 惯用法 @tap / @touchmove…），而该
 * 事件未被组件 defineEmits 声明时，监听会穿透 $attrs 落到组件根 vnode 链
 * 末端的原生元素上，与元素自身的同名监听被 mergeProps 合并成**数组**，
 * 数组被原样注册——事件一派发即抛上述 TypeError。
 * （标准 Vue DOM 的 patchEvent 支持监听数组，所以该 bug 只在 Lynx 暴露。）
 *
 * 做法：对组件库**每一个组件**，挂载时绑定全部 Lynx 原生事件名，然后对
 * 渲染树中的**每一个真实元素**逐一派发全部事件。派发抛 registry TypeError
 * 即失败（注释根上的惰性数组不会收到派发，不构成用户可见崩溃，故只以
 * 「派发不抛」为准）。共享逻辑在 helpers/event-registry-suite.ts。
 *
 * 范围：本文件覆盖**业务组件**（门面 src/components + 各域包 src，随拆分
 * 自动纳入）；基础件在 event-registry-primitives.test.ts。两文件分担
 * eager 导入量，避免单 worker 超出默认堆上限。
 */
import { runEventRegistrySuite } from '../helpers/event-registry-suite'

const modules = import.meta.glob('../../../*/src/**/wd-*/wd-*.vue', { eager: false })
const entries = Object.entries(modules).filter(
  ([path]) =>
    !path.includes('/primitives/') && !path.includes('/key/') && !path.includes('/year/')
)

runEventRegistrySuite('业务组件', entries)
