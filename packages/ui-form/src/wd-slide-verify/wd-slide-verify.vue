/*
 * wd-slide-verify — 滑动验证（原生优先重写版）
 *
 * Lynx 实现说明（相对 wot-ui 2.3.2 的适配点）：
 * - **跟手走主线程（声明式 MTS）**：滑块的 touchmove 经
 *   `main-thread-bindtouchmove` 绑定 'main thread' worklet，触点经绝对
 *   定位公式（起始位置 + 触点位移）换算后 `setStyleProperty` 直改轨道
 *   宽度——零线程跨越，低端机跟手无滞后（CONVENTIONS §10）；
 * - **几何绑定到每段手势**：container-width / container-height 属性供首帧
 *   同步使用，touchstart 再经根元素 invoke 一次补测真实矩形；即使旧缓存
 *   非零也刷新，避免首屏短宽度把终点截在中途。度量期间记录最新触点，
 *   回调只补到本段，旧段 / reset 后的回调不再写样式；move 热路径不查询；
 * - **真机冒泡语义（跨元素分工）**：滑块（button）的 touchstart /
 *   touchend 为后台绑定（记录拖动态、提交判定），touchmove 为主线程
 *   worklet；轨道（track，滑块的父元素）另绑主线程 touchstart /
 *   touchend / touchcancel worklet——真机上滑块的触摸事件冒泡到轨道即
 *   触发（slider 范本同款分工）。jsdom 不模拟冒泡，测试中需直接派发到
 *   轨道验证 worklet 逻辑；
 * - **范围与状态经元素属性桥接**：起始位置 start-pos 与禁用态
 *   drag-disabled 由后台随重渲染下发到轨道元素，worklet 经
 *   `getAttribute` 实时读取（slider 的 left-bound / right-bound 同款）；
 * - **防滚动接管**：轨道以后台 `@touchmove.stop.prevent` 空处理承担
 *   （原按钮级 catch 语义上移至轨道——按钮的 touchmove 已被主线程
 *   worklet 占用，同名事件禁止双绑）；按钮的 touchstart 不加 .stop，
 *   保证冒泡到轨道的 worklet 能收到；
 * - **落定走后台**：touchend 用同一套绝对公式由 changedTouches 重算
 *   终值并 commit（success / fail），提交逻辑（含成功态落位）留在
 *   后台，可单测；
 * - **fail-closed**：度量不可用（容器宽高为 0）时 worklet 不写样式、
 *   后台不判定通过（与 slider trackSize=0 不提交同一取舍）；
 * - **度量三路兜底**（真机 2026-11-05 缺陷修复）：真机首帧的 onMounted
 *   度量可能拿到 0（布局未完成，wd-slider 同款缺陷）——尺寸一旦为 0，轨道
 *   内联宽度就是 0px，overflow:hidden 的轨道把 40×40 滑块整块裁掉（表现为
 *   「没有滑动按钮」），maxPosition 也为 0，fail-closed 永远判不过（表现为
 *   「没有正常的效果」）。故：① 根节点挂原生 layoutchange，布局完成后补
 *   度量；② 手势开始即补测（落定前拿到真实尺寸）；③ 落定时尺寸仍缺失则
 *   先补测再提交，避免把本可通过的手势误判为 fail；④ 轨道 CSS min-width
 *   兜底滑块尺寸，度量缺失时滑块也不被裁掉；
 * - worklet 捕获的外层变量为渲染期快照；几何为 0 时守值不写 NaN；
 * - trackStyle 为 computed（依赖不变时返回同一引用）：拖动态引起的
 *   重渲染不会重写轨道内联样式，worklet 直改值不被冲刷（§20）；
 * - customStyle / backgroundColor / activeBackgroundColor 经 parseStyle +
 *   filterStyle 归一为对象语法下发（CONVENTIONS §19）；
 * - 布局居中：根节点显式 display: flex + flex-direction: column，提示
 *   文字容器 flex 居中 + text-align: center（CONVENTIONS §15 / §3.1）。
 */
<script lang="ts" setup>
import './index.css'

import { computed, getCurrentInstance, onBeforeUnmount, onMounted, ref, useMainThreadRef, watch, withModifiers } from 'vue-lynx'
import WdIcon from '@wot-lynx/primitives/wd-icon'
import { slideVerifyProps, type SlideVerifyEmits, type SlideVerifyExpose } from './types'
import { useTouch } from '@wot-lynx/core/composables/useTouch'
import { useTranslate } from '@wot-lynx/core/composables/useTranslate'
import { useAlive } from '@wot-lynx/core/composables/useAlive'
import { getRect, uuid, isDef, parseStyle, type CSSProperties } from '@wot-lynx/core/common/util'
import { createStyleResolver } from '@wot-lynx/core/common/style'

