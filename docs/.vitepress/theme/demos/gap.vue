<script setup lang="ts">
/**
 * Gap 间距 — 文档站 H5 预览演示（手工编写）。
 */
import WdGap from 'wot-lynx-ui/components/wd-gap/wd-gap.vue'
import WdCell from 'wot-lynx-ui/components/wd-cell/wd-cell.vue'
</script>

<template>
  <scroll-view scroll-orientation="vertical" class="wd-h5-demo">
    <view class="wd-h5-demo__section">
      <text class="wd-h5-demo__section-title">基础用法</text>
      <view class="wd-h5-demo__panel" style="padding: 0">
        <wd-cell title="单元格一" value="内容" />
        <wd-gap height="12" bg-color="var(var(--wot-filled-bottom))" />
        <wd-cell title="单元格二" value="内容" />
        <wd-gap height="24" bg-color="var(var(--wot-filled-bottom))" />
        <wd-cell title="单元格三" value="内容" />
      </view>
    </view>

    <view class="wd-h5-demo__section">
      <text class="wd-h5-demo__section-title">无背景（默认白）</text>
      <view class="wd-h5-demo__panel" style="padding: 0">
        <wd-cell title="单元格" value="内容" />
        <wd-gap height="16" />
        <wd-cell title="单元格" value="内容" />
      </view>
    </view>
  </scroll-view>
</template>
