<script setup lang="ts">
/**
 * Pagination 分页器 — 文档站 H5 预览演示（手工编写）。
 */
import { ref } from 'vue'
import WdPagination from 'wot-lynx-ui/components/wd-pagination/wd-pagination.vue'

const page = ref(1)
</script>

<template>
  <scroll-view scroll-orientation="vertical" class="wd-h5-demo">
    <view class="wd-h5-demo__section">
      <text class="wd-h5-demo__section-title">基础用法</text>
      <view class="wd-h5-demo__panel">
        <wd-pagination v-model="page" :total-page="5" />
        <text class="wd-h5-demo__panel-label">当前页：{{ page }}</text>
      </view>
    </view>

    <view class="wd-h5-demo__section">
      <text class="wd-h5-demo__section-title">图标模式 / 提示信息</text>
      <view class="wd-h5-demo__panel">
        <wd-pagination v-model="page" :total-page="8" show-icon show-message />
        <view style="height: 8px" />
        <wd-pagination v-model="page" :total-page="20" :page-size="10" prev-text="上一页" next-text="下一页" />
      </view>
    </view>
  </scroll-view>
</template>
