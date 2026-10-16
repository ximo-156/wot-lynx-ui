<script setup lang="ts">
/**
 * Avatar 头像 — 文档站 H5 预览演示（手工编写）。
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
      <text class="wd-h5-demo__section-title">文字头像</text>
      <view class="wd-h5-demo__panel">
        <view class="wd-h5-demo__row">
          <wd-avatar size="32" text="A" />
          <wd-avatar size="40" text="B" />
          <wd-avatar size="48" text="C" color="#00A06D" bg-color="#E8F7F0" />
          <wd-avatar size="56" text="Lynx" shape="square" />
        </view>
      </view>
    </view>

    <view class="wd-h5-demo__section">
      <text class="wd-h5-demo__section-title">图片头像 / 图标</text>
      <view class="wd-h5-demo__panel">
        <view class="wd-h5-demo__row">
          <wd-avatar :src="placeholder" size="48" />
          <wd-avatar :src="placeholder" size="48" round />
          <wd-avatar icon="user" size="48" />
        </view>
      </view>
    </view>

    <view class="wd-h5-demo__section">
      <text class="wd-h5-demo__section-title">头像组（叠加展示）</text>
      <view class="wd-h5-demo__panel">
        <wd-avatar-group :max-count="3" size="36">
          <wd-avatar :src="placeholder" size="36" />
          <wd-avatar :src="placeholder" size="36" />
          <wd-avatar :src="placeholder" size="36" />
          <wd-avatar :src="placeholder" size="36" />
        </wd-avatar-group>
      </view>
    </view>
  </scroll-view>
</template>