const props = defineProps(slideVerifyProps)
const emit = defineEmits<SlideVerifyEmits>()
const isAlive = useAlive()

const slideVerifyId = ref<string>(`wd-slide-verify-${uuid()}`)

const { proxy } = getCurrentInstance() as any

const touch = useTouch()
const { translate } = useTranslate('slideVerify')

const slideVerifyText = computed(() => {
  return isDef(props.text) && props.text !== '' ? props.text : translate('text')
})

const slideVerifySuccessText = computed(() => {
  return isDef(props.successText) && props.successText !== '' ? props.successText : translate('successText')
})

const rootClass = computed(() => {
  return [
    'wd-slide-verify',
    {
      'is-disabled': props.disabled,
      'is-success': isPass.value,
      'is-dragging': isDragging.value
    },
    props.customClass
  ]
})

// 只仲裁横向原生滑动；纵向滚页继续交给外层 scroll-view。
const consumeSlideEvent = computed(() => props.disabled ? [] : [[-180, -135], [-45, 45], [135, 180]])
const resolveRootStyle = createStyleResolver({ 'background-color': '', 'touch-action': 'pan-y' })
const rootStyle = computed(() => resolveRootStyle({
  'background-color': props.backgroundColor,
  'touch-action': props.disabled ? 'auto' : 'pan-y'
}, parseStyle(props.customStyle)))

let lastTrackStyle: CSSProperties | undefined
const trackStyle = computed(() => {
  // 跟手期间宽度归 MT 所有。补测/布局事件只能刷新下次落定的几何，
  // 不能拿 BG 的起始位置覆盖 MT 当前宽度；同值返回旧引用也避免重复 SET_STYLE。
  const height = isDragging.value ? gestureHeight.value : containerHeight.value
  const style: CSSProperties = {
    width: `${currentPosition.value + height}px`,
    transition: isResetting.value ? 'width 0.3s ease' : 'none',
    'background-color': currentPosition.value === 0
      ? 'transparent'
      : (isDef(props.activeBackgroundColor) ? (props.activeBackgroundColor as string) : '')
  }
  if (lastTrackStyle && Object.keys(style).every((key) => style[key] === lastTrackStyle![key])) return lastTrackStyle
  lastTrackStyle = style
  return style
})

const containerWidth = ref<number>(0)
const containerHeight = ref<number>(0)
const gestureHeight = ref<number>(0)

/** 度量请求代次：被新度量取代的晚到回调不写缓存 */
let rectRequest = 0
/** 手势代次：补测落定期间新手手势接管后，旧回调不再提交 */
let gestureRequest = 0
let activeMeasure: Promise<void> | undefined

/**
 * 写入容器尺寸（忽略 0 / 非有限值：布局未完成的首帧回调不能把已度量
 * 的尺寸冲掉，wd-slider onTrackLayoutChange 同款守界）。
 */
function applyRect(rect: any): void {
  const width = Number(rect?.width)
  const height = Number(rect?.height)
  if (Number.isFinite(width) && width > 0) containerWidth.value = width
  if (Number.isFinite(height) && height > 0) containerHeight.value = height
  if (isPass.value) currentPosition.value = maxPosition.value
}

/**
 * 原生 layoutchange：布局完成后的真实矩形。
 *
 * 真机首帧的 onMounted 度量可能拿到 0（布局未完成，wd-slider 2026-11-05
 * 同款缺陷）：尺寸为 0 时轨道内联宽度是 0px——overflow:hidden 的轨道把
 * 滑块整块裁掉（「没有滑动按钮」），maxPosition 也为 0——fail-closed 永远
 * 判不过（「没有正常的效果」）。布局完成由原生事件补度量。
 *
 * 事件同时声明为 emit 并转发（CONVENTIONS §14）：消费方在组件上绑
 * @layoutchange 时，监听不会穿透 $attrs 与根元素自身监听合并成数组——
 * 那种合并值被设备事件注册表原样调用会抛 registry TypeError。
 */
