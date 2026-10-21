/*
 * wd-floating-panel — 浮动面板（原生优先重写版）
 *
 * Lynx 实现说明（相对 wot-ui 2.3.2 的适配点）：
 * - **跟手走主线程（声明式 MTS）**：面板拖拽的 touchmove 经根 view 的
 *   `main-thread-bindtouchmove` 绑定 'main thread' worklet，触点经绝对
 *   定位公式（手势起点 + 触点位移 + 阻尼）换算后 `setStyleProperty` 直改
 *   根节点 transform——零线程跨越，低端机跟手无滞后（CONVENTIONS §10）；
 * - **跨元素分工（真机冒泡语义）**：根 view 绑主线程 touchstart /
 *   touchmove（worklet：记录手势起点、跟手直改），touchend / touchcancel
 *   为后台绑定（落定提交）——同名事件禁双绑（CONVENTIONS §10/§2），
 *   touchstart/touchend 分工参照 slider / slide-verify 范本。真机上头部
 *   与内容区的触摸事件冒泡到根 view 即触发主线程 worklet；jsdom 的
 *   bindEvent 事件不冒泡，测试中直接派发到根 view 验证 worklet 逻辑；
 * - **手势起点双通道记录**：后台侧由头部 / 内容区的 `@touchstart` 记录
 *   （changedTouches 重算落定值用），主线程侧由根 view 的主线程
 *   touchstart worklet 记录进 MainThreadRef（跟手用）——两通道各自持有
 *   同一触摸起点，无需跨线程传值（slide-verify 同款分工）；
 * - **范围与当前高度经元素属性桥接**：锚点边界 min-bound / max-bound 与
 *   当前高度 cur-height 由后台随重渲染下发到根 view，worklet 经
 *   `getAttribute` 实时读取（slider 的 left-bound / right-bound 同款）；
 * - **提交走后台**：touchend 用同一套绝对公式由 changedTouches 重算终值、
 *   吸附最近锚点并 commit（update:height / height-change），提交逻辑留在
 *   后台可单测；落位动画由 CSS transition 承担（终值与 transition 同帧写回）；
 * - **内容区拖拽门控**：contentDraggable 为真时内容区不拦截触摸，冒泡到
 *   根 view 的 worklet 跟手；为假时内容区 scroll-view 以 catch 语义拦截
 *   （`@touchmove.stop.prevent`：不冒泡、不跟手、不原生滚动），同时作废
 *   后台手势起点，落定不重算（与参考源 dataset.id === 'content' 分支语义
 *   一致）。两分支类名 / 层级一致，仅事件绑定不同——跟手与滚动接管无法
 *   挂在同一元素同一事件上（同名禁双绑，CONVENTIONS §10）。注意：Lynx 的
 *   worklet 无法阻止 scroll-view 原生滚动，内容可拖拽时内容滚动与面板
 *   跟手可能同时发生（参考源经 .prevent 彻底阻止），此为平台取舍；
 * - **事件转发**：根 view 原生事件名在 emits 声明并转发（CONVENTIONS §14）；
 *   touchmove 已被主线程 worklet 占用（同名禁双绑），后台无事件源不再
 *   转发，声明保留以防消费方绑定穿透合并；
 * - **data-id 移除**：参考源用 scroll-view 的 data-id + currentTarget.dataset
 *   区分内容区触摸；本实现按元素分工（内容区独立绑定 touchstart 与 catch
 *   touchmove），不再需要该钩子属性故移除（测试环境 data-* 属性亦无法
 *   经 ops 挂载）；
 * - rootStyle 由参考源的 objToStyle 字符串拼接改为对象语法（CONVENTIONS
 *   §19：字符串 :style 会被 vue-lynx 静默丢弃），height / transform /
 *   transition 三键每帧输出完整键集（Style Funnel，§20）；
 * - SCSS：width: 100vw 改用 left/right: 0 贴边撑满（Lynx 视口单位支持不确定）；
 *   ::after 伪元素（把面板底色延伸到屏外，视觉为空操作）删除；cursor /
 *   user-select 等 Web 专有属性删除；constant() 安全区写法删除仅留 env()。
 */
<script lang="ts" setup>
import './index.css'

import { computed, getCurrentInstance, onBeforeMount, onBeforeUnmount, ref, watch, useMainThreadRef } from 'vue-lynx'
import { floatingPanelProps } from './types'
import { addUnit, closest, getRect, getSystemInfo, noop, parseStyle, uuid } from '../../common/util'
import { createStyleResolver } from '../../common/style'

