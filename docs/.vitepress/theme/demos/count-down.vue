<script setup lang="ts">
/**
 * CountDown 倒计时 — 文档站 H5 预览演示（手工编写）。
 */
import WdCountDown from 'wot-lynx-ui/components/wd-count-down/wd-count-down.vue'
</script>

<template>
  <scroll-view scroll-orientation="vertical" class="wd-h5-demo">
    <view class="wd-h5-demo__section">
      <text class="wd-h5-demo__section-title">基础用法</text>
      <view class="wd-h5-demo__panel">
        <wd-count-down :time="60000" format="mm:ss" />
      </view>
    </view>

    <view class="wd-h5-demo__section">
      <text class="wd-h5-demo__section-title">毫秒 / 自定义格式</text>
      <view class="wd-h5-demo__panel">
        <wd-count-down :time="3600000" format="HH:mm:ss" />
        <view style="height: 8px" />
        <wd-count-down :time="30000" millisecond format="ss:SSS" />
        <view style="height: 8px" />
        <wd-count-down :time="86400000" format="DD 天 HH 时 mm 分" />
      </view>
    </view>
  </scroll-view>
</template>
