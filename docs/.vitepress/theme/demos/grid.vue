<script setup lang="ts">
/**
 * Grid 宫格 — 文档站 H5 预览演示（手工编写）。
 */
import WdGrid from '@wot-lynx/ui-layout/wd-grid'
import WdGridItem from '@wot-lynx/ui-layout/wd-grid-item'
import WdBadge from '@wot-lynx/primitives/wd-badge'
</script>

<template>
  <scroll-view scroll-orientation="vertical" class="wd-h5-demo">
    <view class="wd-h5-demo__section">
      <text class="wd-h5-demo__section-title">基础用法（3 列）</text>
      <view class="wd-h5-demo__panel">
        <wd-grid :column="3">
          <wd-grid-item icon="picture" text="图片" />
          <wd-grid-item icon="film" text="视频" />
          <wd-grid-item icon="file" text="文件" />
          <wd-grid-item icon="home" text="首页" />
          <wd-grid-item icon="camera" text="相机" />
          <wd-grid-item icon="user" text="我的" />
        </wd-grid>
      </view>
    </view>

    <view class="wd-h5-demo__section">
      <text class="wd-h5-demo__section-title">4 列 + 徽标 + 无边框</text>
      <view class="wd-h5-demo__panel">
        <wd-grid :column="4" border>
          <wd-grid-item icon="picture" text="图片" />
          <wd-grid-item icon="film" text="视频" />
          <wd-grid-item icon="file" text="文件" />
          <wd-grid-item icon="home" text="首页" />
        </wd-grid>
        <view style="height: 12px" />
        <wd-grid :column="4" :border="false">
          <wd-grid-item icon="picture" text="图片" />
          <wd-grid-item icon="film" text="视频" />
          <wd-grid-item icon="file" text="文件" />
          <wd-grid-item icon="home" text="首页" />
        </wd-grid>
      </view>
    </view>
  </scroll-view>
</template>
