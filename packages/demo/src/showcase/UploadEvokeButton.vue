<script setup lang="ts">
import './UploadEvokeButton.css'

import WdIcon from 'wot-lynx-ui/primitives/wd-icon'

/*
 * 上传唤起项只负责外观，点击交给父级 Upload 的 beforeChoose / chooseMedia
 * 链路。Lynx 原生 input 不支持 file 类型：透明 input 仍会聚焦并弹出输入法。
 * Web 的 x-input 也不提供可用文件回传，不能拿浏览器输入框冒充原生选图。
 * 相册 / 拍照由宿主的 Native Module、JS Module 或 configureHost 能力提供。
 */
defineProps<{
  count: number
  limit: number
}>()
</script>

<template>
  <view class="demo-upload-evoke">
    <view class="demo-upload-evoke__body" :user-interaction-enabled="false">
      <WdIcon name="camera" custom-class="demo-upload-evoke__icon" />
      <text class="demo-upload-evoke__num">（{{ count }}/{{ limit }}）</text>
    </view>
  </view>
</template>
