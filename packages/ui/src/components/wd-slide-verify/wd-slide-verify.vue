/*
 * wd-slide-verify — 滑动验证（原生优先重写版）
 *
 * Lynx 实现说明（相对 wot-ui 2.3.2 的适配点）：
 * - **跟手走主线程（声明式 MTS）**：滑块的 touchmove 经
 *   `main-thread-bindtouchmove` 绑定 'main thread' worklet，触点经绝对
 *   定位公式（起始位置 + 触点位移）换算后 `setStyleProperty` 直改轨道
 *   宽度——零线程跨越，低端机跟手无滞后（CONVENTIONS §10）；
 * - **几何经元素属性桥接（主线程同步可取）**：后台实测的容器宽高经
 *   container-width / container-height 属性下发到轨道，worklet 在
 *   touchstart 同步读取并缓入 MainThreadRef（geomRef），手势起点 clientX
 *   同帧记录（dragRef）——不在 touchmove 热路径重复度量
 *   （CONVENTIONS §16）；属性缺失（度量未就绪）时才回退
 *   `MainThread.Element.invoke('boundingClientRect')` 一次性度量
 *   （slider 的 gesture-size 同款分工）；
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

import { computed, getCurrentInstance, onBeforeUnmount, onMounted, ref, useMainThreadRef } from 'vue-lynx'
import WdIcon from '../../primitives/wd-icon/wd-icon.vue'
import { slideVerifyProps, type SlideVerifyEmits, type SlideVerifyExpose } from './types'
import { useTouch } from '../../composables/useTouch'
import { useTranslate } from '../../composables/useTranslate'
import { useAlive } from '../../composables/useAlive'
import { getRect, uuid, isDef, filterStyle, parseStyle, type CSSProperties } from '../../common/util'

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

const rootStyle = computed(() => {
  const style: CSSProperties = {}
  if (isDef(props.backgroundColor)) {
    style.background = props.backgroundColor
  }
  // Lynx：customStyle 为字符串，经 parseStyle 归一为对象后合并（§19）
  return { ...filterStyle(style), ...parseStyle(props.customStyle) }
})

const trackStyle = computed(() => {
  // Style Funnel（§20）：background 任何一帧都必须显式输出。归零时写
  // 'transparent'，滑走后若省略该键，transparent 会按 SET_STYLE 逐属性
  // 合并语义永久残留——默认用法（不传 activeBackgroundColor）的滑过填充
  // 色将永不显示。'' 为中性值：清除内联后回落类样式 $slide-verify-track-bg。
  const style: CSSProperties = {
    width: `${currentPosition.value + containerHeight.value}px`,
    transition: isResetting.value ? 'all 0.3s ease' : 'none',
    'background-color': currentPosition.value === 0
      ? 'transparent'
      : (isDef(props.activeBackgroundColor) ? (props.activeBackgroundColor as string) : '')
  }
  return style
})

const containerWidth = ref<number>(0)
const containerHeight = ref<number>(0)

/** 度量请求代次：被新度量取代的晚到回调不写缓存 */
let rectRequest = 0
/** 手势代次：补测落定期间新手手势接管后，旧回调不再提交 */
let gestureRequest = 0

/**
 * 写入容器尺寸（忽略 0 / 非有限值：布局未完成的首帧回调不能把已度量
 * 的尺寸冲掉，wd-slider onTrackLayoutChange 同款守界）。
 */
function applyRect(rect: any): void {
  const width = Number(rect?.width)
  const height = Number(rect?.height)
  if (Number.isFinite(width) && width > 0) containerWidth.value = width
  if (Number.isFinite(height) && height > 0) containerHeight.value = height
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
  applyRect(data)
}

