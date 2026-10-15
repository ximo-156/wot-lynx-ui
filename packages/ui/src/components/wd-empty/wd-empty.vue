/*
 * wd-empty — 空状态
 *
 * Lynx 实现说明：图标 + 提示文字 + 底部插槽；
 * 图标经 wd-icon 渲染（内置 empty 图标）。
 */
<script lang="ts" setup>
import './index.css'

import { computed } from 'vue-lynx'
import WdIcon from '../wd-icon/wd-icon.vue'
import { emptyProps } from './types'
import { isDef, parseStyle } from '../../common/util'

const props = defineProps(emptyProps)

const iconStyle = computed(() => {
  const style: Record<string, string> = {}
  if (isDef(props.iconSize)) {
    style['font-size'] = typeof props.iconSize === 'number' ? `${props.iconSize}px` : String(props.iconSize)
  }
  return Object.entries(style).map(([k, v]) => `${k}: ${v}`).join('; ')
})
</script>

<template>
  <view :class="`wd-empty ${customClass}`" :style="parseStyle(customStyle)">
    <slot name="image">
      <wd-icon :name="icon" :class-prefix="iconPrefix" :css-icon="cssIcon" custom-class="wd-empty__icon" :custom-style="iconStyle" />
    </slot>
    <view v-if="tip" class="wd-empty__text">
      <text>{{ tip }}</text>
    </view>
    <slot name="bottom" />
  </view>
</template>
