<script setup lang="ts">
/**
 * Circle 环形进度 — 文档站 H5 预览演示（手工编写）。
 */
import WdCircle from 'wot-lynx-ui/components/wd-circle/wd-circle.vue'
</script>

<template>
  <scroll-view scroll-orientation="vertical" class="wd-h5-demo">
    <view class="wd-h5-demo__section">
      <text class="wd-h5-demo__section-title">基础用法</text>
      <view class="wd-h5-demo__panel">
        <view class="wd-h5-demo__row" style="justify-content: space-around">
          <wd-circle :model-value="65" :size="80" text="65%" />
          <wd-circle :model-value="100" :size="80" text="完成" />
        </view>
      </view>
    </view>

    <view class="wd-h5-demo__section">
      <text class="wd-h5-demo__section-title">自定义颜色 / 线宽</text>
      <view class="wd-h5-demo__panel">
        <view class="wd-h5-demo__row" style="justify-content: space-around">
          <wd-circle :model-value="45" :size="80" color="#7F5CFF" layer-color="#E4DBFF" text="45%" />
          <wd-circle :model-value="75" :size="80" :stroke-width="10" text="75%" />
        </view>
      </view>
    </view>
  </scroll-view>
</template>
