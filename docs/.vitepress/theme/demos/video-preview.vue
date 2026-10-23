<script setup lang="ts">
/**
 * VideoPreview 视频预览 — 文档站 H5 预览演示（手工编写）。
 */
import { ref } from 'vue'
import WdVideoPreview from 'wot-lynx-ui/components/wd-video-preview/wd-video-preview.vue'
import WdButton from 'wot-lynx-ui/primitives/wd-button/wd-button.vue'

const previewRef = ref<any>(null)

// 内联 SVG 海报占位图（离线可渲染）
const poster =
  'data:image/svg+xml,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><rect width="640" height="360" fill="#1D1D1F"/><polygon points="290,150 290,210 350,180" fill="#fff"/></svg>'
  )

// 示例视频（公共测试源）
const url = 'https://www.w3schools.com/html/mov_bbb.mp4'

function open() {
  previewRef.value?.open({ url, poster, title: '示例视频' })
}
</script>

<template>
  <scroll-view scroll-orientation="vertical" class="wd-h5-demo">
    <view class="wd-h5-demo__section">
      <text class="wd-h5-demo__section-title">命令式调用</text>
      <view class="wd-h5-demo__panel">
        <view class="wd-h5-demo__row">
          <wd-button size="small" type="primary" @tap="open">播放视频</wd-button>
        </view>
        <text class="wd-h5-demo__panel-label">使用公共测试视频源，需联网</text>
      </view>
    </view>

    <wd-video-preview ref="previewRef" selector="preview-video" />
  </scroll-view>
</template>
