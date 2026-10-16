/*
 * wd-loading — 加载指示器
 *
 * Lynx 实现说明：
 * - 四种类型（circular / spinner / dots / wave）全部用 CSS 动画实现，
 *   不使用伪元素（Lynx 不支持）与 conic-gradient；
 * - circular 用 border 圆环 + rotate；spinner 用 12 个 dot 环绕 +
 *   容器 rotate + 逐点透明度阶梯；dots / wave 用透明度 / 缩放缓动；
 * - 颜色经根节点 color 下发，图形部件用 currentColor（普通 CSS 属性，
 *   Lynx 支持；仅 svg content 内不继承，故此处不用 svg）。
 */
<script lang="ts" setup>
import './index.css'

import { computed } from 'vue-lynx'
import { loadingProps } from './types'
import { addUnit, isDef, filterStyle, parseStyle } from '../../common/util'

const props = defineProps(loadingProps)

// spinner 类型：12 个 dot 环绕分布
const spinnerDots = Array.from({ length: 12 }, (_, i) => i)

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

/** spinner 单个 dot 的环绕定位（rotate + 向外平移） */
function spinnerDotStyle(index: number): Record<string, string> {
  const rotate = index * 30
  return {
    transform: `rotate(${rotate}deg) translate(0, -40%)`,
    opacity: (1 - index / 12).toFixed(2)
  }
}

/** dots / wave 的阶梯延迟（Lynx 不支持 :nth-child，用索引内联） */
function staggerDelay(index: number, step: number): Record<string, string> {
  return { 'animation-delay': `${(index * step).toFixed(2)}s` }
}
</script>

<template>
  <view :class="`wd-loading wd-loading--${direction} ${customClass}`" :style="rootStyle">
    <view :class="`wd-loading__spinner wd-loading__spinner--${type} ${customSpinnerClass}`" :style="spinnerStyle">
      <view v-if="type === 'circular'" class="wd-loading__spinner-wraper" />
      <view v-else-if="type === 'spinner'" class="wd-loading__spinner-wraper">
        <view
          v-for="i in spinnerDots"
          :key="i"
          class="wd-loading__spinner-dot"
          :style="spinnerDotStyle(i)"
        />
      </view>
      <view v-else-if="type === 'dots'" class="wd-loading__spinner-wraper">
        <view v-for="i in 3" :key="i" class="wd-loading__spinner-dot" :style="staggerDelay(i, 0.15)" />
      </view>
      <view v-else-if="type === 'wave'" class="wd-loading__spinner-wraper">
        <view v-for="i in 4" :key="i" class="wd-loading__spinner-wave-bar">
          <view class="wd-loading__spinner-wave-bar-inner" :style="staggerDelay(i, 0.1)" />
        </view>
      </view>
    </view>
    <!-- 兜底文本包 text：Lynx view 内裸文本不渲染（CONVENTIONS §4） -->
    <view v-if="$slots.default || text" class="wd-loading__text">
      <slot><text>{{ text }}</text></slot>
    </view>
  </view>
</template>
