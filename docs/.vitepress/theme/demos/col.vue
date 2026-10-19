<script setup lang="ts">
/**
 * Col 列布局 — 文档站 H5 预览演示（手工编写）。
 */
import WdRow from 'wot-lynx-ui/components/wd-row/wd-row.vue'
import WdCol from 'wot-lynx-ui/components/wd-col/wd-col.vue'
</script>

<template>
  <scroll-view scroll-orientation="vertical" class="wd-h5-demo">
    <view class="wd-h5-demo__section">
      <text class="wd-h5-demo__section-title">span 占据数（24 制）</text>
      <view class="wd-h5-demo__panel">
        <wd-row style="margin-bottom: 8px">
          <wd-col span="24" style="background: var(var(--wot-primary-1)); padding: 8px; border-radius: 6px">
            <text class="wd-h5-demo__tag">span 24</text>
          </wd-col>
        </wd-row>
        <wd-row style="margin-bottom: 8px">
          <wd-col span="12" style="background: var(var(--wot-primary-1)); padding: 8px; border-radius: 6px">
            <text class="wd-h5-demo__tag">span 12</text>
          </wd-col>
          <wd-col span="12" style="background: var(var(--wot-primary-1)); padding: 8px; border-radius: 6px">
            <text class="wd-h5-demo__tag">span 12</text>
          </wd-col>
        </wd-row>
        <text class="wd-h5-demo__panel-label">offset 左侧偏移</text>
        <wd-row>
          <wd-col span="6" offset="6" style="background: var(var(--wot-primary-1)); padding: 8px; border-radius: 6px">
            <text class="wd-h5-demo__tag">offset 6</text>
          </wd-col>
          <wd-col span="6" offset="6" style="background: var(var(--wot-primary-1)); padding: 8px; border-radius: 6px">
            <text class="wd-h5-demo__tag">offset 6</text>
          </wd-col>
        </wd-row>
      </view>
    </view>
  </scroll-view>
</template>
