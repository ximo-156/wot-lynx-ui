/*
 * wd-slide-verify — 滑动验证（原生优先重写版）
 *
 * Lynx 实现说明（相对 wot-ui 2.3.2 的适配点）：
 * - **跟手走主线程（声明式 MTS）**：滑块的 touchmove 经
 *   `main-thread-bindtouchmove` 绑定 'main thread' worklet，触点经绝对
 *   定位公式（起始位置 + 触点位移）换算后 `setStyleProperty` 直改轨道
 *   宽度——零线程跨越，低端机跟手无滞后（CONVENTIONS §10）；
 * - **几何主线程自度量**：容器矩形由 worklet 在轨道 touchstart（主线程）
 *   时经 `MainThread.Element.invoke('boundingClientRect')` 获取并缓入
 *   MainThreadRef（geomRef），手势起点 clientX 同帧记录（dragRef）——
 *   不在 touchmove 热路径重复度量（CONVENTIONS §16）；
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
import WdIcon from '../wd-icon/wd-icon.vue'
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
  const style: CSSProperties = {
    width: `${currentPosition.value + containerHeight.value}px`,
    transition: isResetting.value ? 'all 0.3s ease' : 'none'
  }
  if (isDef(props.activeBackgroundColor)) {
    style.background = props.activeBackgroundColor
  }
  if (currentPosition.value === 0) {
    style.background = 'transparent'
  }
  return filterStyle(style)
})

const containerWidth = ref<number>(0)
const containerHeight = ref<number>(0)

const init = async () => {
  try {
    const rect = await getRect(`#${slideVerifyId.value}`, false, proxy)
    // 回调晚于卸载落地时丢弃：在已销毁树上写 ref 会触发晚到的
    // remove/insert（真机 9902 家族）
    if (!isAlive()) return
    containerWidth.value = rect.width || 0
    containerHeight.value = rect.height || 0
  } catch (e) {
    containerWidth.value = 0
    containerHeight.value = 0
  }
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
}

// 控制回弹
const timer = ref<ReturnType<typeof setTimeout> | null>(null)

const onTouchEnd = (event: any): void => {
  if (isDisabled.value || !isDragging.value) return
  isDragging.value = false

  // 落定：同一公式由 changedTouches 重算终值（touchmove 跟手在主线程）
  const changed = event?.changedTouches?.[0] || event?.touches?.[0]
  if (changed) {
    updatePosition(pointerToPosition(Number(changed.clientX)))
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
 * 轨道触摸开始（主线程）：一次性度量容器几何并记录手势起点。
 *
 * 经轨道元素绑定：滑块的 touchstart 是后台绑定（记录拖动态），同名
 * 事件不能同时挂主线程与后台两个处理器；滑块与轨道自身的触摸都会
 * 冒泡到此处，度量的是同一个容器，语义正确（slider 范本同款分工）。
 */
const onTrackTouchStartMt = (event: any) => {
  'main thread'
  const root = rootRef.current
  const touch0 = event.touches && event.touches[0]
  if (!touch0) return
  if (root && typeof root.invoke === 'function') {
    root.invoke('boundingClientRect').then((rect: any) => {
      geomRef.current = {
        width: Number(rect.width) || 0,
        height: Number(rect.height) || 0
      }
    })
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
  <view :id="slideVerifyId" :class="rootClass" :style="rootStyle" :main-thread-ref="rootRef">
    <!-- 背景提示文字 -->
    <view class="wd-slide-verify__text">
      <slot name="text">
        <text class="wd-slide-verify__text-inner">
          {{ slideVerifyText }}
        </text>
      </slot>
    </view>
    <!-- 滑过区域，包含滑块（main-thread-ref 供 worklet 跟手直改；
         start-pos / drag-disabled 属性向主线程下发起始位置与禁用态） -->
    <view
      class="wd-slide-verify__track"
      :style="trackStyle"
      :main-thread-ref="trackRef"
      :start-pos="String(currentPosition)"
      :drag-disabled="String(isDisabled)"
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