function onRootLayoutChange(event: any): void {
  emit('layoutchange', event)
  if (!isAlive()) return
  const data = event?.detail?.layout ?? event?.detail
  if (!data) return
  if (Number(data.width) > 0 || Number(data.height) > 0) rectRequest++
  applyRect(data)
}

/** getRect 兜底度量（Web 预览 / 未派发 layoutchange 的宿主） */
function measure(): Promise<void> {
  const request = ++rectRequest
  return getRect(`#${slideVerifyId.value}`)
    .then((rect) => {
      // 回调晚于卸载落地时丢弃：在已销毁树上写 ref 会触发晚到的
      // remove/insert（真机 9902 家族）
      if (!isAlive() || request !== rectRequest) return
      applyRect(rect)
    })
    .catch(() => {
      // getRect 约定永不 reject；守界保持 fail-closed（尺寸 0 不放行）
    })
}

/** 尺寸缺失时补测（手势开始 / 落定前）——wd-slider ensureTrackSize 同款 */
function ensureSize(): Promise<void> {
  if (containerWidth.value > 0 && containerHeight.value > 0) return Promise.resolve()
  return measure()
}

const init = async () => {
  await measure()
}

onMounted(async () => {
  await init()
})

// 最大位置，基于实测容器宽高计算
const maxPosition = computed(() => {
  const { value: w } = containerWidth
  const { value: h } = containerHeight
  if (w <= 0 || h <= 0) return 0
  return Math.max(0, w - h)
})

// 完成状态判断（fail-closed：度量不可用时 maxPosition 为 0，不得放行）
const isComplete = computed(() => {
  if (maxPosition.value <= 0) return false
  const distance = Math.abs(maxPosition.value - currentPosition.value)
  return distance <= props.tolerance // 容差范围内完成
})

// 位置状态
const currentPosition = ref<number>(0)
const startPosition = ref<number>(0)
// 成功状态
const isPass = ref<boolean>(false)
// 拖动状态
const isDragging = ref<boolean>(false)
// 回弹
const isResetting = ref(false)

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(value, max))
const updatePosition = (position: number) => {
  // 限制位置在允许范围内
  currentPosition.value = clamp(position, 0, maxPosition.value)
}

const isDisabled = computed(() => props.disabled || isPass.value)

/**
 * 触点坐标 → 滑块位置（绝对定位公式，后台 touchend 落定用；
 * 与主线程 worklet onButtonTouchMoveMt 同一公式）
 * @param clientX 触点横坐标（页面坐标）
 */
function pointerToPosition(clientX: number): number {
  const startX = touch.startX.value
  return clamp(startPosition.value + (clientX - startX), 0, maxPosition.value)
}

const onTouchStart = (event: any): void => {
  const point = event?.touches?.[0]
  if (!isAlive() || isDisabled.value || event?.touches?.length !== 1 || !Number.isFinite(point?.clientX)) return

  if (timer.value !== null) {
    clearTimeout(timer.value)
    timer.value = null
  }
  isResetting.value = false
  touch.touchStart(event)
  startPosition.value = currentPosition.value
  gestureHeight.value = containerHeight.value
  isDragging.value = true
  gestureRequest++
  // Web 未必派发 layoutchange；不能把旧的非零首帧宽度永久当作终点。
  // 每段只在 start 补一次度量，move 热路径不查询。
  activeMeasure = measure()
}

// 控制回弹
const timer = ref<ReturnType<typeof setTimeout> | null>(null)
const gestureVersion = ref(0)

function returnToStart(notify: boolean): void {
  if (timer.value !== null) clearTimeout(timer.value)
  gestureRequest++
  gestureVersion.value++
  activeMeasure = undefined
  isDragging.value = false
  isResetting.value = true
  currentPosition.value = 0
  startPosition.value = 0
  const request = gestureRequest
  if (notify) emit('fail')
  timer.value = setTimeout(() => {
    if (!isAlive() || request !== gestureRequest) return
    isResetting.value = false
    timer.value = null
  }, 300)
}

const onTouchCancel = (): void => {
  if (!isDragging.value) return
  // cancel 不是成功落定，即使最后一个触点在终点也必须回弹。
  returnToStart(true)
}

watch(() => props.disabled, (disabled) => {
  if (disabled && (isDragging.value || activeMeasure)) returnToStart(false)
})

