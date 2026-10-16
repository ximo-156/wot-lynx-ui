<script setup lang="ts">
/**
 * Rate 评分 — 文档站 H5 预览演示（手工编写）。
 */
import { ref } from 'vue'
import WdRate from 'wot-lynx-ui/components/wd-rate/wd-rate.vue'

const value = ref(3)
</script>

<template>
  <scroll-view scroll-orientation="vertical" class="wd-h5-demo">
    <view class="wd-h5-demo__section">
      <text class="wd-h5-demo__section-title">基础用法</text>
      <view class="wd-h5-demo__panel">
        <wd-rate v-model="value" />
        <text class="wd-h5-demo__panel-label">评分：{{ value }}</text>
      </view>
    </view>

    <view class="wd-h5-demo__section">
      <text class="wd-h5-demo__section-title">自定义图标 / 个数 / 只读</text>
      <view class="wd-h5-demo__panel">
        <wd-rate v-model="value" :num="6" icon="favorite" />
        <wd-rate v-model="value" :num="5" readonly />
        <wd-rate v-model="value" disabled />
      </view>
    </view>
  </scroll-view>
</template>
