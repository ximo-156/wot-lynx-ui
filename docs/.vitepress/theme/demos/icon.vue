<script setup lang="ts">
/**
 * Icon 图标 — 文档站 H5 预览演示（手工编写）。
 */
import WdIcon from 'wot-lynx-ui/components/wd-icon/wd-icon.vue'
import WdLoading from 'wot-lynx-ui/components/wd-loading/wd-loading.vue'

const icons = ['setting', 'picture', 'film', 'file', 'home', 'camera', 'user', 'comment', 'notification', 'delete', 'edit', 'search']
</script>

<template>
  <scroll-view scroll-orientation="vertical" class="wd-h5-demo">
    <view class="wd-h5-demo__section">
      <text class="wd-h5-demo__section-title">基础用法</text>
      <view class="wd-h5-demo__panel">
        <view class="wd-h5-demo__row">
          <wd-icon name="setting" :size="20" />
          <wd-icon name="picture" :size="24" />
          <wd-icon name="film" :size="28" />
          <wd-icon name="file" :size="32" />
        </view>
        <text class="wd-h5-demo__panel-label">内置 180 个图标（iconfont 字体渲染）</text>
      </view>
    </view>

    <view class="wd-h5-demo__section">
      <text class="wd-h5-demo__section-title">颜色</text>
      <view class="wd-h5-demo__panel">
        <view class="wd-h5-demo__row">
          <wd-icon name="home" :size="24" color="#7F5CFF" />
          <wd-icon name="camera" :size="24" color="#00A06D" />
          <wd-icon name="user" :size="24" color="#DC4038" />
          <wd-icon name="comment" :size="24" color="#C97F10" />
        </view>
      </view>
    </view>

    <view class="wd-h5-demo__section">
      <text class="wd-h5-demo__section-title">图标墙</text>
      <view class="wd-h5-demo__panel">
        <view class="wd-h5-demo__row" style="gap: 14px">
          <view v-for="name in icons" :key="name" style="align-items: center; gap: 4px; width: 56px">
            <wd-icon :name="name" :size="22" />
            <text style="font-size: 10px; color: var(var(--wot-text-auxiliary))">{{ name }}</text>
          </view>
        </view>
      </view>
    </view>

    <view class="wd-h5-demo__section">
      <text class="wd-h5-demo__section-title">Loading 加载</text>
      <view class="wd-h5-demo__panel">
        <view class="wd-h5-demo__row">
          <wd-loading type="circular" size="24px" />
          <wd-loading type="spinner" size="24px" />
          <wd-loading type="dots" size="24px" />
          <wd-loading type="wave" size="24px" />
        </view>
        <view class="wd-h5-demo__row">
          <wd-loading type="circular" size="20px" color="#7F5CFF" text="加载中" />
          <wd-loading type="dots" size="20px" direction="horizontal" text="横向" />
        </view>
      </view>
    </view>
  </scroll-view>
</template>
