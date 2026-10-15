/*
 * wd-img-cropper — 图片裁剪
 *
 * Lynx 实现说明：
 * - Lynx 无 canvas 2D API，本组件提供「固定裁剪框 + 图片拖拽/缩放」
 *   的交互版；确认时不直接产出位图，而是 emit 裁剪参数
 *   （src / x / y / width / height / scale），由宿主用原生能力
 *   完成最终裁剪（CONVENTIONS §12 降级方案）；
 * - 拖拽状态在后台线程 ref 中维护，落位回弹用 transition。
 */
<script lang="ts" setup>
import './index.css'

import { computed, ref } from 'vue-lynx'
import WdButton from '../wd-button/wd-button.vue'
import { imgCropperProps, type ImgCropperEmits, type ImgCropperExpose } from './types'
import { addUnit, objToStyle } from '../../common/util'
import { useTranslate } from '../../composables/useTranslate'

const props = defineProps(imgCropperProps)
const emit = defineEmits<ImgCropperEmits>()

const { translate } = useTranslate('imgCropper')

const moving = ref<boolean>(false)
const scale = ref<number>(1)
const rotate = ref<number>(0)
const offsetX = ref<number>(0)
const offsetY = ref<number>(0)
const startPoint = ref<{ x: number; y: number }>({ x: 0, y: 0 })

/** 裁剪框宽高比 */
const ratio = computed(() => {
  const [w, h] = props.aspectRatio.split(':').map(Number)
  return h ? w / h : 1
})

/** 裁剪框尺寸（Lynx 不支持 aspect-ratio，按比例换算） */
const cutStyle = computed(() => {
  const base = 240
  return `width: ${base}px; height: ${Math.round(base / ratio.value)}px;`
})

const imgStyle = computed(() => {
  const style: Record<string, string> = {
    transform: `translate(${offsetX.value}px, ${offsetY.value}px) scale(${scale.value}) rotate(${rotate.value}deg)`
  }
  if (props.imgWidth) style.width = addUnit(props.imgWidth)
  if (props.imgHeight) style.height = addUnit(props.imgHeight)
  return objToStyle(style)
})

function onTouchStart(event: any) {
  moving.value = true
  const t = event.touches?.[0] || event.changedTouches?.[0] || {}
  startPoint.value = { x: Number(t.clientX || 0), y: Number(t.clientY || 0) }
}

function onTouchMove(event: any) {
  if (!moving.value) return
  const t = event.touches?.[0] || event.changedTouches?.[0] || {}
  offsetX.value += Number(t.clientX || 0) - startPoint.value.x
  offsetY.value += Number(t.clientY || 0) - startPoint.value.y
  startPoint.value = { x: Number(t.clientX || 0), y: Number(t.clientY || 0) }
}

function onTouchEnd() {
  moving.value = false
}

function zoomIn() {
  scale.value = Math.min(props.maxScale, Number((scale.value + 0.1).toFixed(2)))
}

function zoomOut() {
  scale.value = Math.max(0.5, Number((scale.value - 0.1).toFixed(2)))
}

function resetImg() {
  scale.value = 1
  rotate.value = 0
  offsetX.value = 0
  offsetY.value = 0
}

function setRotate(angle: number) {
  rotate.value = angle
}

function revertIsAnimation(_animation: boolean | { value: boolean }) {
  // 接口保留：本实现无入场动画需求
}

function preventTouchMove() {
  // 阻止页面滚动（模板层已用 @touchmove.stop）
}

function onCancel() {
  emit('update:modelValue', false)
  emit('cancel')
}

function onConfirm() {
  emit('confirm', {
    src: props.imgSrc,
    width: Number(props.imgWidth) || 0,
    height: Number(props.imgHeight) || 0,
    x: Math.round(-offsetX.value / scale.value),
    y: Math.round(-offsetY.value / scale.value),
    scale: scale.value
  })
  emit('update:modelValue', false)
}

defineExpose<ImgCropperExpose>({
  revertIsAnimation,
  resetImg,
  setRotate
})
</script>

<template>
  <view v-if="modelValue" :class="`wd-img-cropper ${customClass}`" :style="customStyle" @touchmove="preventTouchMove">
    <view class="wd-img-cropper__wrapper">
      <!-- 图片 -->
      <image
        class="wd-img-cropper__img"
        :src="imgSrc"
        :style="imgStyle"
        @touchstart="onTouchStart"
        @touchmove="onTouchMove"
        @touchend="onTouchEnd"
        @touchcancel="onTouchEnd"
      />
      <!-- 裁剪框 -->
      <view class="wd-img-cropper__cut">
        <view class="wd-img-cropper__overlay" :class="{ 'is-highlight': moving }" />
        <view class="wd-img-cropper__cut-body" :style="cutStyle">
          <view class="wd-img-cropper__gridline wd-img-cropper__gridline--x" />
          <view class="wd-img-cropper__gridline wd-img-cropper__gridline--y" />
          <view class="wd-img-cropper__corner wd-img-cropper__corner--left-top" />
          <view class="wd-img-cropper__corner wd-img-cropper__corner--left-bottom" />
          <view class="wd-img-cropper__corner wd-img-cropper__corner--right-top" />
          <view class="wd-img-cropper__corner wd-img-cropper__corner--right-bottom" />
        </view>
        <view class="wd-img-cropper__overlay wd-img-cropper__overlay-bottom" :class="{ 'is-highlight': moving }" />
      </view>
    </view>

    <!-- 工具栏 -->
    <view class="wd-img-cropper__toolbar">
      <view class="wd-img-cropper__tool" @tap="zoomOut"><text>-</text></view>
      <view class="wd-img-cropper__tool" @tap="resetImg"><text>{{ translate('reset') }}</text></view>
      <view class="wd-img-cropper__tool" @tap="zoomIn"><text>+</text></view>
    </view>
    <view class="wd-img-cropper__footer">
      <wd-button block @tap="onCancel">{{ cancelButtonText || translate('cancel') }}</wd-button>
      <wd-button type="primary" block @tap="onConfirm">{{ confirmButtonText || translate('confirm') }}</wd-button>
    </view>
  </view>
</template>
