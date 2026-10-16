<script setup lang="ts">
/**
 * Sidebar 侧边导航 — 文档站 H5 预览演示（手工编写）。
 */
import { ref } from 'vue'
import WdSidebar from 'wot-lynx-ui/components/wd-sidebar/wd-sidebar.vue'
import WdSidebarItem from 'wot-lynx-ui/components/wd-sidebar-item/wd-sidebar-item.vue'

const value = ref('a')
</script>

<template>
  <scroll-view scroll-orientation="vertical" class="wd-h5-demo">
    <view class="wd-h5-demo__section">
      <text class="wd-h5-demo__section-title">基础用法</text>
      <view class="wd-h5-demo__panel" style="padding: 0">
        <view class="wd-h5-demo__row" style="height: 220px; align-items: stretch; margin-bottom: 0">
          <wd-sidebar v-model="value" style="height: 100%">
            <wd-sidebar-item label="选项一" value="a" />
            <wd-sidebar-item label="选项二" value="b" />
            <wd-sidebar-item label="选项三" value="c" />
            <wd-sidebar-item label="禁用项" value="d" disabled />
          </wd-sidebar>
          <view style="flex: 1; padding: 12px; justify-content: center">
            <text class="wd-h5-demo__tag">当前：{{ value }}</text>
          </view>
        </view>
      </view>
    </view>

    <view class="wd-h5-demo__section">
      <text class="wd-h5-demo__section-title">徽标 / 点标记</text>
      <view class="wd-h5-demo__panel" style="padding: 0">
        <view class="wd-h5-demo__row" style="height: 160px; align-items: stretch; margin-bottom: 0">
          <wd-sidebar v-model="value" style="height: 100%">
            <wd-sidebar-item label="选项一" value="a" :badge="8" />
            <wd-sidebar-item label="选项二" value="b" :is-dot="true" />
            <wd-sidebar-item label="选项三" value="c" />
          </wd-sidebar>
        </view>
      </view>
    </view>
  </scroll-view>
</template>
