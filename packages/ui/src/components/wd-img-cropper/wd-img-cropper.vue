/*
 * wd-img-cropper — 图片裁剪
 *
 * Lynx 实现说明：
 * - Lynx 无 canvas 2D API，本组件提供「固定裁剪框 + 图片拖拽/缩放」
 *   的交互版；确认时不直接产出位图，而是 emit 裁剪参数
 *   （src / x / y / width / height / scale），由宿主用原生能力
 *   完成最终裁剪（CONVENTIONS §12 降级方案）；
 * - 图片渲染尺寸经 getRect 一次性度量（挂载后 + image load 事件），
 *   写回 imgWidth/imgHeight，confirm 的 width/height 因此有可用值；
 *   x/y 按实际渲染尺寸与裁剪框居中位置换算（缩放以元素中心为原点）；
 * - 拖拽带边界钳制：图片显示区域始终覆盖裁剪框，内容不会被拖出；
 * - 拖拽状态在后台线程 ref 中维护，落位回弹用 transition；
 * - disabledRotate 未实现：本降级版无旋转 UI（旋转能力经 expose 的
 *   setRotate 以编程方式提供），该 prop 已从 types 删除。
 */
<script lang="ts" setup>
import './index.css'

import { computed, getCurrentInstance, onMounted, ref, watch } from 'vue-lynx'
import WdButton from '../wd-button/wd-button.vue'
import { imgCropperProps, type ImgCropperEmits, type ImgCropperExpose } from './types'
import { addUnit, getRect, isDef, parseStyle, filterStyle } from '../../common/util'
import { useTranslate } from '../../composables/useTranslate'
import { useAlive } from '../../composables/useAlive'

const props = defineProps(imgCropperProps)
const emit = defineEmits<ImgCropperEmits>()

const { translate } = useTranslate('imgCropper')
const isAlive = useAlive()
const { proxy } = getCurrentInstance() as any

const moving = ref<boolean>(false)
const scale = ref<number>(1)
const rotate = ref<number>(0)
const offsetX = ref<number>(0)
const offsetY = ref<number>(0)
const startPoint = ref<{ x: number; y: number }>({ x: 0, y: 0 })

/** 图片宽高：优先 props，未指定时由度量结果写回 */
const imgWidth = ref<number | string>(isSpecified(props.imgWidth) ? props.imgWidth : '')
const imgHeight = ref<number | string>(isSpecified(props.imgHeight) ? props.imgHeight : '')

/** 度量结果：图片渲染尺寸与容器尺寸（confirm 换算与边界钳制共用） */
const measured = ref({ width: 0, height: 0 })
const wrapperSize = ref({ width: 0, height: 0 })

/**
 * props 是否显式指定了尺寸。
 * imgWidth/imgHeight 的默认值是 ''（makeNumericProp('')），空串与
 * undefined/null 一律按"未指定"处理——未指定时才允许度量结果写回。
 */
function isSpecified(value: unknown): boolean {
  return value !== '' && isDef(value)
}

watch(
  () => [props.imgWidth, props.imgHeight],
  ([width, height]) => {
    if (isSpecified(width)) imgWidth.value = width as number | string
    if (isSpecified(height)) imgHeight.value = height as number | string
  }
)

/** 裁剪框宽高比 */
const ratio = computed(() => {
  const [w, h] = props.aspectRatio.split(':').map(Number)
  return h ? w / h : 1
})

/** 裁剪框尺寸（Lynx 不支持 aspect-ratio，按比例换算） */
const CUT_BASE = 240
const cutSize = computed(() => {
  return { width: CUT_BASE, height: Math.round(CUT_BASE / ratio.value) }
})

const cutStyle = computed(() => {
  return { width: `${cutSize.value.width}px`, height: `${cutSize.value.height}px` }
})

const imgStyle = computed(() => {
  const style: Record<string, string> = {
    transform: `translate(${offsetX.value}px, ${offsetY.value}px) scale(${scale.value}) rotate(${rotate.value}deg)`
  }
  if (imgWidth.value !== '') style.width = addUnit(imgWidth.value)
  if (imgHeight.value !== '') style.height = addUnit(imgHeight.value)
  return filterStyle(style)
})

/**
 * 度量图片渲染尺寸与容器尺寸（挂载后 / 图片加载完成时调用）。
 * getRect 为异步跨线程查询，仅在此两处调用，不在 touchmove 热路径重复
 * （CONVENTIONS §16）；回调晚于卸载落地时丢弃（useAlive 守卫）。
 */
async function measureImage() {
  const [imgRect, wrapperRect] = await Promise.all([
    getRect('.wd-img-cropper__img', false, proxy),
    getRect('.wd-img-cropper__wrapper', false, proxy)
  ])
  if (!isAlive()) return
  const width = Number(imgRect && imgRect.width) || 0
  const height = Number(imgRect && imgRect.height) || 0
  const containerWidth = Number(wrapperRect && wrapperRect.width) || 0
  const containerHeight = Number(wrapperRect && wrapperRect.height) || 0
  if (width > 0 || height > 0) measured.value = { width, height }
  if (containerWidth > 0 || containerHeight > 0) wrapperSize.value = { width: containerWidth, height: containerHeight }
  // 用户未显式指定尺寸时，把度量结果写回（confirm 的 width/height 有可用值）
  if (!isSpecified(props.imgWidth) && width > 0) imgWidth.value = Math.round(width)
  if (!isSpecified(props.imgHeight) && height > 0) imgHeight.value = Math.round(height)
}

