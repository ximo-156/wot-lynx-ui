<script setup lang="ts">
/**
 * Img 图片 — 文档站 H5 预览演示（手工编写）。
 */
import WdImg from 'wot-lynx-ui/components/wd-img/wd-img.vue'

// 内联 SVG 占位图（离线可渲染）
const placeholder =
  'data:image/svg+xml,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="220" height="160"><rect width="220" height="160" fill="#E4DBFF"/><text x="110" y="86" font-size="22" fill="#7F5CFF" text-anchor="middle">图片</text></svg>'
  )
</script>

<template>
  <scroll-view scroll-orientation="vertical" class="wd-h5-demo">
    <view class="wd-h5-demo__section">
      <text class="wd-h5-demo__section-title">裁剪模式</text>
      <view class="wd-h5-demo__panel">
        <view class="wd-h5-demo__row" style="align-items: flex-start">
          <wd-img :src="placeholder" width="90" height="70" mode="aspectFill" />
          <wd-img :src="placeholder" width="90" height="70" mode="aspectFit" />
          <wd-img :src="placeholder" width="90" height="70" mode="widthFix" />
        </view>
      </view>
    </view>

    <view class="wd-h5-demo__section">
      <text class="wd-h5-demo__section-title">圆形 / 圆角 / 懒加载</text>
      <view class="wd-h5-demo__panel">
        <view class="wd-h5-demo__row" style="align-items: flex-start">
          <wd-img :src="placeholder" width="64" height="64" round />
          <wd-img :src="placeholder" width="64" height="64" radius="8" />
          <wd-img :src="placeholder" width="64" height="64" lazy-load />
        </view>
      </view>
    </view>

    <view class="wd-h5-demo__section">
      <text class="wd-h5-demo__section-title">错误态 / 点击</text>
      <view class="wd-h5-demo__panel">
        <view class="wd-h5-demo__row" style="align-items: flex-start">
          <wd-img src="data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%3E%3C/svg%3E" width="64" height="64" @error="console.log('[preview] img error')" />
          <wd-img :src="placeholder" width="64" height="64" round @tap="console.log('[preview] img tap')" />
        </view>
      </view>
    </view>
  </scroll-view>
</template>