const props = defineProps(floatingPanelProps)
const emit = defineEmits(['update:height', 'height-change', 'touchstart', 'touchmove', 'touchend', 'touchcancel', 'layoutchange'])
const { proxy } = getCurrentInstance() as any
const instanceId = `wd-floating-panel-${uuid()}`
const disposed = ref(false)
const gestureRevision = ref(0)
const gestureEpoch = ref(0)
const gestureSource = ref<'header' | 'content' | 'blocked'>('header')

const heightValue = ref<number>(props.height)

const DAMP = 0.2 // 阻尼系数
/**
 * 手势起点（后台侧）：touchstart 时记录触点 clientY 与当时的面板高度，
 * touchend 用同一套绝对公式由 changedTouches 重算落定值。
 * 内容区不可拖拽时由内容区 touchstart 作废（置 null），落定不重算。
 * 用 ref 而非裸 let：突变 let 会被 script-setup 编译成访问器（返回对象
 * 出现嵌套花括号），主线程 worklet 无法随模板绑定序列化。
 */
const gestureStart = ref<{ clientY: number; height: number; rawHeight: number; lastY: number; moved: boolean } | null>(null)
const windowHeight = ref<number>(0)
/** Same-value commits must restore MT transform/transition, too. */
const commitTick = ref(0)

const boundary = computed(() => ({
  min: props.anchors[0] ? props.anchors[0] : 100,
  max: props.anchors[props.anchors.length - 1] ? props.anchors[props.anchors.length - 1] : Math.round(windowHeight.value * 0.6)
}))

const anchors = computed(() => (props.anchors.length >= 2 ? props.anchors : [boundary.value.min, boundary.value.max]))
const resolveRootStyle = createStyleResolver({ height: '', transform: 'none', transition: 'none' })
const rootStyle = computed(() => {
  void commitTick.value
  return resolveRootStyle({
    height: addUnit(boundary.value.max),
    transform: `translateY(calc(100% + ${addUnit(-heightValue.value)}))`,
    transition: `transform ${props.duration}ms cubic-bezier(0.18, 0.89, 0.32, 1.28)`
  }, parseStyle(props.customStyle))
})
const extensionStyle = computed(() => ({ height: addUnit(windowHeight.value), bottom: addUnit(-windowHeight.value) }))

function updateHeight(value: number) {
  if (disposed.value) return
  heightValue.value = value
  emit('update:height', value)
}
function invalidateGesture() {
  gestureRevision.value++
  gestureEpoch.value++
  gestureStart.value = null
  commitTick.value++
}
// Invert an already damped visible height before applying a new absolute delta.
// Otherwise the first zero-distance move damps that height a second time.
function uneaseHeight(height: number) {
  const { min, max } = boundary.value
  if (height > max) return max + (height - max) / DAMP
  if (height < min) return min - (min - height) / DAMP
  return height
}
function ease(y: number) {
  const absDistance = Math.abs(y)
  const { min, max } = boundary.value
  if (absDistance > max) return -(max + (absDistance - max) * DAMP)
  if (absDistance < min) return -(min - (min - absDistance) * DAMP)
  return y
}
function recordGestureStart(event: any, source: 'header' | 'content' = 'header') {
  if (disposed.value) return
  gestureRevision.value++ // Invalidate an older end-only geometry query.
  gestureSource.value = source
  const y = Number(event?.touches?.[0]?.clientY)
  gestureStart.value = Number.isFinite(y)
    ? { clientY: y, height: heightValue.value, rawHeight: uneaseHeight(heightValue.value), lastY: y, moved: false } : null
  emit('touchstart', event)
}
function handleTouchStart(event: any) { recordGestureStart(event, 'header') }
function handleContentTouchStart(event: any) { recordGestureStart(event, 'content') }
function handleBlockedContentTouchStart(event: any) {
  if (disposed.value) return
  gestureSource.value = 'blocked'
  invalidateGesture()
  emit('touchstart', event)
}
function recordGestureMove(event: any) {
  if (disposed.value) return
  const start = gestureStart.value
  const y = Number(event?.touches?.[0]?.clientY)
  if (start && Number.isFinite(y)) { start.lastY = y; start.moved = true }
  emit('touchmove', event)
}
async function finishGesture(event: any, canceled: boolean) {
  if (disposed.value) return
  emit(canceled ? 'touchcancel' : 'touchend', event)
  const start = gestureStart.value
  gestureStart.value = null
  const revision = ++gestureRevision.value
  gestureEpoch.value++ // Also kills MT state when no child finish event arrives.
  // A prop change/newer end invalidated the gesture: restore, but do not resnap
  // a programmatically supplied non-anchor height or emit a stale model update.
  if (!start && gestureSource.value !== 'blocked') { commitTick.value++; return }
  let finalHeight = heightValue.value
  const y = Number((event?.changedTouches?.[0] || event?.touches?.[0])?.clientY)
  if (start && Number.isFinite(y)) {
    finalHeight = -ease(y - start.clientY - start.rawHeight)
  } else if (start?.moved) {
    finalHeight = -ease(start.lastY - start.clientY - start.rawHeight)
  } else if (start) {
    // Some native touchcancel/end payloads omit coordinates. Query once at
    // release (never on move) so cancellation settles the rendered MT position.
    try {
      const rect = await getRect(`.${instanceId}`, false, proxy)
      if (disposed.value || revision !== gestureRevision.value) return
      if (Number(rect?.height) > 0 && Number.isFinite(Number(rect?.top))) finalHeight = windowHeight.value - Number(rect.top)
    } catch {
      if (disposed.value || revision !== gestureRevision.value) return
    }
  }
  if (disposed.value || revision !== gestureRevision.value) return
  updateHeight(closest(anchors.value, finalHeight) as number)
  commitTick.value++
  if (start && heightValue.value !== start.height) emit('height-change', { height: heightValue.value })
}
function handleTouchEnd(event?: any) { void finishGesture(event, false) }
function handleTouchCancel(event?: any) { void finishGesture(event, true) }

