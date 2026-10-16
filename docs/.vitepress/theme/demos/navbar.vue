<script setup lang="ts">
/**
 * Navbar 导航栏 — 文档站 H5 预览演示（手工编写）。
 */
import WdNavbar from 'wot-lynx-ui/components/wd-navbar/wd-navbar.vue'
import WdNavbarCapsule from 'wot-lynx-ui/components/wd-navbar-capsule/wd-navbar-capsule.vue'
</script>

<template>
  <scroll-view scroll-orientation="vertical" class="wd-h5-demo">
    <view class="wd-h5-demo__section">
      <text class="wd-h5-demo__section-title">标题 + 左侧箭头 + 下边框</text>
      <view class="wd-h5-demo__panel" style="padding: 0; overflow: hidden">
        <wd-navbar title="标题" left-arrow bordered @click-left="console.log('[preview] left')" />
      </view>
    </view>

    <view class="wd-h5-demo__section">
      <text class="wd-h5-demo__section-title">左侧文字 + 右侧文字</text>
      <view class="wd-h5-demo__panel" style="padding: 0; overflow: hidden">
        <wd-navbar title="标题" left-text="返回" right-text="设置" />
      </view>
    </view>

    <view class="wd-h5-demo__section">
      <text class="wd-h5-demo__section-title">胶囊按钮（capsule 插槽）</text>
      <view class="wd-h5-demo__panel" style="padding: 0; overflow: hidden">
        <wd-navbar title="标题">
          <template #capsule>
            <wd-navbar-capsule @back="console.log('[preview] back')" @home="console.log('[preview] home')" />
          </template>
        </wd-navbar>
      </view>
    </view>
  </scroll-view>
</template>