/** 图片元素中心点（flex 双向居中布局，缩放以元素中心为原点） */
function imageCenter() {
  const { width: rw, height: rh } = measured.value
  const { width: cw, height: ch } = wrapperSize.value
  const baseLeft = rw > 0 ? (cw - rw) / 2 : 0
  const baseTop = rh > 0 ? (ch - rh) / 2 : 0
  return { centerX: baseLeft + rw / 2, centerY: baseTop + rh / 2 }
}

/** 裁剪框在容器中的左上角（flex 居中） */
function cutLayout() {
  const { width: cw, height: ch } = wrapperSize.value
  return {
    left: cw > 0 ? (cw - cutSize.value.width) / 2 : 0,
    top: ch > 0 ? (ch - cutSize.value.height) / 2 : 0
  }
}

/**
 * 边界钳制：图片显示区域（渲染尺寸 × scale，以元素中心为缩放原点）
 * 始终覆盖裁剪框，内容不会被拖出裁剪区。
 */
function clampOffset() {
  const { width: rw, height: rh } = measured.value
  if (rw <= 0 || rh <= 0) return
  const { centerX, centerY } = imageCenter()
  const cut = cutLayout()
  const dispW = rw * scale.value
  const dispH = rh * scale.value
  const minX = cut.left - centerX + dispW / 2
  const maxX = cut.left + cutSize.value.width - centerX - dispW / 2
  const minY = cut.top - centerY + dispH / 2
  const maxY = cut.top + cutSize.value.height - centerY - dispH / 2
  offsetX.value = minX > maxX ? cut.left + cutSize.value.width / 2 - centerX : Math.min(Math.max(offsetX.value, minX), maxX)
  offsetY.value = minY > maxY ? cut.top + cutSize.value.height / 2 - centerY : Math.min(Math.max(offsetY.value, minY), maxY)
}

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
  // 边界钳制（读缓存的度量值，不在热路径查询节点）
  clampOffset()
}

function onTouchEnd() {
  moving.value = false
}

function zoomIn() {
  scale.value = Math.min(props.maxScale, Number((scale.value + 0.1).toFixed(2)))
  clampOffset()
}

function zoomOut() {
  scale.value = Math.max(0.5, Number((scale.value - 0.1).toFixed(2)))
  clampOffset()
}

function resetImg() {
  scale.value = 1
  rotate.value = 0
  offsetX.value = 0
  offsetY.value = 0
  clampOffset()
}

function setRotate(angle: number) {
  rotate.value = angle
}

function revertIsAnimation(_animation: boolean | { value: boolean }) {
  // 接口保留：本实现无入场动画需求
}

function preventTouchMove(event: any) {
  // 阻止页面滚动（模板层 @touchmove.stop 承担）；按 CONVENTIONS §14 转发
  // 同名原生事件，避免消费方监听穿透后与根绑定合并成数组。
  emit('touchmove', event)
}

function onCancel() {
  emit('update:modelValue', false)
  emit('cancel')
}

function onConfirm() {
  const s = scale.value || 1
  const { width: rw, height: rh } = measured.value
  const { centerX, centerY } = imageCenter()
  const cut = cutLayout()
  // 裁剪区左上角换算到图片元素坐标系（缩放以元素中心为原点）：
  // p_img = center + (p_cut - offset - center) / scale
  let x = centerX + (cut.left - centerX - offsetX.value) / s
  let y = centerY + (cut.top - centerY - offsetY.value) / s
  let width = cutSize.value.width / s
  let height = cutSize.value.height / s
  if (rw > 0 && rh > 0) {
    // 钳制到图片范围内，保证 x/y/width/height 均可用
    x = Math.min(Math.max(x, 0), Math.max(rw - width, 0))
    y = Math.min(Math.max(y, 0), Math.max(rh - height, 0))
    width = Math.min(width, rw - x)
    height = Math.min(height, rh - y)
  } else {
    // 度量不可用（如宿主无 SelectorQuery）：回退 props 尺寸或裁剪框尺寸
    width = Number(imgWidth.value) || cutSize.value.width
    height = Number(imgHeight.value) || cutSize.value.height
    x = Math.max(x, 0)
    y = Math.max(y, 0)
  }
  emit('confirm', {
    src: props.imgSrc,
    width: Math.round(width),
    height: Math.round(height),
    x: Math.round(x),
    y: Math.round(y),
    scale: s
  })
  emit('update:modelValue', false)
}

onMounted(() => {
  measureImage()
})

defineExpose<ImgCropperExpose>({
  revertIsAnimation,
  resetImg,
  setRotate
})
</script>

<template>
  <view v-if="modelValue" :class="`wd-img-cropper ${customClass}`" :style="parseStyle(customStyle)" @touchmove.stop="preventTouchMove">
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
        @load="measureImage"
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
