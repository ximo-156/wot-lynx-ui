<script setup lang="ts">
/**
 * Divider 分割线 — 文档站 H5 预览演示（手工编写）。
 */
import WdDivider from 'wot-lynx-ui/components/wd-divider/wd-divider.vue'
</script>

<template>
  <scroll-view scroll-orientation="vertical" class="wd-h5-demo">
    <view class="wd-h5-demo__section">
      <text class="wd-h5-demo__section-title">基础用法</text>
      <view class="wd-h5-demo__panel">
        <text class="wd-h5-demo__panel-label">上方内容</text>
        <wd-divider />
        <text class="wd-h5-demo__panel-label">下方内容</text>
      </view>
    </view>

    <view class="wd-h5-demo__section">
      <text class="wd-h5-demo__section-title">内容位置 / 虚线 / 样式</text>
      <view class="wd-h5-demo__panel">
        <wd-divider content-position="left">左对齐</wd-divider>
        <wd-divider content-position="right">右对齐</wd-divider>
        <wd-divider dashed>虚线</wd-divider>
        <wd-divider color="#7F5CFF">自定义颜色</wd-divider>
      </view>
    </view>
  </scroll-view>
</template>
