/*
 * wd-swiper-nav — 横向导航（图标 / 图片）
 *
 * 注意：本组件与 wot-ui 的 swiper-nav **API 完全不同**——wot-ui 的
 * swiper-nav 是轮播指示器（dots / dots-bar / fraction，配合 wd-swiper
 * 使用）；本组件是图标 / 图片横向导航：scroll-view 承载一排导航项，
 * 点击项 emit click（{ index, item }），由消费方联动外部轮播。
 * wot-ui 的 navigation / change 等成员在本组件中未实现，已从
 * types / emits 删除（详见 types.ts 头部注释）。
 *
 * Lynx 实现说明：横向 scroll-view 承载导航项；图片经原生 image，
 * 图标经 wd-icon；点击经 @tap。
 */
<script lang="ts" setup>
import './index.css'
import { parseStyle } from '../../common/util'

import { computed } from 'vue-lynx'
import WdIcon from '../wd-icon/wd-icon.vue'
import { swiperNavProps } from './types'

const props = defineProps(swiperNavProps)
const emit = defineEmits(['click'])

const rootClass = computed(() => {
  const classes = ['wd-swiper-nav']
  if (props.customClass) classes.push(props.customClass)
  return classes.join(' ')
})
</script>

<template>
  <scroll-view scroll-x class="wd-swiper-nav__scroll" :class="rootClass" :style="parseStyle(customStyle)">
    <view class="wd-swiper-nav__inner">
      <view
        v-for="(item, index) in items"
        :key="index"
        class="wd-swiper-nav__item"
        @tap="emit('click', { index, item })"
      >
        <image v-if="type === 'image'" class="wd-swiper-nav__img" :src="item.url || item.src" mode="aspectFill" />
        <wd-icon v-else :name="item.icon" custom-class="wd-swiper-nav__icon" />
        <text v-if="item.title" class="wd-swiper-nav__title">{{ item.title }}</text>
      </view>
    </view>
  </scroll-view>
</template>
