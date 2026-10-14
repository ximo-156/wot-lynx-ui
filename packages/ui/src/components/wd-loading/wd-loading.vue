/*
 * wd-loading — 加载指示器
 *
 * Lynx 适配说明：
 * - circular 类型原实现依赖 conic-gradient + mask，Lynx 不支持 conic-gradient，
 *   改为原生 svg 元素绘制圆弧（旋转动画由 CSS keyframes 驱动，主线程渲染）。
 * - spinner/dots/wave 原实现依赖 :nth-of-type() 与 ::before，Lynx 均不支持，
 *   改为 v-for 渲染真实节点 + JS 计算内联样式。
 */
<script setup lang="ts">
import './index.css'

import { computed } from 'vue-lynx'
import { styleToObject, objToStyle, addUnit, isDef, sanitizeSvgContent, type CSSProperties } from '../../common/util'
import { loadingProps } from './types'

const props = defineProps(loadingProps)

/** 默认主色，对应主题变量 --wot-primary-6（Xiaomi Blue） */
const DEFAULT_COLOR = '#3482FF'
/** 默认尺寸（px），对应主题变量 --wot-loading-size */
const DEFAULT_SIZE = 28

// 长度为 12 的数组
const dots = Array.from({ length: 12 }, (_, i) => i)

const resolvedColor = computed(() => {
  if (isDef(props.color)) return props.color
  if (props.inheritColor) return 'inherit'
  return DEFAULT_COLOR
})

/** 解析出的实际尺寸（px）：svg 子元素必须显式定尺，Lynx 的 svg 不解析 em 单位 */
const resolvedSize = computed(() => {
  return isDef(props.size) ? addUnit(props.size) : `${DEFAULT_SIZE}px`
})

/** circular 类型的 SVG 圆弧（颜色显式解析：SVG content 不继承 CSS currentColor） */
const circularSvg = computed(() => {
  // inheritColor 时无法跨原生边界继承文字色，退化为显式主色；
  // wd-button 等容器会显式下发 color（见 customLoadingProps）。
  const color = isDef(props.color) ? props.color : DEFAULT_COLOR
  return sanitizeSvgContent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 42 42">` +
      `<path d="M21 3.5 A17.5 17.5 0 1 1 3.5 21" fill="none" stroke="${color}" stroke-width="4" stroke-linecap="round"/>` +
      `</svg>`
  )
})

const rootStyle = computed(() => {
  const style: CSSProperties = {}
  if (isDef(props.color)) {
    style.color = props.color
  }
  if (props.inheritColor) {
    style.color = 'inherit'
  }
  return `${objToStyle(style)} ${props.customStyle}`
})

const spinnerStyle = computed(() => {
  const style: CSSProperties = {}
  if (isDef(props.size)) {
    style.height = addUnit(props.size)
    style.width = addUnit(props.size)
  } else {
    style.height = `${DEFAULT_SIZE}px`
    style.width = `${DEFAULT_SIZE}px`
  }
  return objToStyle(style)
})

/** svg 子元素显式尺寸（Lynx svg 不支持 em 相对单位） */
const circularStyle = computed(() => {
  return objToStyle({ width: resolvedSize.value, height: resolvedSize.value })
})

const spinnerClass = computed(() => {
  return `wd-loading__spinner wd-loading__spinner--${props.type} ${props.customSpinnerClass}`
})

function dotStyle(index: number) {
  const i = index + 1
  return objToStyle({
    transform: `rotate(${90 - i * 30}deg)`,
    opacity: 1 - (0.75 / 12) * (i - 1)
  })
}

function dotsDelayStyle(index: number) {
  return objToStyle({
    animationDelay: `calc(0.8s * ${index} / 3)`,
    animationDuration: '0.8s'
  })
}

function waveBarClass(index: number) {
  return `wd-loading__spinner-wave-bar wd-loading__spinner-wave-bar--${index + 1}`
}
</script>

<template>
  <view :class="`wd-loading wd-loading--${direction} ${customClass}`" :style="styleToObject(rootStyle)">
    <view :class="spinnerClass" :style="styleToObject(spinnerStyle)">
      <svg v-if="type === 'circular'" class="wd-loading__circular" :content="circularSvg" :style="styleToObject(circularStyle)" />
      <template v-else-if="type === 'spinner'">
        <view class="wd-loading__spinner-wraper">
          <view v-for="(dot, index) in dots" :key="index" class="wd-loading__spinner-dot" :style="styleToObject(dotStyle(index))">
            <view class="wd-loading__spinner-dot-bar" />
          </view>
        </view>
      </template>
      <template v-else-if="type === 'dots'">
        <!-- 类名与 wot-ui 对齐：dots 类型同样使用 wd-loading__spinner-dot
             （由 .wd-loading__spinner--dots 修饰符区分，样式见 index.scss）。 -->
        <view class="wd-loading__spinner-wraper">
          <view v-for="(dot, index) in 3" :key="index" class="wd-loading__spinner-dot" :style="styleToObject(dotsDelayStyle(index))" />
        </view>
      </template>
      <template v-else-if="type === 'wave'">
        <view class="wd-loading__spinner-wraper wd-loading__spinner-wraper--wave">
          <view v-for="(bar, index) in 4" :key="index" :class="waveBarClass(index)">
            <view class="wd-loading__spinner-wave-bar-inner" />
          </view>
        </view>
      </template>
    </view>
    <view class="wd-loading__text" v-if="$slots.default || text">
      <text class="wd-loading__text-inner"><slot>{{ text }}</slot></text>
    </view>
  </view>
</template>
