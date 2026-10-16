<script setup lang="ts">
/**
 * ImagePreview 图片预览 — 文档站 H5 预览演示（手工编写）。
 */
import { ref } from 'vue'
import WdImagePreview from 'wot-lynx-ui/components/wd-image-preview/wd-image-preview.vue'
import WdButton from 'wot-lynx-ui/components/wd-button/wd-button.vue'

const previewRef = ref<any>(null)

// 内联 SVG 占位图（离线可渲染）
const img = (text: string, bg: string) =>
  'data:image/svg+xml,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480"><rect width="640" height="480" fill="${bg}"/><text x="320" y="250" font-size="44" fill="#fff" text-anchor="middle">${text}</text></svg>`
  )

const images = [img('图片一', '#7F5CFF'), img('图片二', '#00A06D'), img('图片三', '#C97F10')]

function open() {
  previewRef.value?.open({ images, startPosition: 0 })
}
</script>

<template>
  <scroll-view scroll-orientation="vertical" class="wd-h5-demo">
    <view class="wd-h5-demo__section">
      <text class="wd-h5-demo__section-title">命令式调用</text>
      <view class="wd-h5-demo__panel">
        <view class="wd-h5-demo__row">
          <wd-button size="small" type="primary" @tap="open">预览图片</wd-button>
        </view>
        <text class="wd-h5-demo__panel-label">共 {{ images.length }} 张，支持滑动切换</text>
      </view>
    </view>

    <wd-image-preview ref="previewRef" selector="preview-image" />
  </scroll-view>
</template>
