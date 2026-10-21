/*
 * wd-swiper-nav — 轮播指示器（dots / dots-bar / fraction）
 *
 * Lynx 实现说明（相对 wot-ui 2.3.2 的适配点）：
 * - @click → @tap：Lynx view 不存在 click 事件，只派发 tap
 *   （CONVENTIONS §14 订正，@click 为死事件）；
 * - 参考源的 block 元素（uni-app 专有，Lynx 无该内置元素）改为
 *   template v-if / v-for 无渲染占位（CONVENTIONS §4 原生元素白名单）；
 * - fraction 的裸文本插值包进 text 元素（Lynx 要求 view 内所有文本必须
 *   包在 text 中）；
 * - 使用父级已提供的官方 left/right 字体图标；字形样式显式覆盖 text 节点。
 * - customStyle 经 parseStyle 归一为对象语法后绑定，fraction text 自身消费令牌。
 */
<script lang="ts" setup>
import './index.css'

import { parseStyle } from '../../common/util'
import WdIcon from '../wd-icon/wd-icon.vue'
import { swiperNavprops } from './types'

defineProps(swiperNavprops)

const emit = defineEmits(['change', 'tap'])

function handleNav(dir: 'prev' | 'next', event: any) {
  const source: string = 'nav'
  emit('change', { dir, source })
  emit('tap', event)
}
</script>

<template>
  <template v-if="showControls">
    <view class="wd-swiper-nav__btn wd-swiper-nav__btn--prev" @tap="handleNav('prev', $event)">
      <WdIcon name="left" custom-class="wd-swiper-nav__btn-icon" />
    </view>
    <view class="wd-swiper-nav__btn wd-swiper-nav__btn--next" @tap="handleNav('next', $event)">
      <WdIcon name="right" custom-class="wd-swiper-nav__btn-icon" />
    </view>
  </template>
  <view
    v-if="total >= minShowNum"
    :style="parseStyle(customStyle)"
    :class="`wd-swiper-nav wd-swiper-nav--${direction} wd-swiper-nav--${type} wd-swiper-nav--${indicatorPosition} ${customClass}`"
  >
    <template v-if="type === 'dots' || type === 'dots-bar'">
      <view
        v-for="(_, index) in total"
        :key="index"
        :class="`wd-swiper-nav__item--${type} ${current === index ? 'is-active' : ''} is-${direction}`"
      ></view>
    </template>
    <text v-if="type === 'fraction'" class="wd-swiper-nav__fraction-text">{{ current + 1 }}/{{ total }}</text>
  </view>
</template>
