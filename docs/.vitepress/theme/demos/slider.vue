<script setup lang="ts">
/**
 * Slider 滑块 — 文档站 H5 预览演示（手工编写）。
 */
import { ref } from 'vue'
import WdSlider from 'wot-lynx-ui/components/wd-slider/wd-slider.vue'

const value = ref(50)
</script>

<template>
  <scroll-view scroll-orientation="vertical" class="wd-h5-demo">
    <view class="wd-h5-demo__section">
      <text class="wd-h5-demo__section-title">基础用法</text>
      <view class="wd-h5-demo__panel">
        <wd-slider v-model="value" style="flex: 1" />
        <text class="wd-h5-demo__panel-label">当前值：{{ value }}</text>
      </view>
    </view>

    <view class="wd-h5-demo__section">
      <text class="wd-h5-demo__section-title">自定义范围 / 步长 / 禁用</text>
      <view class="wd-h5-demo__panel">
        <wd-slider v-model="value" :min="10" :max="90" :step="5" style="flex: 1" />
        <wd-slider v-model="value" disabled style="flex: 1" />
      </view>
    </view>
  </scroll-view>
</template>
