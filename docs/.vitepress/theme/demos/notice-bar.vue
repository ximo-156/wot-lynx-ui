<script setup lang="ts">
/**
 * NoticeBar 通知栏 — 文档站 H5 预览演示（手工编写）。
 */
import WdNoticeBar from 'wot-lynx-ui/components/wd-notice-bar/wd-notice-bar.vue'
</script>

<template>
  <scroll-view scroll-orientation="vertical" class="wd-h5-demo">
    <view class="wd-h5-demo__section">
      <text class="wd-h5-demo__section-title">基础用法</text>
      <view class="wd-h5-demo__panel">
        <wd-notice-bar text="这是一条通知栏提示，可横向滚动展示" prefix="notification" />
      </view>
    </view>

    <view class="wd-h5-demo__section">
      <text class="wd-h5-demo__section-title">类型 / 可关闭 / 多行</text>
      <view class="wd-h5-demo__panel">
        <wd-notice-bar text="成功类型通知" type="success" prefix="success" />
        <wd-notice-bar text="警告类型通知" type="warning" prefix="warning" />
        <wd-notice-bar text="错误类型通知" type="error" prefix="delete" />
        <wd-notice-bar text="这条通知可以被手动关闭" prefix="notification" closable />
        <wd-notice-bar
          text="这是一段较长的通知文本，开启 wrap 之后会自动换行展示，不会出现横向滚动，适合内容较多的场景。"
          wrapable
        />
      </view>
    </view>
  </scroll-view>
</template>
