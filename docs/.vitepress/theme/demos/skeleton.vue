<script setup lang="ts">
/**
 * Skeleton 骨架屏 — 文档站 H5 预览演示（手工编写）。
 */
import { ref } from 'vue'
import WdSkeleton from 'wot-lynx-ui/components/wd-skeleton/wd-skeleton.vue'
import WdButton from 'wot-lynx-ui/primitives/wd-button/wd-button.vue'

const loading = ref(true)
const rowCol = ref<Array<number | Record<string, string>>>([{ width: '40%' }, 3, { width: '96px', height: '96px' }])
</script>

<template>
  <scroll-view scroll-orientation="vertical" class="wd-h5-demo">
    <view class="wd-h5-demo__section">
      <text class="wd-h5-demo__section-title">动画类型</text>
      <view class="wd-h5-demo__panel">
        <view class="wd-h5-demo__row" style="align-items: flex-start">
          <wd-skeleton animation="gradient" style="flex: 1" />
          <wd-skeleton animation="flashing" style="flex: 1" />
          <wd-skeleton animation="pulse" style="flex: 1" />
          <wd-skeleton animation="none" style="flex: 1" />
        </view>
      </view>
    </view>

    <view class="wd-h5-demo__section">
      <text class="wd-h5-demo__section-title">行列配置 / 圆角</text>
      <view class="wd-h5-demo__panel">
        <wd-skeleton :row-col="rowCol" animation="flashing" round />
      </view>
    </view>

    <view class="wd-h5-demo__section">
      <text class="wd-h5-demo__section-title">loading 控制真实内容</text>
      <view class="wd-h5-demo__panel">
        <wd-skeleton :loading="loading" :row-col="[2]">
          <text class="wd-h5-demo__tag">内容加载完成</text>
        </wd-skeleton>
        <view class="wd-h5-demo__row" style="margin-top: 8px">
          <wd-button size="small" @tap="loading = !loading">切换 loading</wd-button>
          <text class="wd-h5-demo__tag">loading: {{ loading }}</text>
        </view>
      </view>
    </view>
  </scroll-view>
</template>
