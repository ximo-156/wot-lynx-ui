/*
 * wd-transition — 过渡动画
 *
 * Lynx 实现说明：
 * - 动画引擎为 vue-lynx 内置 Transition（Vue BaseTransition 的 Lynx 移植：
 *   类名状态机 + 双 rAF 帧调度 + transitionend / duration 双通道收尾），
 *   本组件只做薄适配（props / 事件映射 / 显隐契约），不再自研状态机。
 *   历史自研实现（pause() 帧驱动 + AbortablePromise 中止调度 + 卸载 abort
 *   兜底）已随本次重构移除，相关真机防护由框架与 alive 守卫承接；
 * - 显隐契约（保持历史行为）：
 *   - destroy=true + lazyRender=true：子视图随 show 以 v-if 挂载，leave
 *     落地后由框架卸载（懒渲染天然成立；初始挂载即展示时播放入场）；
 *   - 其余组合（lazyRender=false 或 destroy=false）：子视图常驻，
 *     v-show 控制显隐，leave 落地后由 vShow 指令置 display:none；
 *     同时仅在完全关闭时裁剪根视图，防 Lynx 把文字子树缩成 0×0 后仍在原点绘制；
 *     lazyRender=true 时内容首次展示后才渲染（slot 门控）；
 * - 模板不能用 Transition 内建组件 / v-show 内建立法：二者是编译器内建，
 *   在非 vue-lynx 编译环境（vitest / Web 预览）会解析到 @vue/runtime-dom
 *   的 DOM 版实现（依赖 el.style 等 DOM 属性，在 Lynx 元素上直接抛错）。
 *   这里经 setup 导入改名（LynxTransition / vShowLynx）按普通组件 /
 *   自定义指令解析，双端一致；
 * - 过渡时长：框架只按 duration 定时器判定收尾，视觉时长由根视图内联
 *   transition-duration 承载（enter / leave 可分设，随阶段钩子切换）；
 * - 卸载后不再派发生命周期事件（alive 守卫，真机 9902 removeNode 防护，
 *   见 test/transition-unmount-abort.test.ts）；
 * - 根视图内部点击绑定 @tap 而非 @click：Lynx 引擎（含 web-core 的
 *   W3cEventNameToLynx click→tap 映射）只向 view 派发 tap，click 事件
 *   不存在——e2931b8 曾改绑 @click 规避消费方 @tap 同名合并崩溃，结果
 *   遮罩/弹层点击在全端失效（真机 2026-10-16 核实，见
 *   test/overlay-tap-regression.test.ts）。合并崩溃的正确修法是
 *   CONVENTIONS §14 的「根 view 原生事件名同时声明为 emit 并转发」：
 *   本组件 emits 声明 'tap' 并由根 view 转发，消费方绑 @tap 时作为
 *   组件事件被消费、不再穿透到根元素与内部绑定合并；
 * - disableTouchMove 仅是本组件的冒泡 catch 开关，不是原生 scroll-enable：
 *   子项 bind 先正常处理，根边界再阻止祖先 JS 处理器；实际原生背景滚动锁
 *   由 useLockScroll 的共享状态接到页面 scroll-view 完成。
 *   显式 catchtouch* key 保证切换 false 时 REMOVE_EVENT 仍删 catchEvent，
 *   避免 onTouchmove + _lynxCatch 的解绑类型不对而留下 native catch。
 */
<script lang="ts" setup>
import './index.css'

import { computed, onBeforeUnmount, ref, watch, withModifiers, vShow } from 'vue-lynx'
import { isObj, parseStyle } from '@wot-lynx/core/common/util'
import { createStyleResolver, defineStyleKeys } from '@wot-lynx/core/common/style'
import { Transition as LynxTransition } from '@wot-lynx/core/common/lynxTransition'
import { transitionProps, type TransitionName } from './types'

/** v-show 的显式指令引用（避开编译器内建解析，见文件头说明） */
const vShowLynx = vShow