/** getRect 兜底度量（Web 预览 / 未派发 layoutchange 的宿主） */
function measure(): Promise<void> {
  const request = ++rectRequest
  return getRect(`#${slideVerifyId.value}`, false, proxy)
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
  if (isDisabled.value || isDragging.value) return

  touch.touchStart(event)
  startPosition.value = currentPosition.value
  isDragging.value = true
  gestureRequest++
  // 首帧度量可能为 0：手势开始即补测，落定前拿到真实容器尺寸
  if (maxPosition.value <= 0) void ensureSize()
}

// 控制回弹
const timer = ref<ReturnType<typeof setTimeout> | null>(null)

const onTouchEnd = (event: any): void => {
  if (isDisabled.value || !isDragging.value) return
  isDragging.value = false

  // 落定：同一公式由 changedTouches 重算终值（touchmove 跟手在主线程）
  const changed = event?.changedTouches?.[0] || event?.touches?.[0]
  const clientX = changed ? Number(changed.clientX) : NaN
  // 补测落定期间新手手势接管后，旧回调不得再提交
  const request = gestureRequest

  const commit = (): void => {
    if (!isAlive() || request !== gestureRequest) return
    if (Number.isFinite(clientX)) {
      updatePosition(pointerToPosition(clientX))
    }

    if (isComplete.value) {
      // 完成
      updatePosition(maxPosition.value)
      isPass.value = true
      emit('success')
    } else {
      isResetting.value = true
      // 失败回到起点
      updatePosition(0)
      emit('fail')

      timer.value = setTimeout(() => {
        isResetting.value = false
      }, 300)
    }
  }

  // 度量缺失（首帧 0）：先补测再落定。否则 maxPosition 为 0 时
  // updatePosition 会把终值钳到 0，本可通过的手势被误判成 fail。
  if (maxPosition.value <= 0) {
    void ensureSize().then(commit)
    return
  }
  commit()
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
  if (timer.value !== null) {
    clearTimeout(timer.value)
    timer.value = null
  }
  // 新手势代次：补测落定中的旧回调不得再提交（否则会把重置态又拖回去）
  gestureRequest++
  isResetting.value = true
  currentPosition.value = 0
  startPosition.value = 0
  isPass.value = false
  isDragging.value = false
  timer.value = setTimeout(() => {
    isResetting.value = false
  }, 300)
}

/**
 * 轨道后台 touchmove：仅承担防滚动接管（catch 语义）。
 *
 * 按钮的 touchmove 已被主线程 worklet 占用（同名事件禁止双绑），
 * wot-ui 按钮级 @touchmove.prevent 的 catch 语义按真机冒泡上移至轨道
 * （bugfix #10）；拖动计算全部在主线程 worklet 与后台 touchend 完成。
 */
const onTrackTouchMove = (): void => {}

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
/** 容器几何快照 { width, height }（worklet 内 .current 活值） */
const geomRef = useMainThreadRef<{ width: number; height: number } | null>(null)
/** 手势起点 { startX }（worklet 内 .current 活值，touchend 清尾） */
const dragRef = useMainThreadRef<{ startX: number } | null>(null)

/**
 * 轨道触摸开始（主线程）：取容器几何并记录手势起点。
 *
 * 经轨道元素绑定：滑块的 touchstart 是后台绑定（记录拖动态），同名
 * 事件不能同时挂主线程与后台两个处理器；滑块与轨道自身的触摸都会
 * 冒泡到此处，度量的是同一个容器，语义正确（slider 范本同款分工）。
 *
 * 几何优先读后台经属性同步下发的实测尺寸（slider gesture-size 同款：
 * 同步可取、无 Promise 时序）；属性缺失（后台度量未就绪）时才回退
 * 主线程 invoke 一次性度量。
 */
const onTrackTouchStartMt = (event: any) => {
  'main thread'
  const track = trackRef.current
  const touch0 = event.touches && event.touches[0]
  if (!touch0) return
  const attrWidth = Number(track?.getAttribute('container-width'))
  const attrHeight = Number(track?.getAttribute('container-height'))
  if (attrWidth > 0 && attrHeight > 0) {
    geomRef.current = { width: attrWidth, height: attrHeight }
  } else {
    const root = rootRef.current
    if (root && typeof root.invoke === 'function') {
      root.invoke('boundingClientRect').then((rect: any) => {
        geomRef.current = {
          width: Number(rect.width) || 0,
          height: Number(rect.height) || 0
        }
      })
    }
  }
  dragRef.current = { startX: touch0.clientX }
}

