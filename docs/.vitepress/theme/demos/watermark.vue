<script setup lang="ts">
/**
 * Watermark 水印 — 文档站 H5 预览演示（手工编写）。
 */
import WdWatermark from 'wot-lynx-ui/components/wd-watermark/wd-watermark.vue'
import WdCell from 'wot-lynx-ui/primitives/wd-cell/wd-cell.vue'
import WdCellGroup from 'wot-lynx-ui/components/wd-cell-group/wd-cell-group.vue'
</script>

<template>
  <scroll-view scroll-orientation="vertical" class="wd-h5-demo">
    <view class="wd-h5-demo__section">
      <text class="wd-h5-demo__section-title">文字水印</text>
      <view class="wd-h5-demo__panel" style="padding: 0">
        <wd-watermark content="wot-lynx-ui" :font-size="14" color="rgba(0,0,0,0.08)">
          <wd-cell-group>
            <wd-cell title="单元格一" value="内容" />
            <wd-cell title="单元格二" value="内容" />
            <wd-cell title="单元格三" value="内容" />
            <wd-cell title="单元格四" value="内容" />
          </wd-cell-group>
        </wd-watermark>
      </view>
    </view>
  </scroll-view>
</template>
