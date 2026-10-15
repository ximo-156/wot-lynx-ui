/*
 * wd-signature — 签名
 *
 * Lynx 实现说明：
 * - Lynx 无 canvas 2D API，签名用 SVG polyline 实现：每笔一条
 *   polyline（SVG 元素白名单内，CONVENTIONS §8）；
 * - 触摸轨迹在后台线程 ref 中累积，content 标记随笔画重建；
 * - 确认导出为标准 SVG data URI（不经过引擎 SVG 解析器，可安全
 *   携带完整属性）；
 * - 撤销 / 恢复用笔画栈 + redo 栈实现。
 */
<script lang="ts" setup>
import './index.css'

import { computed, getCurrentInstance, onMounted, ref } from 'vue-lynx'
import { signatureProps, type SignatureEmits, type SignatureExpose } from './types'
import { getRect, sanitizeSvgContent, uuid, filterStyle } from '../../common/util'
import { useTranslate } from '../../composables/useTranslate'

const props = defineProps(signatureProps)
const emit = defineEmits<SignatureEmits>()

const { translate } = useTranslate('signature')

const canvasId = ref<string>(`wd-signature-${uuid()}`)
const canvasWidth = ref<number>(300)
const canvasHeight = ref<number>(200)

/** 笔画栈：每笔为点数组 [x,y,x,y,...] */
const strokes = ref<number[][]>([])
const redoStack = ref<number[][]>([])
const currentStroke = ref<number[] | null>(null)

const isDrawing = ref<boolean>(false)
const canvasRect = ref<{ left: number; top: number }>({ left: 0, top: 0 })
const { proxy } = getCurrentInstance() as any

onMounted(() => {
  // 画布位置一次性度量，触摸坐标以此为基准（CONVENTIONS §16）
  getRect(`#${canvasId.value}`, false, proxy).then((data) => {
    canvasRect.value = { left: Number(data.left) || 0, top: Number(data.top) || 0 }
  })
})

const currentStep = computed(() => strokes.value.length)

const canvasStyle = computed(() => {
  const style: Record<string, string> = {}
  if (props.width) style.width = typeof props.width === 'number' ? `${props.width}px` : String(props.width)
  if (props.height) style.height = typeof props.height === 'number' ? `${props.height}px` : String(props.height)
  if (props.backgroundColor) style['background-color'] = props.backgroundColor
  return filterStyle(style)
})

/** SVG content：白名单元素（svg / rect / polyline） */
const svgContent = computed(() => {
  const bg = props.backgroundColor ? `<rect width="${canvasWidth.value}" height="${canvasHeight.value}" fill="${props.backgroundColor}"/>` : ''
  const lines = [...strokes.value, ...(currentStroke.value && currentStroke.value.length >= 4 ? [currentStroke.value] : [])]
    .map((points) => `<polyline points="${points.join(' ')}" fill="none" stroke="${props.penColor}" stroke-width="${props.lineWidth}" stroke-linecap="round" stroke-linejoin="round"/>`)
    .join('')
  return sanitizeSvgContent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${canvasWidth.value} ${canvasHeight.value}" width="${canvasWidth.value}" height="${canvasHeight.value}">${bg}${lines}</svg>`
  )
})

function startDrawing(event: any) {
  if (props.disabled) return
  isDrawing.value = true
  const { x, y } = getPoint(event)
  currentStroke.value = [x, y]
  redoStack.value = []
}

function draw(event: any) {
  if (!isDrawing.value || !currentStroke.value) return
  const { x, y } = getPoint(event)
  currentStroke.value.push(x, y)
}

function stopDrawing() {
  if (!isDrawing.value || !currentStroke.value) return
  isDrawing.value = false
  if (currentStroke.value.length >= 4) {
    strokes.value = [...strokes.value, currentStroke.value]
  }
  currentStroke.value = null
}

/** 触点坐标换算为画布坐标（事件坐标相对页面，需减去画布偏移） */
function getPoint(event: any): { x: number; y: number } {
  const clientX = Number(event.touches?.[0]?.clientX ?? event.changedTouches?.[0]?.clientX ?? 0)
  const clientY = Number(event.touches?.[0]?.clientY ?? event.changedTouches?.[0]?.clientY ?? 0)
  return {
    x: Math.round(clientX - canvasRect.value.left),
    y: Math.round(clientY - canvasRect.value.top)
  }
}

function clear() {
  strokes.value = []
  redoStack.value = []
  currentStroke.value = null
  emit('clear')
}

function revoke() {
  const last = strokes.value.pop()
  if (last) {
    redoStack.value = [...redoStack.value, last]
  }
}

function restore() {
  const stroke = redoStack.value.pop()
  if (stroke) {
    strokes.value = [...strokes.value, stroke]
  }
}

/** 确认：导出标准 SVG data URI */
function confirm() {
  const bg = props.backgroundColor ? `<rect width="${canvasWidth.value}" height="${canvasHeight.value}" fill="${props.backgroundColor}"/>` : ''
  const lines = strokes.value
    .map((points) => `<polyline points="${points.join(' ')}" fill="none" stroke="${props.penColor}" stroke-width="${props.lineWidth}" stroke-linecap="round" stroke-linejoin="round"/>`)
    .join('')
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${canvasWidth.value} ${canvasHeight.value}" width="${canvasWidth.value * props.exportScale}" height="${canvasHeight.value * props.exportScale}">${bg}${lines}</svg>`
  const image = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
  emit('confirm', {
    image,
    canvas: null,
    width: canvasWidth.value,
    height: canvasHeight.value
  })
}

defineExpose<SignatureExpose>({
  clear,
  confirm,
  revoke,
  restore
})
</script>

<template>
  <view class="wd-signature">
    <view class="wd-signature__content">
      <view class="wd-signature__content-canvas" :style="canvasStyle">
        <svg :content="svgContent" />
      </view>
      <!-- 触摸层 -->
      <view
        class="wd-signature__touch"
        @touchstart="startDrawing"
        @touchmove="draw"
        @touchend="stopDrawing"
        @touchcancel="stopDrawing"
      />
    </view>
    <view class="wd-signature__footer">
      <slot name="footer" :clear="clear" :confirm="confirm" :current-step="currentStep" :revoke="revoke" :restore="restore">
        <view class="wd-signature__footer-button" @tap="revoke">
          <text>{{ revokeText || translate('revoke') }}</text>
        </view>
        <view class="wd-signature__footer-button" @tap="restore">
          <text>{{ restoreText || translate('restore') }}</text>
        </view>
        <view class="wd-signature__footer-button" @tap="clear">
          <text>{{ clearText || translate('clear') }}</text>
        </view>
        <view class="wd-signature__footer-button wd-signature__footer-button--confirm" @tap="confirm">
          <text>{{ confirmText || translate('confirm') }}</text>
        </view>
      </slot>
    </view>
  </view>
</template>
