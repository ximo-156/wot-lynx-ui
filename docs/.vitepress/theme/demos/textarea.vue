<script setup lang="ts">
/**
 * Textarea 文本域 — 文档站 H5 预览演示（手工编写）。
 */
import { ref } from 'vue'
import WdTextarea from 'wot-lynx-ui/components/wd-textarea/wd-textarea.vue'

const value = ref('')
</script>

<template>
  <scroll-view scroll-orientation="vertical" class="wd-h5-demo">
    <view class="wd-h5-demo__section">
      <text class="wd-h5-demo__section-title">基础用法</text>
      <view class="wd-h5-demo__panel">
        <wd-textarea v-model="value" placeholder="多行输入" style="flex: 1" />
        <text class="wd-h5-demo__panel-label">已输入 {{ value.length }} 字</text>
      </view>
    </view>

    <view class="wd-h5-demo__section">
      <text class="wd-h5-demo__section-title">字数统计 + 高度自适应</text>
      <view class="wd-h5-demo__panel">
        <wd-textarea
          v-model="value"
          placeholder="最多输入 50 字"
          :maxlength="50"
          :show-word-limit="true"
          auto-height
          style="flex: 1"
        />
      </view>
    </view>
  </scroll-view>
</template>
