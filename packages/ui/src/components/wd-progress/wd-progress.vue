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
import { isString, parseStyle } from '../../common/util'
import { WHITE } from '../../common/theme'

const props = defineProps(progressProps)

// 样式一律输出对象（CONVENTIONS §19：vue-lynx 的 patchProp 对字符串 style
// 会静默替换为 {}，百分比宽度/高度/渐变因此整体失效）。
const rootStyle = computed<Record<string, string>>(() => {
  const style: Record<string, string> = {}
  const color = isString(props.color) ? props.color : props.color?.left
  if (color) style.background = color
  style.width = `${Math.min(Math.max(props.percentage, 0), 100)}%`
  return style
})

const trackStyle = computed<Record<string, string>>(() => {
  const style: Record<string, string> = {}
  if (props.trackColor) style['background-color'] = props.trackColor
  style.height = `${props.strokeWidth}px`
  return style
})

const innerStyle = computed<Record<string, string>>(() => {
  return { height: `${props.strokeWidth}px` }
})

const iconName = computed(() => {
  switch (props.status) {
    case 'success':
      return 'success'
    case 'danger':
      return 'error'
    case 'warning':
      return 'warning'
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
    :style="parseStyle(customStyle)"
  >
    <view class="wd-progress__outer">
      <view class="wd-progress__track" :style="trackStyle">
        <view class="wd-progress__inner" :style="{ ...rootStyle, ...innerStyle }">
          <template v-if="percentPositionType === 'inner'">
            <!-- 文本包 text：Lynx view 内裸文本不渲染（CONVENTIONS §4） -->
            <text v-if="!hideText" class="wd-progress__label">{{ percentage }}%</text>
            <wd-icon
              v-else-if="status"
              custom-class="wd-progress__label wd-progress__icon"
              :name="iconName"
              :color="isString(color) ? color : WHITE"
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
