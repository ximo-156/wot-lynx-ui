/*
 * wd-slide-verify — 滑动验证
 *
 * Lynx 实现说明（相对 wot-ui 2.3.2 的适配点）：
 * - 提示文字插值包进 text 元素（Lynx 要求所有文本位于 text 中，
 *   wot-ui 的 track-text 为裸插值）；
 * - customStyle / backgroundColor / activeBackgroundColor 经 parseStyle +
 *   filterStyle 归一为对象语法下发（CONVENTIONS §19：字符串 style 会被
 *   vue-lynx 静默丢弃）；
 * - 触摸事件保留同名（Lynx 原生派发 touches/changedTouches）；
 *   wot-ui 的 @touchmove.prevent 在小程序侧等价 catchtouchmove，
 *   按 CONVENTIONS §6 映射为 @touchmove.stop.prevent，防止竖向拖动时
 *   页面滚动接手势；
 * - 容器宽高经 getRect 一次性度量（挂载后），touchmove 热路径只读缓存
 *   （CONVENTIONS §16）；度量回调晚于卸载落地时经 useAlive 守卫丢弃；
 * - 无 uni-app / 小程序专有 props，无平台能力事件，API 与 wot-ui 一致。
 */
<script lang="ts" setup>
import './index.css'

import { computed, getCurrentInstance, onBeforeUnmount, onMounted, ref } from 'vue-lynx'
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

// 完成状态判断
const isComplete = computed(() => {
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
const onTouchStart = (event: TouchEvent): void => {
  if (isDisabled.value || isDragging.value) return

  touch.touchStart(event)
  startPosition.value = currentPosition.value
  isDragging.value = true
}

const onTouchMove = (event: TouchEvent): void => {
  if (isDisabled.value || !isDragging.value) return

  touch.touchMove(event)
  updatePosition(startPosition.value + touch.deltaX.value)
}
// 控制回弹
const timer = ref<ReturnType<typeof setTimeout> | null>(null)

const onTouchEnd = (): void => {
  if (isDisabled.value || !isDragging.value) return
  isDragging.value = false

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

defineExpose<SlideVerifyExpose>({ reset, init })
</script>

<template>
  <view :id="slideVerifyId" :class="rootClass" :style="rootStyle">
    <!-- 背景提示文字 -->
    <view class="wd-slide-verify__text">
      <slot name="text">
        <text class="wd-slide-verify__text-inner">
          {{ slideVerifyText }}
        </text>
      </slot>
    </view>
    <!-- 滑过区域，包含滑块 -->
    <view class="wd-slide-verify__track" :style="trackStyle">
      <view class="wd-slide-verify__track-text">
        <slot name="success-text">
          <text>{{ slideVerifySuccessText }}</text>
        </slot>
      </view>
      <!-- 滑块 -->
      <view class="wd-slide-verify__button" @touchstart.stop.prevent="onTouchStart" @touchmove.stop.prevent="onTouchMove" @touchend="onTouchEnd">
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
