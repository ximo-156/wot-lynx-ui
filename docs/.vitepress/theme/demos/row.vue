<script setup lang="ts">
/**
 * Row 行布局 — 文档站 H5 预览演示（手工编写）。
 */
import WdRow from 'wot-lynx-ui/components/wd-row/wd-row.vue'
import WdCol from 'wot-lynx-ui/components/wd-col/wd-col.vue'
</script>

<template>
  <scroll-view scroll-orientation="vertical" class="wd-h5-demo">
    <view class="wd-h5-demo__section">
      <text class="wd-h5-demo__section-title">gutter 列间距</text>
      <view class="wd-h5-demo__panel">
        <wd-row :gutter="12" style="margin-bottom: 8px">
          <wd-col span="8" style="background: var(--wd-color-primary-bg); padding: 8px; border-radius: 6px">
            <text class="wd-h5-demo__tag">8</text>
          </wd-col>
          <wd-col span="8" style="background: var(--wd-color-primary-bg); padding: 8px; border-radius: 6px">
            <text class="wd-h5-demo__tag">8</text>
          </wd-col>
          <wd-col span="8" style="background: var(--wd-color-primary-bg); padding: 8px; border-radius: 6px">
            <text class="wd-h5-demo__tag">8</text>
          </wd-col>
        </wd-row>
      </view>
    </view>

    <view class="wd-h5-demo__section">
      <text class="wd-h5-demo__section-title">justify 水平排列</text>
      <view class="wd-h5-demo__panel">
        <wd-row justify="space-between" style="margin-bottom: 8px">
          <wd-col span="6" style="background: var(--wd-color-primary-bg); padding: 8px; border-radius: 6px">
            <text class="wd-h5-demo__tag">6</text>
          </wd-col>
          <wd-col span="6" style="background: var(--wd-color-primary-bg); padding: 8px; border-radius: 6px">
            <text class="wd-h5-demo__tag">6</text>
          </wd-col>
        </wd-row>
        <wd-row justify="center">
          <wd-col span="8" style="background: var(--wd-color-primary-bg); padding: 8px; border-radius: 6px">
            <text class="wd-h5-demo__tag">居中</text>
          </wd-col>
        </wd-row>
      </view>
    </view>

    <view class="wd-h5-demo__section">
      <text class="wd-h5-demo__section-title">align 垂直对齐</text>
      <view class="wd-h5-demo__panel">
        <wd-row align="bottom" style="height: 64px; background: var(--wd-bg-secondary); border-radius: 6px">
          <wd-col span="12" style="background: var(--wd-color-primary-bg); padding: 8px; border-radius: 6px">
            <text class="wd-h5-demo__tag">底部对齐</text>
          </wd-col>
          <wd-col span="12" style="background: var(--wd-color-primary-bg); padding: 8px; border-radius: 6px">
            <text class="wd-h5-demo__tag">align="bottom"</text>
          </wd-col>
        </wd-row>
      </view>
    </view>
  </scroll-view>
</template>
