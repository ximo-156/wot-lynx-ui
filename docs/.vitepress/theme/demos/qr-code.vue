<script setup lang="ts">
/**
 * QRCode 二维码 — 文档站 H5 预览演示（手工编写）。
 */
import WdQrCode from 'wot-lynx-ui/components/wd-qr-code/wd-qr-code.vue'
import WdBarCode from 'wot-lynx-ui/components/wd-bar-code/wd-bar-code.vue'
</script>

<template>
  <scroll-view scroll-orientation="vertical" class="wd-h5-demo">
    <view class="wd-h5-demo__section">
      <text class="wd-h5-demo__section-title">二维码</text>
      <view class="wd-h5-demo__panel">
        <view class="wd-h5-demo__row" style="justify-content: space-around">
          <wd-qr-code text="https://wot-ui.cn" :size="120" />
          <wd-qr-code text="https://wot-ui.cn" :size="120" color="#1C64FD" />
        </view>
      </view>
    </view>

    <view class="wd-h5-demo__section">
      <text class="wd-h5-demo__section-title">条形码</text>
      <view class="wd-h5-demo__panel">
        <view class="wd-h5-demo__row" style="justify-content: center">
          <wd-bar-code text="1234567890128" :width="180" :height="60" />
        </view>
      </view>
    </view>
  </scroll-view>
</template>
