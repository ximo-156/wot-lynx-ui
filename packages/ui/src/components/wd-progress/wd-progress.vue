/*
 * wd-progress — 进度条
 *
 * Lynx 实现说明：
 * - 进度经宽度百分比 + CSS transition 过渡（duration 驱动）；
 * - 渐变降级：Lynx 的 linear-gradient 支持有限，color 为对象时取
 *   左侧色（CONVENTIONS §7 渐变降级策略）；
 * - inner 模式下文字渲染在进度条内部。
 */
<script lang="ts" setup>
import './index.css'

import { computed } from 'vue-lynx'
import WdIcon from '../wd-icon/wd-icon.vue'
import { progressProps } from './types'
import { isString } from '../../common/util'

const props = defineProps(progressProps)

const rootStyle = computed(() => {
  const style: Record<string, string> = {}
  const color = isString(props.color) ? props.color : props.color?.left
  if (color) style.background = color
  style.width = `${Math.min(Math.max(props.percentage, 0), 100)}%`
  return Object.entries(style).map(([k, v]) => `${k}: ${v}`).join('; ')
})

const trackStyle = computed(() => {
  const style: Record<string, string> = {}
  if (props.trackColor) style['background-color'] = props.trackColor
  style.height = `${props.strokeWidth}px`
  return Object.entries(style).map(([k, v]) => `${k}: ${v}`).join('; ')
})

const innerStyle = computed(() => {
  return `height: ${props.strokeWidth}px;`
})

const iconName = computed(() => {
  switch (props.status) {
    case 'success':
      return 'check-circle'
    case 'danger':
      return 'close-circle'
    case 'warning':
      return 'exclamation-circle'
    default:
      return ''
  }
})

const percentPositionType = computed(() => props.percentPosition?.type || 'outer')
</script>

<template>
  <view
    :class="[
      'wd-progress',
      percentPositionType === 'inner' ? 'wd-progress--inner' : '',
      status ? `wd-progress--${status}` : '',
      percentage === 0 ? 'is-zero' : '',
      customClass
    ]"
    :style="customStyle"
  >
    <view class="wd-progress__outer">
      <view class="wd-progress__track" :style="trackStyle">
        <view class="wd-progress__inner" :style="`${rootStyle}${innerStyle}`">
          <template v-if="percentPositionType === 'inner'">
            <view v-if="!hideText" class="wd-progress__label">{{ percentage }}%</view>
            <wd-icon
              v-else-if="status"
              custom-class="wd-progress__label wd-progress__icon"
              :name="iconName"
              :color="isString(color) ? color : ''"
            />
          </template>
        </view>
      </view>
    </view>
    <view v-if="percentPositionType === 'outer' && !hideText" class="wd-progress__text">
      <text>{{ percentage }}%</text>
    </view>
  </view>
</template>
