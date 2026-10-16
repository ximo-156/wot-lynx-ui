<script setup lang="ts">
/**
 * Segmented 分段器 — 文档站 H5 预览演示（手工编写）。
 */
import { ref } from 'vue'
import WdSegmented from 'wot-lynx-ui/components/wd-segmented/wd-segmented.vue'

const value = ref('a')
</script>

<template>
  <scroll-view scroll-orientation="vertical" class="wd-h5-demo">
    <view class="wd-h5-demo__section">
      <text class="wd-h5-demo__section-title">基础用法</text>
      <view class="wd-h5-demo__panel">
        <wd-segmented v-model="value" :options="['日', '周', '月']" style="flex: 1" />
        <text class="wd-h5-demo__panel-label">当前：{{ value }}</text>
      </view>
    </view>

    <view class="wd-h5-demo__section">
      <text class="wd-h5-demo__section-title">对象选项 / 禁用 / 块级</text>
      <view class="wd-h5-demo__panel">
        <wd-segmented
          v-model="value"
          :options="[
            { value: 'a', label: '选项一' },
            { value: 'b', label: '选项二' },
            { value: 'c', label: '选项三' }
          ]"
          style="flex: 1"
        />
        <wd-segmented v-model="value" :options="['日', '周']" disabled style="flex: 1" />
      </view>
    </view>
  </scroll-view>
</template>
