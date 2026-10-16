<script setup lang="ts">
/**
 * Progress 进度条 — 文档站 H5 预览演示（手工编写）。
 */
import { ref } from 'vue'
import WdProgress from 'wot-lynx-ui/components/wd-progress/wd-progress.vue'

const value = ref(60)
</script>

<template>
  <scroll-view scroll-orientation="vertical" class="wd-h5-demo">
    <view class="wd-h5-demo__section">
      <text class="wd-h5-demo__section-title">基础用法</text>
      <view class="wd-h5-demo__panel">
        <wd-progress :percentage="value" style="flex: 1" />
        <text class="wd-h5-demo__panel-label">进度：{{ value }}%</text>
      </view>
    </view>

    <view class="wd-h5-demo__section">
      <text class="wd-h5-demo__section-title">颜色 / 尺寸 / 状态</text>
      <view class="wd-h5-demo__panel">
        <wd-progress :percentage="value" color="#7F5CFF" style="flex: 1" />
        <wd-progress :percentage="value" :stroke-width="8" style="flex: 1" />
        <wd-progress :percentage="100" status="success" style="flex: 1" />
        <wd-progress :percentage="50" status="danger" style="flex: 1" />
        <wd-progress :percentage="value" hide-text style="flex: 1" />
      </view>
    </view>
  </scroll-view>
</template>
