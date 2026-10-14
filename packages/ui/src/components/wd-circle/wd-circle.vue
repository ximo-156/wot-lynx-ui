/*
 * wd-circle — 环形进度条
 *
 * Lynx 适配说明：
 * - wot-ui 原实现依赖 canvas 元素与 uni.createCanvasContext（Canvas 2D API）绘制圆环，
 *   Lynx 无 canvas 元素与 Canvas 2D API，也没有 uni 全局对象，
 *   改为通过 Lynx 原生 svg 元素的 content 属性承载完整 SVG 标记渲染（与 wd-icon 同一范式）：
 *   轨道与进度各用一个 circle 元素，进度通过 stroke-dasharray / stroke-dashoffset 表现；
 *   渐变色（color 传对象时）降级为首个色标的纯色：Lynx 引擎的 SVG content 解析器
 *   不支持 linearGradient / stop / defs 元素，真机上 PaintingContext.insertNode 会抛
 *   "unknown child signature" 致命异常（错误码 9902），故 SVG 内只输出纯色 stroke，
 *   API 保持兼容（传入颜色对象不报错，仅视觉上无渐变）；
 *   顺时针/逆时针通过进度 circle 的 transform 控制起点（12 点方向）与展开方向，
 *   逆时针时为关于竖直中心线的镜像。
 * - 线宽、半径、0 值圆点等几何参数与 wot-ui canvas 实现保持一致：
 *   进度线宽恒为 strokeWidth/2；fill 存在时轨道线宽为 strokeWidth 并填充内圆，
 *   否则轨道线宽为 strokeWidth/2；进度为 0 时在 12 点方向渲染一个直径与线宽一致的圆点。
 * - 中央文字沿用 wot-ui 的 wd-circle__text 结构（默认插槽或 text prop），
 *   绝对定位覆盖在 svg 之上，类名与 wot-ui index.scss 完全一致。
 * - 进度动画沿用 wot-ui 的定时器步进逻辑（speed 单位为 rate/s），驱动 currentValue 响应式更新，
 *   SVG 内容随之重算，无需手动重绘。
 */
<script setup lang="ts">
import './index.css'

import { computed, onUnmounted, ref, watch } from 'vue-lynx'
import { addUnit, isObj, objToStyle, sanitizeSvgContent, styleToObject, type CSSProperties } from '../../common/util'
import { circleProps } from './types'

/** 步进值 */
const STEP = 1

/** color 默认值，与 types.ts 中保持一致（渐变色对象无有效色标时的兜底） */
const DEFAULT_COLOR = '#3482FF'

/** 大于等于0且小于等于100 */
function format(rate: number) {
  return Math.min(Math.max(rate, 0), 100)
}

const props = defineProps(circleProps)

/** 当前值（动画过程中实时变化），初始即为目标值，与 wot-ui 挂载后的表现一致 */
const currentValue = ref<number>(props.modelValue)
/** 定时器 */
const interval = ref<any>(null)

/**
 * 进度条绘制颜色：渐变色（对象）时退化为首个色标的纯色。
 * Lynx 引擎的 SVG content 解析器不支持 linearGradient / stop / defs 元素，
 * 真机上会抛 PaintingContext.insertNode "unknown child signature" 致命异常，
 * 因此这里只输出纯色 stroke（API 兼容，视觉降级）。
 */
const progressStroke = computed(() => {
  const color = props.color
  if (!isObj(color)) return color as string
  const stops = Object.keys(color).sort((a, b) => parseFloat(a) - parseFloat(b))
  return stops.length > 0 ? color[stops[0]] : DEFAULT_COLOR
})

/** 轨道线宽：wot-ui 中 fill 存在时为 strokeWidth，否则为 strokeWidth/2 */
const trackStrokeWidth = computed(() => (props.fill ? props.strokeWidth : props.strokeWidth / 2))

/** 轨道中线半径 */
const trackRadius = computed(() => props.size / 2 - trackStrokeWidth.value / 2)

/** 进度线宽：wot-ui 中恒为 strokeWidth/2 */
const progressStrokeWidth = computed(() => props.strokeWidth / 2)

