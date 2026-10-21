/*
 * wd-loading — 官方节奏、尺寸与原生图形。
 * circular 把官方 90°–330° 淡入、330°–360° 实色环拆成 90 个 3° 扇段，
 * 不依赖不受支持的 conic-gradient/mask/linearGradient。SVG 版本为分段近似；
 * inheritColor 使用原生 currentColor 小段，任意父级颜色可真实继承，不猜主题色。
 * wave 以居中 scaleY 代替 height 动画：高度比例/时序一致，圆角会一起缩放。
 */
<script lang="ts" setup>
import './index.css'
import { computed } from 'vue-lynx'
import { loadingProps } from './types'
import { addUnit, isDef, parseStyle, sanitizeSvgContent } from '../../common/util'
import { defineStyleKeys, resolveStyle } from '../../common/style'
import { useGlobalConfig } from '../../composables/useGlobalConfig'
import { PRIMARY_COLOR, SECONDARY_COLOR } from '../../common/theme'

const props = defineProps(loadingProps)
const globalConfig = useGlobalConfig()
const dots = Array.from({ length: 12 }, (_, i) => i)
const ROOT_STYLE = defineStyleKeys({ color: '' })
const rootStyle = computed(() => resolveStyle(ROOT_STYLE,
  { color: props.inheritColor ? 'inherit' : props.color }, parseStyle(props.customStyle)))
const SPINNER_STYLE = defineStyleKeys({ width: '', height: '' })
const spinnerStyle = computed(() => resolveStyle(SPINNER_STYLE, {
  height: isDef(props.size) ? addUnit(props.size) : '', width: isDef(props.size) ? addUnit(props.size) : ''
}))
const circularColor = computed(() => parseStyle(props.customStyle).color || props.color ||
  globalConfig.value.themeVars.loadingColorMain || globalConfig.value.themeVars.primary6 ||
  (globalConfig.value.theme === 'dark' ? SECONDARY_COLOR : PRIMARY_COLOR))
/** radial closest-side 的 15% 是半径的 15%，不是直径的 15%。 */
const ringThickness = computed(() => {
  const token = globalConfig.value.themeVars.loadingSpinnerCircleStrokeWidth || '15%'
  const value = parseFloat(token)
  return Math.min(50, Math.max(0, Number.isFinite(value) ? (token.endsWith('%') ? value / 2 : value) : 7.5))
})
const circularSegments = computed(() => Array.from({ length: 90 }, (_, index) => {
  const start = 90 + index * 3
  return { start, end: start + 3, opacity: Math.min(1, (start + 1.5 - 90) / 240) }
}))
function polar(radius: number, angle: number) {
  const radians = (angle - 90) * Math.PI / 180
  return [50 + radius * Math.cos(radians), 50 + radius * Math.sin(radians)]
}
const circularSvg = computed(() => {
  const inner = 50 - ringThickness.value
  const paths = circularSegments.value.map(({ start, end, opacity }) => {
    const a = polar(50, start), b = polar(50, end), c = polar(inner, end), d = polar(inner, start)
    return `<path d="M${a.join(' ')}A50 50 0 0 1 ${b.join(' ')}L${c.join(' ')}A${inner} ${inner} 0 0 0 ${d.join(' ')}Z" opacity="${opacity.toFixed(4)}"/>`
  }).join('')
  return sanitizeSvgContent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><g fill="${circularColor.value}">${paths}</g></svg>`)
})
const inheritedSegments = computed(() => {
  const thickness = ringThickness.value
  const radius = 50 - thickness / 2
  const length = radius * Math.PI / 60 + 0.15
  return circularSegments.value.map(({ start, opacity }) => {
    const [x, y] = polar(radius, start + 1.5)
    return { left: `${x - thickness / 2}%`, top: `${y - length / 2}%`,
      width: `${thickness}%`, height: `${length}%`, transform: `rotate(${start + 1.5 - 90}deg)`, opacity: `${opacity}` }
  })
})
function spinnerDotStyle(index: number): Record<string, string> {
  return { transform: `rotate(${60 - index * 30}deg)`, opacity: (1 - (0.75 / 12) * index).toFixed(4) }
}
function dotDelayStyle(index: number): Record<string, string> {
  const duration = 'var(--wot-loading-spinner-animation-duration, 0.8s)'
  return { 'animation-delay': `calc(${duration} * ${index - 1} / 3)`, 'animation-duration': duration }
}
function waveBarStyle(index: number): Record<string, string> {
  return { 'margin-left': index > 1 ? 'var(--wot-loading-wave-gap, 6.25%)' : '0px' }
}
</script>
<template>
  <view :class="`wd-loading wd-loading--${direction} ${customClass}`" :style="rootStyle">
    <view :class="`wd-loading__spinner wd-loading__spinner--${type} ${customSpinnerClass}`" :style="spinnerStyle">
      <view v-if="type === 'circular'" class="wd-loading__spinner-wraper">
        <view v-if="inheritColor" class="wd-loading__spinner-circular">
          <view v-for="(style, index) in inheritedSegments" :key="index" class="wd-loading__circular-segment" :style="style" />
        </view>
        <svg v-else class="wd-loading__spinner-circular" :content="circularSvg" />
      </view>
      <view v-else-if="type === 'spinner'" class="wd-loading__spinner-wraper">
        <view v-for="i in dots" :key="i" class="wd-loading__spinner-dot" :style="spinnerDotStyle(i)"><view class="wd-loading__spinner-dot-bar" /></view>
      </view>
      <view v-else-if="type === 'dots'" class="wd-loading__spinner-wraper">
        <view v-for="i in 3" :key="i" class="wd-loading__spinner-dot" :style="dotDelayStyle(i)" />
      </view>
      <view v-else-if="type === 'wave'" class="wd-loading__spinner-wraper">
        <view v-for="i in 4" :key="i" class="wd-loading__spinner-wave-bar" :style="waveBarStyle(i)">
          <view class="wd-loading__spinner-wave-bar-inner" :style="{ 'animation-name': `wd-wave-bar-${i}` }" />
        </view>
      </view>
    </view>
    <view v-if="$slots.default || text" class="wd-loading__text"><slot><text class="wd-loading__text-content">{{ text }}</text></slot></view>
  </view>
</template>