const onTouchEnd = (event: any): void => {
  if (isDisabled.value || !isDragging.value) return
  isDragging.value = false

  // 落定：同一公式由 changedTouches 重算终值（touchmove 跟手在主线程）
  const changed = event?.changedTouches?.[0] || event?.touches?.[0]
  const clientX = changed ? Number(changed.clientX) : NaN
  // 补测落定期间新手手势接管后，旧回调不得再提交
  const request = gestureRequest

  const commit = (): void => {
    if (!isAlive() || isDisabled.value || request !== gestureRequest) return
    if (Number.isFinite(clientX)) {
      updatePosition(pointerToPosition(clientX))
    }

    if (isComplete.value) {
      // 完成
      updatePosition(maxPosition.value)
      isPass.value = true
      emit('success')
    } else {
      returnToStart(true)
    }
  }

  const pending = activeMeasure
  const finish = (): void => {
    if (!isAlive() || request !== gestureRequest) return
    if (activeMeasure === pending) activeMeasure = undefined
    if (maxPosition.value <= 0) {
      void ensureSize().then(commit)
    } else {
      commit()
    }
  }
  if (pending) void pending.then(finish)
  else finish()
}

onBeforeUnmount(() => {
  if (timer.value !== null) {
    clearTimeout(timer.value)
    timer.value = null
  }
})

/**
 * 重置验证组件到初始状态
 */
const reset = () => {
  isPass.value = false
  returnToStart(false)
}

/**
 * 轨道后台 touchmove：仅承担防滚动接管（catch 语义）。
 *
 * 按钮的 touchmove 已被主线程 worklet 占用（同名事件禁止双绑），
 * wot-ui 按钮级 @touchmove.prevent 的 catch 语义按真机冒泡上移至轨道
 * （bugfix #10）；拖动计算全部在主线程 worklet 与后台 touchend 完成。
 */
const onTrackTouchMove = withModifiers((): void => {}, ['stop', 'prevent'])

defineExpose<SlideVerifyExpose>({ reset, init })

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

/** 容器（根）元素：worklet 一次性度量几何 */
const rootRef = useMainThreadRef<MtElement | null>(null)
/** 轨道元素：worklet 跟手直改宽度 */
const trackRef = useMainThreadRef<MtElement | null>(null)
/** 一段手势自持几何与最新坐标，异步度量只能更新它自己的段。 */
interface MtDrag {
  startX: number
  lastX: number
  startPos: number
  width: number
  height: number
  version: string
  started: number
  write: () => void
}
const dragRef = useMainThreadRef<MtDrag | null>(null)

/**
 * 轨道 start 由握把冒泡而来：属性先供首帧使用，再补一次真实根节点度量。
 * 不能只在属性为 0 时度量，否则旧的非零首屏宽度会把终点截在中途。
 * write 留在本段内；迟到查询、reset 后 move 都不能污染下一段。
 */
const onTrackTouchStartMt = (event: any) => {
  'main thread'
  const track = trackRef.current
  const point = event?.touches?.[0]
  if (!track || event?.touches?.length !== 1 || !Number.isFinite(point?.clientX)) return
  if (track.getAttribute('drag-disabled') === 'true') return
  const drag: MtDrag = {
    startX: point.clientX,
    lastX: point.clientX,
    startPos: Number(track.getAttribute('start-pos')) || 0,
    width: Number(track.getAttribute('container-width')) || 0,
    height: Number(track.getAttribute('container-height')) || 0,
    version: track.getAttribute('gesture-version') || '0',
    started: Number(event.timestamp) || 0,
    write: () => {}
  }
  const write = () => {
    if (dragRef.current !== drag || trackRef.current !== track) return
    if (track.getAttribute('drag-disabled') === 'true' || drag.version !== track.getAttribute('gesture-version')) return
    const maxPos = drag.width - drag.height
    if (drag.width <= 0 || drag.height <= 0 || maxPos <= 0) return
    const pos = Math.min(Math.max(drag.startPos + drag.lastX - drag.startX, 0), maxPos)
    track.setStyleProperty('transition', 'none')
    track.setStyleProperty('width', `${pos + drag.height}px`)
    track.setStyleProperty('background-color', pos === 0 ? 'transparent' : track.getAttribute('active-background-color') || '')
  }
  drag.write = write
  dragRef.current = drag
  write()
  const root = rootRef.current
  if (root && typeof root.invoke === 'function') {
    root.invoke('boundingClientRect').then((rect: any) => {
      if (dragRef.current !== drag || rootRef.current !== root) return
      const width = Number(rect?.width)
      const height = Number(rect?.height)
      if (Number.isFinite(width) && width > 0) drag.width = width
      if (Number.isFinite(height) && height > 0) drag.height = height
      // 度量期间已有 move 时，立即补到最新触点，不丢首段。
      write()
    }).catch(() => {})
  }
}

