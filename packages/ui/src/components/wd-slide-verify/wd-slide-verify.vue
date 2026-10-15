/*
 * wd-slide-verify — 滑动验证
 *
 * Lynx 实现说明：
 * - 滑块位移在后台线程 ref 中维护（touchstart/move/end），
 *   落位用 transform + transition 回弹（不用 MTS，CONVENTIONS §10）；
 * - 轨道宽度挂载后一次性度量并缓存，touchmove 热路径只读缓存
 *   （CONVENTIONS §16）；
 * - 容错像素 tolerance 内视为通过。
 */
<script lang="ts" setup>
import './index.css'

import { computed, getCurrentInstance, onMounted, ref } from 'vue-lynx'
import WdIcon from '../wd-icon/wd-icon.vue'
import { slideVerifyProps, type SlideVerifyEmits } from './types'
import { useTouch } from '../../composables/useTouch'
import { useTranslate } from '../../composables/useTranslate'
import { getRect, objToStyle, uuid } from '../../common/util'

const props = defineProps(slideVerifyProps)
const emit = defineEmits<SlideVerifyEmits>()

const slideVerifyId = ref<string>(`wd-slide-verify-${uuid()}`)
const { proxy } = getCurrentInstance() as any
const touch = useTouch()
const { translate } = useTranslate('slideVerify')

const isPass = computed(() => props.modelValue)
const isDragging = ref<boolean>(false)
const distanceX = ref<number>(0)
const containerWidth = ref<number>(0)
const buttonWidth = ref<number>(44)

const slideVerifyText = computed(() => {
  return props.text || translate('text')
})

const slideVerifySuccessText = computed(() => {
  return props.successText || translate('successText')
})

const rootClass = computed(() => {
  const classes = ['wd-slide-verify']
  if (isPass.value) classes.push('is-pass')
  if (props.disabled) classes.push('is-disabled')
  if (props.customClass) classes.push(props.customClass)
  return classes.join(' ')
})

const rootStyle = computed(() => {
  const style: Record<string, string> = {}
  if (props.backgroundColor) style['background-color'] = props.backgroundColor
  if (isPass.value && props.activeBackgroundColor) style['background-color'] = props.activeBackgroundColor
  return objToStyle(style) + (props.customStyle || '')
})

const trackStyle = computed(() => {
  const style: Record<string, string> = {}
  if (isPass.value) {
    style.width = '100%'
  } else {
    style.width = `${buttonWidth.value + distanceX.value}px`
  }
  if (isDragging.value) {
    style.transition = 'none'
  }
  return objToStyle(style)
})

onMounted(() => {
  // 轨道宽度一次性度量（CONVENTIONS §16）
  getRect(`#${slideVerifyId.value}`, false, proxy).then((data) => {
    containerWidth.value = Number(data.width) || 0
  })
  getRect('.wd-slide-verify__button', false, proxy).then((data) => {
    buttonWidth.value = Number(data.width) || 44
  })
})

const maxDistance = computed(() => Math.max(0, containerWidth.value - buttonWidth.value))

function onTouchStart(event: any) {
  if (props.disabled || isPass.value) return
  isDragging.value = true
  touch.touchStart(event)
}

function onTouchMove(event: any) {
  if (!isDragging.value) return
  touch.touchMove(event)
  const delta = touch.deltaX.value
  const next = Math.min(Math.max(delta, 0), maxDistance.value)
  distanceX.value = next
  emit('move', { distanceX: next, containerWidth: containerWidth.value })
}

function onTouchEnd() {
  if (!isDragging.value) return
  isDragging.value = false
  const tolerance = Number(props.tolerance)
  const passed = maxDistance.value - distanceX.value <= tolerance

  if (passed) {
    distanceX.value = maxDistance.value
    emit('update:modelValue', true)
    emit('change', { value: true })
    emit('success', { value: true })
  } else {
    // 回弹
    distanceX.value = 0
    emit('change', { value: false })
    emit('fail', { value: false })
  }
}
</script>

<template>
  <view :id="slideVerifyId" :class="rootClass" :style="rootStyle">
    <!-- 背景提示文字 -->
    <view class="wd-slide-verify__text">
      <slot name="text">
        <text class="wd-slide-verify__text-inner">{{ slideVerifyText }}</text>
      </slot>
    </view>
    <!-- 滑过区域 -->
    <view class="wd-slide-verify__track" :style="trackStyle">
      <view class="wd-slide-verify__track-text">
        <slot name="success-text">{{ slideVerifySuccessText }}</slot>
      </view>
      <!-- 滑块 -->
      <view
        class="wd-slide-verify__button"
        @touchstart="onTouchStart"
        @touchmove="onTouchMove"
        @touchend="onTouchEnd"
        @touchcancel="onTouchEnd"
      >
        <slot v-if="isPass" name="success-icon">
          <wd-icon
            custom-class="wd-slide-verify__button-icon wd-slide-verify__button-icon--success"
            :name="successIcon"
            :size="successIconSize"
            :class-prefix="iconPrefix"
            :css-icon="cssIcon"
          />
        </slot>
        <slot v-else name="icon">
          <wd-icon
            custom-class="wd-slide-verify__button-icon"
            :name="icon"
            :size="iconSize"
            :class-prefix="iconPrefix"
            :css-icon="cssIcon"
          />
        </slot>
      </view>
    </view>
  </view>
</template>
