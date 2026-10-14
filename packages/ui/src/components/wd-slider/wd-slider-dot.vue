/*
 * wd-slider-dot — 滑块内部内容（气泡 + 手柄）
 */
<script setup lang="ts">
import WdIcon from '../wd-icon/wd-icon.vue'

defineProps<{
  /** 滑块索引 */
  index: number
  /** 气泡是否显示 */
  popoverVisible: boolean
  /** 气泡展示值 */
  displayValue: number
}>()
</script>

<template>
  <view v-if="popoverVisible" class="wd-slider__dot-popover is-visible">
    <text class="wd-slider__dot-popover-text">{{ displayValue }}</text>
    <view class="wd-slider__dot-popover-arrow" />
  </view>
  <view class="wd-slider__dot-slider">
    <WdIcon name="multiple-horizontal" size="14px" color="#868a9c" />
  </view>
</template>
