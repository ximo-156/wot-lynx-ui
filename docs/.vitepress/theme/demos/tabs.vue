<script setup lang="ts">
/**
 * Tabs 选项卡 — 文档站 H5 预览演示（手工编写）。
 */
import { ref } from 'vue'
import WdTabs from 'wot-lynx-ui/components/wd-tabs/wd-tabs.vue'
import WdTab from 'wot-lynx-ui/components/wd-tab/wd-tab.vue'

const value = ref(0)
</script>

<template>
  <scroll-view scroll-orientation="vertical" class="wd-h5-demo">
    <view class="wd-h5-demo__section">
      <text class="wd-h5-demo__section-title">基础用法</text>
      <view class="wd-h5-demo__panel">
        <wd-tabs v-model="value">
          <wd-tab title="标签一">
            <text style="font-size: 13px; color: var(var(--wot-text-secondary))">标签一的内容</text>
          </wd-tab>
          <wd-tab title="标签二">
            <text style="font-size: 13px; color: var(var(--wot-text-secondary))">标签二的内容</text>
          </wd-tab>
          <wd-tab title="标签三">
            <text style="font-size: 13px; color: var(var(--wot-text-secondary))">标签三的内容</text>
          </wd-tab>
        </wd-tabs>
        <text class="wd-h5-demo__panel-label">当前索引：{{ value }}</text>
      </view>
    </view>

    <view class="wd-h5-demo__section">
      <text class="wd-h5-demo__section-title">徽标 / 禁用 / 滑动</text>
      <view class="wd-h5-demo__panel">
        <wd-tabs v-model="value" swipeable animated>
          <wd-tab title="标签一" />
          <wd-tab title="标签二" :badge-props="{ value: 8 }" />
          <wd-tab title="标签三" disabled />
          <wd-tab title="标签四" />
        </wd-tabs>
      </view>
    </view>
  </scroll-view>
</template>
