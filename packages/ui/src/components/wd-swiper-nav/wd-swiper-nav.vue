/*
 * wd-swiper-nav — 轮播导航
 *
 * Lynx 实现说明：横向 scroll-view 承载导航项，
 * 点击项同步联动轮播（经 current 受控）。
 */
<script lang="ts" setup>
import './index.css'
import { parseStyle } from '../../common/util'

import { computed } from 'vue-lynx'
import WdIcon from '../wd-icon/wd-icon.vue'
import { swiperNavProps } from './types'

const props = defineProps(swiperNavProps)
const emit = defineEmits(['change', 'click'])

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
