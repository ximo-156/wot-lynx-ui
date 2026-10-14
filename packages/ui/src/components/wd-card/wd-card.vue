<template>
  <view :class="`wd-card ${type ? `wd-card--${type}` : ''} ${customClass}`" :style="styleToObject(customStyle)">
    <view :class="`wd-card__title ${customTitleClass}`" v-if="title || $slots.title">
      <slot name="title">
        <text class="wd-card__title-text" v-if="title"><text>{{ title }}</text></text>
      </slot>
    </view>
    <view :class="`wd-card__content ${customContentClass}`">
      <!-- Lynx 适配：wot-ui 用 ::after 绘制内缩分隔线，改为真实元素（见 index.scss）。 -->
      <view v-if="type === 'rectangle'" class="wd-card__content-border" />
      <slot></slot>
    </view>
    <view :class="`wd-card__footer ${customFooterClass}`" v-if="$slots.footer">
      <view class="wd-card__footer-border" />
      <slot name="footer"></slot>
    </view>
  </view>
</template>

<script setup lang="ts">
import './index.css'
import { styleToObject } from '../../common/util'
import { cardProps } from './types'

defineProps(cardProps)
</script>

