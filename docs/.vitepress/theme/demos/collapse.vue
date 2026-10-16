<script setup lang="ts">
/**
 * Collapse 折叠面板 — 文档站 H5 预览演示（手工编写）。
 */
import { ref } from 'vue'
import WdCollapse from 'wot-lynx-ui/components/wd-collapse/wd-collapse.vue'
import WdCollapseItem from 'wot-lynx-ui/components/wd-collapse-item/wd-collapse-item.vue'

const active = ref<string[]>(['1'])
</script>

<template>
  <scroll-view scroll-orientation="vertical" class="wd-h5-demo">
    <view class="wd-h5-demo__section">
      <text class="wd-h5-demo__section-title">基础用法</text>
      <view class="wd-h5-demo__panel" style="padding: 0">
        <wd-collapse v-model="active">
          <wd-collapse-item name="1" title="折叠面板一">内容一</wd-collapse-item>
          <wd-collapse-item name="2" title="折叠面板二">内容二</wd-collapse-item>
          <wd-collapse-item name="3" title="折叠面板三" disabled>禁用项</wd-collapse-item>
        </wd-collapse>
      </view>
    </view>

    <view class="wd-h5-demo__section">
      <text class="wd-h5-demo__section-title">手风琴模式</text>
      <view class="wd-h5-demo__panel" style="padding: 0">
        <wd-collapse v-model="active" accordion>
          <wd-collapse-item name="1" title="互斥展开 A">手风琴：同时只能展开一项</wd-collapse-item>
          <wd-collapse-item name="2" title="互斥展开 B">再展开其他项时自动收起</wd-collapse-item>
        </wd-collapse>
      </view>
    </view>
  </scroll-view>
</template>
