/*
 * wd-card — 卡片
 *
 * Lynx 实现说明：标题 / 内容 / 底部三段式插槽结构；
 * rectangle 直角、round 大圆角，默认中圆角。
 */
<script lang="ts" setup>
import './index.css'
import { parseStyle } from '../../common/util'

import { cardProps } from './types'

defineProps(cardProps)
</script>

<template>
  <view :class="`wd-card ${type ? `wd-card--${type}` : ''} ${customClass}`" :style="parseStyle(customStyle)">
    <view v-if="title || $slots.title" :class="`wd-card__title ${customTitleClass}`">
      <slot name="title">
        <text v-if="title" class="wd-card__title-text">{{ title }}</text>
      </slot>
    </view>
    <view :class="`wd-card__content ${customContentClass}`">
      <slot />
    </view>
    <view v-if="$slots.footer" :class="`wd-card__footer ${customFooterClass}`">
      <slot name="footer" />
    </view>
  </view>
</template>
