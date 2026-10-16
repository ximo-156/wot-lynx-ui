<script setup lang="ts">
/**
 * Search 搜索框 — 文档站 H5 预览演示（手工编写）。
 */
import { ref } from 'vue'
import WdSearch from 'wot-lynx-ui/components/wd-search/wd-search.vue'

const value = ref('')
function onSearch() {
  console.log('[preview] search', value.value)
}
</script>

<template>
  <scroll-view scroll-orientation="vertical" class="wd-h5-demo">
    <view class="wd-h5-demo__section">
      <text class="wd-h5-demo__section-title">基础用法</text>
      <view class="wd-h5-demo__panel">
        <wd-search v-model="value" placeholder="搜索" style="flex: 1" @search="onSearch" />
        <text class="wd-h5-demo__panel-label">关键词：{{ value || '（空）' }}</text>
      </view>
    </view>

    <view class="wd-h5-demo__section">
      <text class="wd-h5-demo__section-title">自定义形状 / 禁用</text>
      <view class="wd-h5-demo__panel">
        <wd-search v-model="value" placeholder="填充样式" variant="filled" style="flex: 1" />
        <wd-search v-model="value" placeholder="禁用搜索" disabled style="flex: 1" />
      </view>
    </view>
  </scroll-view>
</template>