/** 进度中线半径 */
const progressRadius = computed(() => props.size / 2 - props.strokeWidth / 4)

/** 根节点样式 */
const rootStyle = computed(() => {
  const style: CSSProperties = {
    color: isObj(props.color) ? 'var(--wot-text-main)' : props.color
  }

  return `${objToStyle(style)};${props.customStyle}`
})

/** svg 元素尺寸 */
const svgStyle = computed(() => ({
  width: addUnit(props.size),
  height: addUnit(props.size)
}))

/** 环形进度条的 SVG 标记 */
const svgContent = computed(() => {
  const size = props.size
  const half = size / 2
  const linecap = props.strokeLinecap
  const parts: string[] = []

  // 填充内圆（fill 存在时），与 wot-ui 的 fill() 行为一致
  if (props.fill) {
    parts.push(`<circle cx="${half}" cy="${half}" r="${trackRadius.value}" fill="${props.fill}"/>`)
  }

  // 轨道
  parts.push(
    `<circle cx="${half}" cy="${half}" r="${trackRadius.value}" fill="none" stroke="${props.layerColor}" stroke-width="${trackStrokeWidth.value}" stroke-linecap="${linecap}"/>`
  )

  const formatValue = format(currentValue.value)
  if (formatValue === 0) {
    // 进度为 0 时渲染一个圆点：位于 12 点方向、直径与线宽一致，与 wot-ui renderDot 一致
    const dotRadius = props.strokeWidth / 4
    parts.push(`<circle cx="${half}" cy="${dotRadius}" r="${dotRadius}" fill="${progressStroke.value}"/>`)
  } else {
    const circumference = 2 * Math.PI * progressRadius.value
    const dashoffset = circumference * (1 - formatValue / 100)
    // 进度起点为 12 点方向；逆时针时关于竖直中心线镜像，使弧线逆时针展开
    const transform = props.clockwise ? `rotate(-90 ${half} ${half})` : `translate(${size} 0) scale(-1 1) rotate(-90 ${half} ${half})`
    parts.push(
      `<circle cx="${half}" cy="${half}" r="${progressRadius.value}" fill="none" stroke="${progressStroke.value}" stroke-width="${progressStrokeWidth.value}" stroke-linecap="${linecap}" stroke-dasharray="${circumference}" stroke-dashoffset="${dashoffset}" transform="${transform}"/>`
    )
  }

  return sanitizeSvgContent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}">${parts.join('')}</svg>`)
})

// 监听目标数值变化
watch(() => props.modelValue, () => {
  reRender()
})

// 组件卸载时清除定时器
onUnmounted(() => {
  clearTimeInterval()
})

/**
 * Circle组件渲染
 * 当前进度值变化时重新渲染Circle组件
 */
function reRender() {
  // 动画通过定时器渲染
  if (props.speed <= 0 || props.speed > 1000) {
    currentValue.value = props.modelValue
    return
  }
  clearTimeInterval()
  const run = () => {
    interval.value = setTimeout(() => {
      if (currentValue.value !== props.modelValue) {
        if (Math.abs(currentValue.value - props.modelValue) < STEP) {
          currentValue.value = props.modelValue
        } else if (currentValue.value < props.modelValue) {
          currentValue.value += STEP
        } else {
          currentValue.value -= STEP
        }
        run()
      } else {
        clearTimeInterval()
      }
    }, 1000 / props.speed)
  }
  run()
}

/**
 * 清除定时器
 */
function clearTimeInterval() {
  interval.value && clearTimeout(interval.value)
}
</script>

<template>
  <view :class="`wd-circle ${customClass}`" :style="styleToObject(rootStyle)">
    <svg class="wd-circle__svg" :style="styleToObject(svgStyle)" :content="svgContent" />

    <view v-if="!text" class="wd-circle__text">
      <!-- 自定义提示内容 -->
      <slot></slot>
    </view>

    <text v-else class="wd-circle__text">
      <text>{{ text }}</text>
    </text>
  </view>
</template>
