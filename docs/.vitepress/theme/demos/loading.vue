<script setup lang="ts">
/**
 * Loading 加载 — 文档站 H5 预览演示（手工编写）。
 */
import WdLoading from 'wot-lynx-ui/components/wd-loading/wd-loading.vue'
import WdButton from 'wot-lynx-ui/components/wd-button/wd-button.vue'
import { ref } from 'vue'

const loading = ref(false)
</script>

<template>
  <scroll-view scroll-orientation="vertical" class="wd-h5-demo">
    <view class="wd-h5-demo__section">
      <text class="wd-h5-demo__section-title">类型</text>
      <view class="wd-h5-demo__panel">
        <view class="wd-h5-demo__row">
          <wd-loading type="circular" size="24px" />
          <wd-loading type="spinner" size="24px" />
          <wd-loading type="dots" size="24px" />
          <wd-loading type="wave" size="24px" />
        </view>
      </view>
    </view>

    <view class="wd-h5-demo__section">
      <text class="wd-h5-demo__section-title">颜色 / 方向 / 文字</text>
      <view class="wd-h5-demo__panel">
        <view class="wd-h5-demo__row">
          <wd-loading type="circular" size="20px" color="#7F5CFF" text="加载中" />
          <wd-loading type="dots" size="20px" direction="horizontal" text="横向" />
        </view>
      </view>
    </view>

    <view class="wd-h5-demo__section">
      <text class="wd-h5-demo__section-title">按钮内使用</text>
      <view class="wd-h5-demo__panel">
        <view class="wd-h5-demo__row">
          <wd-button type="primary" :loading="loading" @tap="loading = !loading">{{
            loading ? '加载中' : '点击加载'
          }}</wd-button>
        </view>
      </view>
    </view>
  </scroll-view>
</template>
