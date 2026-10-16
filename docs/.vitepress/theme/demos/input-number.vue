<script setup lang="ts">
/**
 * InputNumber 步进器 — 文档站 H5 预览演示（手工编写）。
 */
import { ref } from 'vue'
import WdInputNumber from 'wot-lynx-ui/components/wd-input-number/wd-input-number.vue'

const value = ref(5)
</script>

<template>
  <scroll-view scroll-orientation="vertical" class="wd-h5-demo">
    <view class="wd-h5-demo__section">
      <text class="wd-h5-demo__section-title">基础用法</text>
      <view class="wd-h5-demo__panel">
        <view class="wd-h5-demo__row">
          <wd-input-number v-model="value" :min="0" :max="10" />
          <text class="wd-h5-demo__tag">当前值：{{ value }}</text>
        </view>
      </view>
    </view>

    <view class="wd-h5-demo__section">
      <text class="wd-h5-demo__section-title">步长 / 禁用 / 尺寸</text>
      <view class="wd-h5-demo__panel">
        <view class="wd-h5-demo__row">
          <wd-input-number v-model="value" :step="2" />
          <wd-input-number v-model="value" disabled />
        </view>
      </view>
    </view>
  </scroll-view>
</template>
