<template>
  <template v-if="showControls">
    <view class="wd-swiper-nav__btn wd-swiper-nav__btn--prev" @tap="handleNav('prev')">
      <WdIcon name="left" custom-class="wd-swiper-nav__btn-icon"></WdIcon>
    </view>
    <view class="wd-swiper-nav__btn wd-swiper-nav__btn--next" @tap="handleNav('next')">
      <WdIcon name="right" custom-class="wd-swiper-nav__btn-icon"></WdIcon>
    </view>
  </template>
  <view
    v-if="total >= minShowNum"
    :style="styleToObject(customStyle)"
    :class="`wd-swiper-nav wd-swiper-nav--${direction} wd-swiper-nav--${type} wd-swiper-nav--${indicatorPosition} ${customClass}`"
  >
    <template v-if="type === 'dots' || type === 'dots-bar'">
      <view
        v-for="(_, index) in total"
        :key="index"
        :class="`wd-swiper-nav__item--${type} ${current === index ? 'is-active' : ''} is-${direction}`"
      ></view>
    </template>
    <template v-if="type === 'fraction'"><text>{{ current + 1 }}/{{ total }}</text></template>
  </view>
</template>

<script setup lang="ts">
import './index.css'
import { styleToObject } from '../../common/util'
import { swiperNavprops } from './types'
import WdIcon from '../wd-icon/wd-icon.vue'

defineProps(swiperNavprops)

const emit = defineEmits(['change'])

function handleNav(dir: 'prev' | 'next') {
  const source: string = 'nav'
  emit('change', { dir, source })
}
</script>