/** 跟手只读段内缓存；每帧不查询几何、不跨线程更新响应式位置。 */
const onButtonTouchMoveMt = (event: any) => {
  'main thread'
  const track = trackRef.current
  const drag = dragRef.current
  const point = event?.touches?.[0]
  if (!track || !drag || event?.touches?.length !== 1 || !Number.isFinite(point?.clientX)) return
  const timestamp = Number(event.timestamp) || 0
  if (timestamp && drag.started && timestamp < drag.started) return
  drag.lastX = point.clientX
  // 首次查询未就绪时可用 BG 随 layoutchange 下发的尺寸，但不反复度量。
  if (drag.width <= 0) drag.width = Number(track.getAttribute('container-width')) || 0
  if (drag.height <= 0) drag.height = Number(track.getAttribute('container-height')) || 0
  drag.write()
}

/**
 * 轨道触摸结束 / 取消（主线程）：清空手势起点，避免上一帧起点残留
 * 导致下一次跟手跳变。
 */
const onTrackTouchEndMt = () => {
  'main thread'
  dragRef.current = null
}

// v-bind 对象走 FULL_PROPS，style 的同引用才真正不重发 SET_STYLE。
// 单独 :style 会被编译为 STYLE 快速路径，布局重渲染时即使引用不变仍重写宽度。
const trackBindings = computed(() => ({
  class: 'wd-slide-verify__track',
  style: trackStyle.value,
  'main-thread-ref': trackRef,
  'start-pos': String(currentPosition.value),
  'drag-disabled': String(isDisabled.value),
  'container-width': String(containerWidth.value),
  'container-height': String(containerHeight.value),
  'gesture-version': String(gestureVersion.value),
  'active-background-color': props.activeBackgroundColor || ''
}))
</script>

<template>
  <view :id="slideVerifyId" :class="rootClass" :style="rootStyle" :main-thread-ref="rootRef" :flatten="false" :consume-slide-event="consumeSlideEvent" @layoutchange="onRootLayoutChange">
    <!-- 背景提示文字 -->
    <view class="wd-slide-verify__text">
      <slot name="text">
        <text class="wd-slide-verify__text-inner" text-maxline="1">
          {{ slideVerifyText }}
        </text>
      </slot>
    </view>
    <!-- 滑过区域，包含滑块（main-thread-ref 供 worklet 跟手直改；
         start-pos / drag-disabled 向主线程下发起始位置与禁用态，
         container-width / container-height 下发后台实测容器几何） -->
    <view
      v-bind="{
        ...trackBindings,
        'main-thread-bindtouchstart': onTrackTouchStartMt,
        'main-thread-bindtouchend': onTrackTouchEndMt,
        'main-thread-bindtouchcancel': onTrackTouchEndMt,
        onTouchmove: onTrackTouchMove
      }"
    >
      <view v-if="isPass" class="wd-slide-verify__track-text">
        <slot name="success-text">
          <text class="wd-slide-verify__track-text-inner" text-maxline="1">{{ slideVerifySuccessText }}</text>
        </slot>
      </view>
      <!-- 滑块：touchstart / touchend 后台（拖动态记录与落定提交），
           touchmove 主线程 worklet（跟手直改） -->
      <view class="wd-slide-verify__button" :flatten="false" @touchstart="onTouchStart" :main-thread-bindtouchmove="onButtonTouchMoveMt" @touchend="onTouchEnd" @touchcancel="onTouchCancel">
        <slot v-if="isPass" name="success-icon">
          <WdIcon
            custom-class="wd-slide-verify__button-icon wd-slide-verify__button-icon--success"
            :name="successIcon"
            :size="successIconSize"
            :class-prefix="iconPrefix"
            :css-icon="cssIcon"
            :user-interaction-enabled="false"
            :custom-style="{ 'pointer-events': 'none' }"
          />
        </slot>

        <slot v-else name="icon">
          <WdIcon custom-class="wd-slide-verify__button-icon" :name="icon" :size="iconSize" :class-prefix="iconPrefix" :css-icon="cssIcon" :user-interaction-enabled="false" :custom-style="{ 'pointer-events': 'none' }" />
        </slot>
      </view>
    </view>
  </view>
</template>
