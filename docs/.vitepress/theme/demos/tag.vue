<script setup lang="ts">
/**
 * Tag 标签 — 文档站 H5 预览演示（手工编写）。
 */
import WdTag from 'wot-lynx-ui/components/wd-tag/wd-tag.vue'
</script>

<template>
  <scroll-view scroll-orientation="vertical" class="wd-h5-demo">
    <view class="wd-h5-demo__section">
      <text class="wd-h5-demo__section-title">类型</text>
      <view class="wd-h5-demo__panel">
        <view class="wd-h5-demo__row">
          <wd-tag type="default">默认</wd-tag>
          <wd-tag type="primary">主要</wd-tag>
          <wd-tag type="success">成功</wd-tag>
          <wd-tag type="warning">警告</wd-tag>
          <wd-tag type="danger">危险</wd-tag>
        </view>
      </view>
    </view>

    <view class="wd-h5-demo__section">
      <text class="wd-h5-demo__section-title">变体 / 形状</text>
      <view class="wd-h5-demo__panel">
        <view class="wd-h5-demo__row">
          <wd-tag type="primary" variant="light">浅色</wd-tag>
          <wd-tag type="primary" variant="dark">深色</wd-tag>
          <wd-tag type="primary" variant="plain">朴素</wd-tag>
          <wd-tag type="primary" variant="dashed">虚线</wd-tag>
          <wd-tag type="primary" variant="text">文字</wd-tag>
        </view>
        <view class="wd-h5-demo__row">
          <wd-tag type="primary" round>圆角</wd-tag>
          <wd-tag type="primary" size="small">小号</wd-tag>
          <wd-tag type="primary" size="large">大号</wd-tag>
        </view>
      </view>
    </view>

    <view class="wd-h5-demo__section">
      <text class="wd-h5-demo__section-title">图标 / 可关闭</text>
      <view class="wd-h5-demo__panel">
        <view class="wd-h5-demo__row">
          <wd-tag type="primary" icon="setting">图标</wd-tag>
          <wd-tag type="danger" closable @close="console.log('[preview] tag close')">可关闭</wd-tag>
        </view>
      </view>
    </view>
  </scroll-view>
</template>
