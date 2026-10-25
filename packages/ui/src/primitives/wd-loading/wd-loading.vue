/*
 * wd-loading — 官方节奏、尺寸与原生图形。
 * circular 把官方 90°–330° 淡入、330°–360° 实色环拆成 90 个 3° 扇段，
 * 不依赖不受支持的 conic-gradient/mask/linearGradient。SVG 版本为分段近似
 *（fill 逐 path 显式下发：真机 SVG 不继承 g 元素的展示属性，统一填在 g 上会整环隐形）。
 * 颜色一律 JS 解析为具体值内联下发：真机 view 的 background-color 不解析
 * currentColor（2026-10-25 真机巡检，Loading 全型隐形缺陷），CSS 类里的
 * currentColor 仅作兜底；inheritColor 无法跨 JS 继承，回落主题默认色。
 * wave 以居中 scaleY 代替 height 动画：高度比例/时序一致，圆角会一起缩放。
 */
<script lang="ts" setup>
import './index.css'
import { computed } from 'vue-lynx'
import { loadingProps } from './types'
import { addUnit, isDef, parseStyle, sanitizeSvgContent } from '../../common/util'
import { defineStyleKeys, resolveStyle, createStyleResolver } from '../../common/style'
import { useGlobalConfig } from '../../composables/useGlobalConfig'
import { PRIMARY_COLOR, SECONDARY_COLOR } from '../../common/theme'

const props = defineProps(loadingProps)
const globalConfig = useGlobalConfig()
const dots = Array.from({ length: 12 }, (_, i) => i)
const resolveRootStyle = createStyleResolver({ color: '' })
const customStyle = computed(() => parseStyle(props.customStyle))
const inheritCircularColor = computed(() => props.inheritColor || ['inherit', 'currentColor'].includes(String(customStyle.value.color || props.color)))
const rootStyle = computed(() => resolveRootStyle(
  { color: props.inheritColor ? 'inherit' : props.color }, customStyle.value))
const SPINNER_STYLE = defineStyleKeys({ width: '', height: '' })
const spinnerStyle = computed(() => resolveStyle(SPINNER_STYLE, {
  height: isDef(props.size) ? addUnit(props.size) : '', width: isDef(props.size) ? addUnit(props.size) : ''
}))
/**
 * 解析为具体色值（真机 2026-10-25 巡检）：view 的 background-color 不解析
 * currentColor，靠 CSS currentColor 上色的圆环小段 / 圆点 / 波浪条在真机
 * 全部隐形。颜色统一在 JS 侧解析成具体值后经内联样式下发；CSS 类里的
 * currentColor 仅作非组件场景的兜底。inheritColor 无法在 JS 侧真继承，
 * 近似回落主题默认色（亮色 PRIMARY / 暗色 SECONDARY）。
 */
const resolvedColor = computed(() => customStyle.value.color || props.color ||
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
  // fill 逐 path 显式下发（真机 SVG 不继承 g 元素的展示属性）
  const filled = paths.split('<path ').map((chunk, index) =>
    index === 0 ? chunk : '<path fill="' + resolvedColor.value + '" ' + chunk
  ).join('')
  return sanitizeSvgContent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><g fill="${resolvedColor.value}">${filled}</g></svg>`)
})
const inheritedSegments = computed(() => {
  const thickness = ringThickness.value
  const radius = 50 - thickness / 2
  const length = radius * Math.PI / 60 + 0.15
  return circularSegments.value.map(({ start, opacity }) => {
    const [x, y] = polar(radius, start + 1.5)
    return { left: `${x - thickness / 2}%`, top: `${y - length / 2}%`,
      width: `${thickness}%`, height: `${length}%`, transform: `rotate(${start + 1.5 - 90}deg)`, opacity: `${opacity}`,
      'background-color': resolvedColor.value }
  })
})
/** spinner 型 12 根小棒的显式底色（CSS currentColor 真机不解析，见 resolvedColor 注释） */
const dotBarStyle = computed<Record<string, string>>(() => ({ 'background-color': resolvedColor.value }))
function spinnerDotStyle(index: number): Record<string, string> {
  return { transform: `rotate(${60 - index * 30}deg)`, opacity: (1 - (0.75 / 12) * index).toFixed(4) }
}
function dotDelayStyle(index: number): Record<string, string> {
  const duration = 'var(--wot-loading-spinner-animation-duration, 0.8s)'
  return { 'animation-delay': `calc(${duration} * ${index - 1} / 3)`, 'animation-duration': duration, 'background-color': resolvedColor.value }
}
function waveBarStyle(index: number): Record<string, string> {
  return { 'margin-left': index > 1 ? 'var(--wot-loading-wave-gap, 6.25%)' : '0px' }
}
function waveInnerStyle(index: number): Record<string, string> {
  return { 'animation-name': `wd-wave-bar-${index}`, 'background-color': resolvedColor.value }
}
</script>
<template>
  <view :class="`wd-loading wd-loading--${direction} ${customClass}`" :style="rootStyle">
    <view :class="`wd-loading__spinner wd-loading__spinner--${type} ${customSpinnerClass}`" :style="spinnerStyle">
      <view v-if="type === 'circular'" class="wd-loading__spinner-wraper">
        <view v-if="inheritCircularColor" class="wd-loading__spinner-circular">
          <view v-for="(style, index) in inheritedSegments" :key="index" class="wd-loading__circular-segment" :style="style" />
        </view>
        <svg v-else class="wd-loading__spinner-circular" :content="circularSvg" />
      </view>
      <view v-else-if="type === 'spinner'" class="wd-loading__spinner-wraper">
        <view v-for="i in dots" :key="i" class="wd-loading__spinner-dot" :style="spinnerDotStyle(i)"><view class="wd-loading__spinner-dot-bar" :style="dotBarStyle" /></view>
      </view>
      <view v-else-if="type === 'dots'" class="wd-loading__spinner-wraper">
        <view v-for="i in 3" :key="i" class="wd-loading__spinner-dot" :style="dotDelayStyle(i)" />
      </view>
      <view v-else-if="type === 'wave'" class="wd-loading__spinner-wraper">
        <view v-for="i in 4" :key="i" class="wd-loading__spinner-wave-bar" :style="waveBarStyle(i)">
          <view class="wd-loading__spinner-wave-bar-inner" :style="waveInnerStyle(i)" />
        </view>
      </view>
    </view>
    <view v-if="$slots.default || text" class="wd-loading__text"><slot><text class="wd-loading__text-content">{{ text }}</text></slot></view>
  </view>
</template>
