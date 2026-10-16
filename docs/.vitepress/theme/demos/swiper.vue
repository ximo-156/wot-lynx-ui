<script setup lang="ts">
/**
 * Swiper 轮播图 — 文档站 H5 预览演示（手工编写）。
 */
import { ref } from 'vue'
import WdSwiper from 'wot-lynx-ui/components/wd-swiper/wd-swiper.vue'

// 内联 SVG 占位图（离线可渲染）
const slide = (text: string, bg: string) =>
  'data:image/svg+xml,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="300"><rect width="640" height="300" fill="${bg}"/><text x="320" y="165" font-size="40" fill="#fff" text-anchor="middle">${text}</text></svg>`
  )

const list = ref([
  { url: slide('第一张', '#7F5CFF'), text: '1' },
  { url: slide('第二张', '#00A06D'), text: '2' },
  { url: slide('第三张', '#C97F10'), text: '3' }
])

const current = ref(0)
</script>

<template>
  <scroll-view scroll-orientation="vertical" class="wd-h5-demo">
    <view class="wd-h5-demo__section">
      <text class="wd-h5-demo__section-title">基础用法</text>
      <view class="wd-h5-demo__panel" style="padding: 0">
        <wd-swiper :list="list" v-model:current="current" :height="160" />
        <text class="wd-h5-demo__panel-label" style="margin: 8px 12px 0">当前索引：{{ current }}</text>
      </view>
    </view>

    <view class="wd-h5-demo__section">
      <text class="wd-h5-demo__section-title">自动播放 / 指示点</text>
      <view class="wd-h5-demo__panel" style="padding: 0">
        <wd-swiper :list="list" autoplay :interval="3000" :height="160" indicator-color="#E4DBFF" indicator-active-color="#7F5CFF" />
      </view>
    </view>
  </scroll-view>
</template>