const props = defineProps(transitionProps)
const emit = defineEmits([
  'tap',
  'click',
  'transitionend',
  'touchstart',
  'touchmove',
  'touchend',
  'touchcancel',
  'before-enter',
  'enter',
  'after-enter',
  'before-leave',
  'leave',
  'after-leave'
])

/** 卸载后停止派发生命周期事件（9902 防护：晚到写入已销毁实例会触发真机崩溃） */
const alive = ref(true)
onBeforeUnmount(() => {
  alive.value = false
})

/**
 * 仍在场（含完整的 leave 动画）。不能直接用 !show 裁剪：show=false 只是
 * 开始离场；退场完成才允许把保活文字子树裁到零尺寸。入场由框架钩子撤销
 * 保护，不能 watch(show) 提前撤销：style patch 会先于 vShow.updated 下发，
 * 此时渲染器仍强制 display:none，提前解除裁剪会漏出一帧原点文字。
 */
const inPlace = ref(props.show)

/** 是否曾展示过（v-show 分支 + lazyRender 时的内容门控） */
const initiallyShown = props.show
const everShown = ref(false)
watch(
  () => props.show,
  (val) => {
    if (val) everShown.value = true
  },
  { immediate: true }
)

/** v-if 分支条件：随 show 挂载 / leave 后卸载（懒渲染 + 销毁语义） */
const useVif = computed(() => props.destroy && props.lazyRender)
// 分支变更会替换原生根。旧根可能仍在离场，新建的 v-show 根却已经关闭，
// 不能继承旧根的 inPlace；使用 pre 时机，读取本轮完整 props 而非中途状态。
watch(useVif, () => { if (!props.show) inPlace.value = false })

/**
 * name 历史支持数组（框架 Transition 仅接受单 name，取首个元素）。
 * 传 undefined 时由框架回退其内部默认（'v'，无对应样式即无动画）。
 */
const transitionName = computed<TransitionName | undefined>(() => {
  const name = props.name
  return Array.isArray(name) ? name[0] : name
})

/** 自定义类名 prop：空串时传 undefined，让框架按 name 生成默认类名 */
const orUndefined = (value: string) => value || undefined

/**
 * 过渡状态类名（CONVENTIONS §19 / 真机 2026-10 缺陷修复）：
 * index.scss 的状态类选择器带 `wd-transition--` 前缀（如
 * `.wd-transition--fade-enter-from`），而框架 Transition 默认下发的是
 * Vue 约定的无前缀类名（`fade-enter-from`）——两者永不匹配，enter-from /
 * leave-to 的 opacity/transform 与 enter-active 的 transition-property
 * 全部静默丢失，整个弹层家族（popup/dialog/toast/notify/overlay/
 * popover/tooltip/curtain/image-preview/video-preview…）无动画。
 * 这里在消费方未显式传类名时，按 name 生成带前缀的类名下发，
 * 使 SCSS 规则命中；显式传入的类名优先。
 */
const prefixed = (suffix: 'enter-from' | 'enter-active' | 'enter-to' | 'leave-from' | 'leave-active' | 'leave-to') =>
  transitionName.value ? `wd-transition--${transitionName.value}-${suffix}` : ''

const enterFromClass = computed(() => props.enterClass || prefixed('enter-from'))
const enterActiveClass = computed(() => props.enterActiveClass || prefixed('enter-active'))
const enterToClass = computed(() => props.enterToClass || prefixed('enter-to'))
const leaveFromClass = computed(() => props.leaveClass || prefixed('leave-from'))
const leaveActiveClass = computed(() => props.leaveActiveClass || prefixed('leave-active'))
const leaveToClass = computed(() => props.leaveToClass || prefixed('leave-to'))

/**
 * 传给框架的 duration：归一为 number | { enter, leave }（boolean 视为 0，
 * 即无动画——框架 normalizeDuration 对 boolean 同样落到 0，保持一致）。
 */
