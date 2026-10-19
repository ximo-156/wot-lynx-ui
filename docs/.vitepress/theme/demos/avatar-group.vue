<script setup lang="ts">
/**
 * AvatarGroup 头像组 — 文档站 H5 预览演示（手工编写）。
 */
import WdAvatar from 'wot-lynx-ui/components/wd-avatar/wd-avatar.vue'
import WdAvatarGroup from 'wot-lynx-ui/components/wd-avatar-group/wd-avatar-group.vue'

// 内联 SVG 占位图（离线可渲染）
const placeholder =
  'data:image/svg+xml,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" fill="#7F5CFF"/><text x="40" y="48" font-size="28" fill="#fff" text-anchor="middle">图</text></svg>'
  )
</script>

<template>
  <scroll-view scroll-orientation="vertical" class="wd-h5-demo">
    <view class="wd-h5-demo__section">
      <text class="wd-h5-demo__section-title">基础用法（叠加展示）</text>
      <view class="wd-h5-demo__panel">
        <wd-avatar-group size="40">
          <wd-avatar :src="placeholder" size="40" />
          <wd-avatar :src="placeholder" size="40" />
          <wd-avatar :src="placeholder" size="40" />
          <wd-avatar :src="placeholder" size="40" />
        </wd-avatar-group>
      </view>
    </view>

    <view class="wd-h5-demo__section">
      <text class="wd-h5-demo__section-title">maxCount 截断</text>
      <view class="wd-h5-demo__panel">
        <wd-avatar-group :max-count="3" size="40">
          <wd-avatar :src="placeholder" size="40" />
          <wd-avatar :src="placeholder" size="40" />
          <wd-avatar :src="placeholder" size="40" />
          <wd-avatar :src="placeholder" size="40" />
          <wd-avatar :src="placeholder" size="40" />
        </wd-avatar-group>
      </view>
    </view>

    <view class="wd-h5-demo__section">
      <text class="wd-h5-demo__section-title">文字头像 / 方形</text>
      <view class="wd-h5-demo__panel">
        <wd-avatar-group :max-count="4" size="40" shape="square">
          <wd-avatar text="A" size="40" />
          <wd-avatar text="B" size="40" />
          <wd-avatar text="C" size="40" />
          <wd-avatar text="D" size="40" />
          <wd-avatar text="E" size="40" />
        </wd-avatar-group>
      </view>
    </view>
  </scroll-view>
</template>
