/*
 * wd-loading — 加载指示器
 *
 * Lynx 实现说明（相对 wot-ui 的适配点）：
 * - circular：wot-ui 用 conic-gradient + radial mask 绘制带渐变拖尾的圆环；
 *   Lynx 不支持 conic-gradient / mask，改用 SVG circle + stroke-dasharray
 *   绘制等长圆弧（120°，起始角 330°，与 wot-ui 一致），渐变拖尾降级为硬边
 *   （SVG 渐变元素不在 Lynx 白名单内，见 CONVENTIONS §8）；
 * - spinner：wot-ui 的 12 个 dot 盒子内嵌 ::before 条状图形；Lynx 无伪元素，
 *   改为 dot 盒子内嵌真实元素 wd-loading__spinner-dot-bar；
 * - wave：wot-ui 直接动画 height；Lynx 对布局属性的关键帧动画支持有限，
 *   降级为 scaleY（视觉等效），其余节奏（时长 / 阶梯延迟）保持一致；
 * - :nth-of-type 阶梯（透明度 / 动画延迟）Lynx 不支持，改由 v-for 索引内联下发；
 * - 颜色经根节点 color 下发，图形部件用 currentColor；SVG content 不继承
 *   CSS 变量，circular 的圆弧颜色由 JS 侧按 props 计算后注入。
 */
<script lang="ts" setup>
import './index.css'

import { computed } from 'vue-lynx'
import { loadingProps } from './types'
import { addUnit, isDef, filterStyle, parseStyle, sanitizeSvgContent } from '../../common/util'

const props = defineProps(loadingProps)

// 长度为 12 的数组（spinner 类型 12 个 dot）
const dots = Array.from({ length: 12 }, (_, i) => i)

const rootStyle = computed(() => {
  const style: Record<string, string> = {}
  if (isDef(props.color)) {
    style.color = props.color
  }
  if (props.inheritColor) {
    style.color = 'inherit'
  }
  return { ...filterStyle(style), ...parseStyle(props.customStyle) }
})

const spinnerStyle = computed(() => {
  const style: Record<string, string> = {}
  if (isDef(props.size)) {
    style.height = addUnit(props.size)
    style.width = addUnit(props.size)
  }
  return filterStyle(style)
})

/** 圆弧颜色：未指定 color 时取主题主色（--wot-primary-6 的 JS 镜像） */
const circularColor = computed(() => props.color || '#1C64FDFF')

/**
 * circular 圆弧 SVG：viewBox 100×100，描边宽 15（= wot-ui 的 15% 环宽），
 * 120° 圆弧（dasharray = 周长/3），起始角 -30°（即 wot-ui conic 的 330°）。
 */
const circularSvg = computed(() => {
  const r = 42.5
  const circumference = 2 * Math.PI * r
  const arc = circumference / 3
  const markup =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">` +
    `<circle cx="50" cy="50" r="${r}" fill="none" stroke="${circularColor.value}" stroke-width="15" ` +
    `stroke-dasharray="${arc.toFixed(2)} ${(circumference - arc).toFixed(2)}" transform="rotate(-30 50 50)"/>` +
    `</svg>`
  return sanitizeSvgContent(markup)
})

/** spinner 单个 dot 的环绕旋转（wot-ui: rotate(90deg - i*30deg)、透明度 1 - 0.75/12*(i-1)） */
function spinnerDotStyle(index: number): Record<string, string> {
  return {
    transform: `rotate(${60 - index * 30}deg)`,
    opacity: (1 - (0.75 / 12) * index).toFixed(4)
  }
}

/** dots 的阶梯延迟：wot-ui 为 calc(duration * (i-1) / 3)，此处按 0.8s 折算 */
function dotDelayStyle(index: number): Record<string, string> {
  return { 'animation-delay': `${((index - 1) * (0.8 / 3)).toFixed(4)}s` }
}

/** wave 单柱的动画名（wot-ui 经 :nth-of-type 绑定，此处按索引内联） */
function waveBarStyle(index: number): Record<string, string> {
  return { 'animation-name': `wd-wave-bar-${index}` }
}
</script>

<template>
  <view :class="`wd-loading wd-loading--${direction} ${customClass}`" :style="rootStyle">
    <view :class="`wd-loading__spinner wd-loading__spinner--${type} ${customSpinnerClass}`" :style="spinnerStyle">
      <view v-if="type === 'circular'" class="wd-loading__spinner-wraper">
        <svg class="wd-loading__spinner-circular" :content="circularSvg" />
      </view>
      <view v-else-if="type === 'spinner'" class="wd-loading__spinner-wraper">
        <view v-for="i in dots" :key="i" class="wd-loading__spinner-dot" :style="spinnerDotStyle(i)">
          <view class="wd-loading__spinner-dot-bar" />
        </view>
      </view>
      <view v-else-if="type === 'dots'" class="wd-loading__spinner-wraper">
        <view v-for="i in 3" :key="i" class="wd-loading__spinner-dot" :style="dotDelayStyle(i)" />
      </view>
      <view v-else-if="type === 'wave'" class="wd-loading__spinner-wraper">
        <view v-for="i in 4" :key="i" class="wd-loading__spinner-wave-bar" :style="waveBarStyle(i)">
          <view class="wd-loading__spinner-wave-bar-inner" />
        </view>
      </view>
    </view>
    <!-- 兜底文本包 text：Lynx view 内裸文本不渲染（CONVENTIONS §4） -->
    <view v-if="$slots.default || text" class="wd-loading__text">
      <slot><text>{{ text }}</text></slot>
    </view>
  </view>
</template>
