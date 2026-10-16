/*
 * wd-empty — 空状态
 *
 * Lynx 实现说明：图标 + 提示文字 + 底部插槽；
 * 图标经 wd-icon 渲染（内置 empty 图标）。
 * iconSize 必须经 wd-icon 的 size prop 下发——字体字形自带内联
 * font-size（默认 20px），Lynx text 不依赖继承，挂在 wd-icon 根 view 上的
 * font-size 到不了字形（CONVENTIONS §8）。
 */
<script lang="ts" setup>
import './index.css'

import WdIcon from '../wd-icon/wd-icon.vue'
import { emptyProps } from './types'
import { parseStyle } from '../../common/util'

const props = defineProps(emptyProps)
</script>

<template>
  <view :class="`wd-empty ${customClass}`" :style="parseStyle(customStyle)">
    <slot name="image">
      <wd-icon :name="icon" :class-prefix="iconPrefix" :css-icon="cssIcon" custom-class="wd-empty__icon" :size="iconSize" />
    </slot>
    <view v-if="tip" class="wd-empty__text">
      <text>{{ tip }}</text>
    </view>
    <slot name="bottom" />
  </view>
</template>
