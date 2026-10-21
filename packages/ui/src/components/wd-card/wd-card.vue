/*
 * wd-card — 卡片
 *
 * Lynx 没有结构伪类及伪元素：卡片在父渲染完成后核对真实兄弟顺序，
 * 最后一个元素无多余底边距；真实线段保留 rectangle/footer 官方左右缩进。
 */
<script lang="ts" setup>
import './index.css'

import { parseStyle } from '../../common/util'
import { cardProps } from './types'
import { useCardLastSibling } from './siblings'

defineProps(cardProps)
const lastSibling = useCardLastSibling()
</script>

<template>
  <view :class="['wd-card', type ? `wd-card--${type}` : '', { 'is-last': lastSibling }, customClass]" :style="parseStyle(customStyle)">
    <view v-if="title || $slots.title" :class="`wd-card__title ${customTitleClass}`">
      <slot name="title"><text v-if="title" class="wd-card__title-text" :text-maxline="1">{{ title }}</text></slot>
    </view>
    <view :class="`wd-card__content ${customContentClass}`">
      <view v-if="type === 'rectangle'" class="wd-card__border wd-card__border--content" />
      <slot />
    </view>
    <view v-if="$slots.footer" :class="`wd-card__footer ${customFooterClass}`">
      <view class="wd-card__border wd-card__border--footer" />
      <slot name="footer" />
    </view>
  </view>
</template>