watch(() => props.height, (value) => {
  invalidateGesture()
  heightValue.value = value
})
watch(anchors, () => {
  invalidateGesture()
  updateHeight(closest(anchors.value, heightValue.value) as number)
}, { immediate: true, deep: true })
watch(() => [props.contentDraggable, props.duration, props.safeAreaInsetBottom], () => { invalidateGesture() })
watch(() => props.customStyle, () => { invalidateGesture() }, { deep: true })
function handleLayoutChange(event: any) {
  if (disposed.value) return
  emit('layoutchange', event)
  const currentWindowHeight = getSystemInfo().windowHeight
  if (currentWindowHeight !== windowHeight.value) { invalidateGesture(); windowHeight.value = currentWindowHeight }
}
onBeforeMount(() => { windowHeight.value = getSystemInfo().windowHeight })
onBeforeUnmount(() => { disposed.value = true; gestureRevision.value++; gestureStart.value = null })

// ---------- 主线程 worklet（跟手，零线程跨越） ----------

/**
 * 主线程元素桩类型（worklet 内经 .current 取用）。
 * 与 @lynx-js/types 的 MainThread.Element 对齐的常用子集。
 */
interface MtElement {
  setStyleProperty(name: string, value: string): void
  getAttribute(name: string): string | null
  invoke(method: string, params?: any): Promise<any>
}

/** 根（面板）元素：worklet 跟手直改 transform / transition */
const panelRef = useMainThreadRef<MtElement | null>(null)
/** 手势起点 { startY, startH }（worklet 内 .current 活值，每次主线程 touchstart 刷新） */
const dragRef = useMainThreadRef<{ startY: number; startH: number; epoch: string | null; content: boolean } | null>(null)

/** worklet 捕获的静态配置快照（setup 期常量，实例内不变） */
const cfgDamp = DAMP

/**
 * 根 view 触摸开始（主线程）：记录手势起点（触点 clientY + 当前面板高度）。
 *
 * 当前高度经根 view 元素属性 cur-height 实时读取（后台随重渲染更新），
 * 不依赖后台快照同步；与后台侧 recordGestureStart 各持一份起点，
 * 互不阻塞（同名事件禁双绑，故主线程起点只能由主线程 touchstart 记录）。
 */