const durationForFramework = computed<number | { enter: number; leave: number }>(() => {
  const duration = props.duration
  if (typeof duration === 'number') return duration
  if (isObj(duration)) {
    return { enter: phaseDurationOf('enter'), leave: phaseDurationOf('leave') }
  }
  return 0
})

/** 取某阶段时长（ms）；duration 为 boolean 时视为 0（无动画） */
function phaseDurationOf(phase: 'enter' | 'leave'): number {
  const duration = props.duration
  if (isObj(duration)) {
    const value = (duration as Record<string, number>)[phase]
    return typeof value === 'number' ? value : 0
  }
  return typeof duration === 'number' ? duration : 0
}

/** 当前阶段时长（驱动根视图内联 transition-duration，随阶段钩子切换） */
const phaseDuration = ref<number>(phaseDurationOf('enter'))

const rootClass = computed(() => `wd-transition ${props.customClass}`)

/**
 * 根视图样式（对象语法：字符串 :style 会被 vue-lynx 静默丢弃，CONVENTIONS §19）。
 *
 * v-show 分支必须显式携带 display: Lynx 的 SetStyle 是合并语义（引擎 PAPI
 * 镜像与 Web 预览运行时均逐属性 Object.assign，「删键」不会清除元素上已
 * 应用的内联属性），而 vShow 指令显示态只重发 el._style、隐藏态才追加
 * display:none——若 el._style 本身不含 display，隐藏态打上的 display:none
 * 在入场后永远残留（遮罩 / toast 内容入场后仍不可见，即真机测试缺陷②）。
 * 让 el._style 常带可见值，vShow 重发时即可覆盖残留（取值与 .wd-transition
 * 的 display:flex 类声明一致；customStyle 仍可覆盖）。
 */
const ROOT_STYLE = defineStyleKeys({
  display: 'flex',
  'transition-duration': '0ms',
  overflow: '',
  'overflow-x': '',
  'overflow-y': ''
})
const resolveRootStyle = createStyleResolver(ROOT_STYLE)
const rootStyle = computed<Record<string, string>>(() => {
  const style = resolveRootStyle(
    { 'transition-duration': `${phaseDuration.value}ms` }, parseStyle(props.customStyle)
  )
  // Lynx display:none 只将后代尺寸归零，文字仍可能绘制在 (0,0)。官方要求
  // 对应父级 overflow:hidden：https://lynxjs.org/api/css/properties/display.md
  // 保护落在真正显隐的根，而非 fixed 节点之外的祖先；不销毁保活的 slot。
  const hidden = !inPlace.value || style.display === 'none'
  return {
    ...style,
    // 后于 customStyle，避免 overflow:visible 或两轴定制击穿闭态保护。
    // 开态显式清空覆盖以恢复 CSS 类；不能省略键，否则 SET_STYLE 会残留 hidden。
    overflow: hidden ? 'hidden' : style.overflow,
    // 恢复 shorthand 时把它展开到未显式定制的轴，避免轴的空值冲掉 shorthand。
    'overflow-x': hidden ? 'hidden' : style['overflow-x'] || style.overflow,
    'overflow-y': hidden ? 'hidden' : style['overflow-y'] || style.overflow
  }
})

type PhaseEvent = 'before-enter' | 'enter' | 'after-enter' | 'before-leave' | 'leave' | 'after-leave'

/**
 * 框架生命周期钩子 → 组件事件。
 * appear 钩子（初始挂载即展示）映射到同名 enter 事件——vue-lynx 的
 * Transition 不做 Vue DOM 那样的 appear→enter 回退，需显式接线。
 */