/**
 * 滑块跟手移动（主线程）：绝对定位公式 + 轨道宽度直改。
 *
 * 起始位置与禁用态经轨道元素属性 start-pos / drag-disabled 实时读取
 * （后台随重渲染更新）；几何缺失（度量不可用）时守值返回，不写 NaN。
 */
const onButtonTouchMoveMt = (event: any) => {
  'main thread'
  const track = trackRef.current
  const geom = geomRef.current
  const drag = dragRef.current
  if (!track || !geom || !drag) return
  if (geom.width <= 0 || geom.height <= 0) return
  if (track.getAttribute('drag-disabled') === 'true') return

  const touch0 = event.touches && event.touches[0]
  if (!touch0) return

  const maxPos = geom.width - geom.height
  if (maxPos <= 0) return

  const startPos = Number(track.getAttribute('start-pos')) || 0
  const pos = Math.min(Math.max(startPos + (touch0.clientX - drag.startX), 0), maxPos)
  track.setStyleProperty('width', `${pos + geom.height}px`)
}

/**
 * 轨道触摸结束 / 取消（主线程）：清空手势起点，避免上一帧起点残留
 * 导致下一次跟手跳变。
 */
const onTrackTouchEndMt = () => {
  'main thread'
  dragRef.current = null
}
</script>

<template>
  <view :id="slideVerifyId" :class="rootClass" :style="rootStyle" :main-thread-ref="rootRef" @layoutchange="onRootLayoutChange">
    <!-- 背景提示文字 -->
    <view class="wd-slide-verify__text">
      <slot name="text">
        <text class="wd-slide-verify__text-inner">
          {{ slideVerifyText }}
        </text>
      </slot>
    </view>
    <!-- 滑过区域，包含滑块（main-thread-ref 供 worklet 跟手直改；
         start-pos / drag-disabled 向主线程下发起始位置与禁用态，
         container-width / container-height 下发后台实测容器几何） -->
    <view
      class="wd-slide-verify__track"
      :style="trackStyle"
      :main-thread-ref="trackRef"
      :start-pos="String(currentPosition)"
      :drag-disabled="String(isDisabled)"
      :container-width="String(containerWidth)"
      :container-height="String(containerHeight)"
      :main-thread-bindtouchstart="onTrackTouchStartMt"
      :main-thread-bindtouchend="onTrackTouchEndMt"
      :main-thread-bindtouchcancel="onTrackTouchEndMt"
      @touchmove.stop.prevent="onTrackTouchMove"
    >
      <view class="wd-slide-verify__track-text">
        <slot name="success-text">
          <text>{{ slideVerifySuccessText }}</text>
        </slot>
      </view>
      <!-- 滑块：touchstart / touchend 后台（拖动态记录与落定提交），
           touchmove 主线程 worklet（跟手直改） -->
      <view class="wd-slide-verify__button" @touchstart="onTouchStart" :main-thread-bindtouchmove="onButtonTouchMoveMt" @touchend="onTouchEnd">
        <slot v-if="isPass" name="success-icon">
          <WdIcon
            custom-class="wd-slide-verify__button-icon wd-slide-verify__button-icon--success"
            :name="successIcon"
            :size="successIconSize"
            :class-prefix="iconPrefix"
            :css-icon="cssIcon"
          />
        </slot>

        <slot v-else name="icon">
          <WdIcon custom-class="wd-slide-verify__button-icon" :name="icon" :size="iconSize" :class-prefix="iconPrefix" :css-icon="cssIcon" />
        </slot>
      </view>
    </view>
  </view>
</template>