const onTouchStartMt = (event: any) => {
  'main thread'
  dragRef.current = null
  const el = panelRef.current
  const touch0 = event.touches && event.touches[0]
  if (!el || !touch0) return
  const source = event.target && typeof event.target.getAttribute === 'function' ? event.target.getAttribute('gesture-source') : null
  const content = source === 'content' || el.getAttribute('gesture-source') === 'content'
  if (source === 'blocked' || el.getAttribute('gesture-source') === 'blocked' || (content && el.getAttribute('content-draggable') !== 'true')) return
  const curHeight = Number(el.getAttribute('cur-height'))
  const min = Number(el.getAttribute('min-bound')), max = Number(el.getAttribute('max-bound'))
  const y = Number(touch0.clientY)
  if (!Number.isFinite(curHeight) || !Number.isFinite(y) || !Number.isFinite(min) || !Number.isFinite(max)) return
  const rawHeight = curHeight > max ? max + (curHeight - max) / cfgDamp
    : curHeight < min ? min - (min - curHeight) / cfgDamp : curHeight
  dragRef.current = { startY: y, startH: rawHeight, epoch: el.getAttribute('gesture-epoch'), content }
  el.setStyleProperty('transition', 'none')
}

/**
 * 面板跟手移动（主线程）：绝对定位公式 + 阻尼 + 根节点样式直改。
 *
 * 公式与后台 ease / handleTouchEnd 完全一致（触点位移叠加手势起点高度，
 * 越界按 DAMP 阻尼），边界经元素属性 min-bound / max-bound 实时读取；
 * 跟手期显式写 transition: none（落定恢复由后台同帧写回 transition + 终值
 * transform 完成，Style Funnel §20——省略键等于保留旧值）。
 */
const onTouchMoveMt = (event: any) => {
  'main thread'
  const el = panelRef.current
  const drag = dragRef.current
  if (!el || !drag || drag.epoch !== el.getAttribute('gesture-epoch') || (drag.content && el.getAttribute('content-draggable') !== 'true') || el.getAttribute('gesture-source') === 'blocked') return
  const touch0 = event.touches && event.touches[0]
  if (!touch0) return

  const min = Number(el.getAttribute('min-bound'))
  const max = Number(el.getAttribute('max-bound'))
  if (!Number.isFinite(min) || !Number.isFinite(max) || max <= 0) return

  // moveY = 触点位移 - 手势起点高度（与后台 startY = -heightValue 同式）
  const moveY = Number(touch0.clientY) - drag.startY - drag.startH
  const absDistance = Math.abs(moveY)
  let eased: number
  if (absDistance > max) {
    eased = -(max + (absDistance - max) * cfgDamp)
  } else if (absDistance < min) {
    eased = -(min - (min - absDistance) * cfgDamp)
  } else {
    eased = moveY
  }
  const height = -eased

  el.setStyleProperty('transform', `translateY(calc(100% + ${-height}px))`)
  el.setStyleProperty('transition', 'none')
}
</script>

<template>
  <view
    :class="`wd-floating-panel ${customClass} ${safeAreaInsetBottom ? 'is-safe' : ''}`"
    :style="rootStyle"
    :main-thread-ref="panelRef"
    :cur-height="String(heightValue)"
    :min-bound="String(boundary.min)"
    :max-bound="String(boundary.max)"
    :main-thread-bindtouchstart="onTouchStartMt"
    :main-thread-bindtouchmove="onTouchMoveMt"
    @touchend="handleTouchEnd"
    @touchcancel="handleTouchEnd"
  >
    <view :class="`wd-floating-panel__header`" @touchstart="handleTouchStart">
      <view :class="`wd-floating-panel__header-bar`"></view>
    </view>

    <!-- 内容区：可拖拽时不拦截（触摸冒泡到根 view 主线程 worklet 跟手）；
         不可拖拽时以 catch 语义拦截（不冒泡、不跟手、不原生滚动）。
         两分支类名 / 层级一致，仅事件绑定不同（同名事件禁双绑，跟手与
         滚动接管无法挂在同一元素的同一事件上，CONVENTIONS §10） -->
    <template v-if="contentDraggable">
      <scroll-view :class="`wd-floating-panel__content`" :show-scrollbar="showScrollbar" scroll-y @touchstart="recordGestureStart">
        <slot />
      </scroll-view>
    </template>
    <template v-else>
      <scroll-view
        :class="`wd-floating-panel__content`"
        :show-scrollbar="showScrollbar"
        scroll-y
        @touchstart="handleBlockedContentTouchStart"
        @touchmove.stop.prevent="noop"
      >
        <slot />
      </scroll-view>
    </template>
  </view>
</template>