let currentRoot: unknown
function onPhase(event: PhaseEvent, phase: 'enter' | 'leave', element: unknown) {
  if (!alive.value) return
  if (event === 'before-enter') {
    // 分支替换时 BaseTransition 可能给新建的保活根执行 appear，即使 v-show
    // 仍为 false。它不是一次打开，不能解除裁剪或抢走旧根的离场回调归属。
    if (!props.show) return
    currentRoot = element
    inPlace.value = true
  } else if (element !== currentRoot) {
    // destroy/lazyRender 切换可能让两个根短暂共存。旧根收尾不能裁新根，
    // 也不能经 after-leave 让 Popup/Overlay 提前释放新根的模态滚动锁。
    return
  }
  if (event === 'after-leave' && !props.show) inPlace.value = false
  if (event === 'before-enter' || event === 'before-leave') {
    phaseDuration.value = phaseDurationOf(phase)
  }
  if (event === 'after-enter' || event === 'after-leave') {
    // 与历史实现保持一致：transitionend 先于 after-* 派发
    emit('transitionend')
  }
  emit(event)
}

function handleTap(e?: any) {
  emit('tap', e)
  // click 保持 wot-ui API 对齐（Lynx 引擎只派发 tap，见 CONVENTIONS §14 订正）
  emit('click', e)
}

// 这是冒泡 catch（子项先收到 bind），不是 capture，也不禁止内部 scroll-view
// 的原生默认滚动。vue-lynx 0.5.1 的 prevent 修饰符未实现，不能当作 native 锁。
const touchstartCatch = withModifiers((e?: any) => emit('touchstart', e), ['stop'])
const touchmoveCatch = withModifiers((e?: any) => emit('touchmove', e), ['stop'])
const touchendCatch = withModifiers((e?: any) => emit('touchend', e), ['stop'])
const touchcancelCatch = withModifiers((e?: any) => emit('touchcancel', e), ['stop'])
const touchstartLocked = computed(() => props.disableTouchMove ? touchstartCatch : undefined)
const touchmoveLocked = computed(() => props.disableTouchMove ? touchmoveCatch : undefined)
const touchendLocked = computed(() => props.disableTouchMove ? touchendCatch : undefined)
const touchcancelLocked = computed(() => props.disableTouchMove ? touchcancelCatch : undefined)
</script>

<template>
  <LynxTransition
    :appear="useVif || initiallyShown"
    :name="transitionName"
    :duration="durationForFramework"
    :enter-from-class="orUndefined(enterFromClass)"
    :enter-active-class="orUndefined(enterActiveClass)"
    :enter-to-class="orUndefined(enterToClass)"
    :leave-from-class="orUndefined(leaveFromClass)"
    :leave-active-class="orUndefined(leaveActiveClass)"
    :leave-to-class="orUndefined(leaveToClass)"
    @before-enter="onPhase('before-enter', 'enter', $event)"
    @enter="onPhase('enter', 'enter', $event)"
    @after-enter="onPhase('after-enter', 'enter', $event)"
    @before-leave="onPhase('before-leave', 'leave', $event)"
    @leave="onPhase('leave', 'leave', $event)"
    @after-leave="onPhase('after-leave', 'leave', $event)"
    @before-appear="onPhase('before-enter', 'enter', $event)"
    @appear="onPhase('enter', 'enter', $event)"
    @after-appear="onPhase('after-enter', 'enter', $event)"
  >
    <!-- v-if 分支（destroy + lazyRender）：随 show 挂载，leave 落地后由框架卸载 -->
    <view
      v-if="useVif && show"
      :class="rootClass"
      :style="rootStyle"
      :catchtouchstart="touchstartLocked"
      :catchtouchmove="touchmoveLocked"
      :catchtouchend="touchendLocked"
      :catchtouchcancel="touchcancelLocked"
      @tap="handleTap"
    >
      <slot />
    </view>
    <!-- v-show 分支（其余组合）：常驻 + v-show 显隐；内容懒渲染经 slot 门控 -->
    <view
      v-else-if="!useVif"
      v-show-lynx="show"
      :class="rootClass"
      :style="rootStyle"
      :catchtouchstart="touchstartLocked"
      :catchtouchmove="touchmoveLocked"
      :catchtouchend="touchendLocked"
      :catchtouchcancel="touchcancelLocked"
      @tap="handleTap"
    >
      <slot v-if="!lazyRender || everShown" />
    </view>
  </LynxTransition>
</template>
