<script setup lang="ts">
/**
 * Text 文本 — 文档站 H5 预览演示（手工编写）。
 */
import WdText from 'wot-lynx-ui/components/wd-text/wd-text.vue'
import WdDivider from 'wot-lynx-ui/components/wd-divider/wd-divider.vue'
</script>

<template>
  <scroll-view scroll-orientation="vertical" class="wd-h5-demo">
    <view class="wd-h5-demo__section">
      <text class="wd-h5-demo__section-title">类型</text>
      <view class="wd-h5-demo__panel">
        <view class="wd-h5-demo__row">
          <wd-text text="主文本" />
          <wd-text text="品牌色" type="primary" />
          <wd-text text="成功" type="success" />
          <wd-text text="危险" type="error" />
          <wd-text text="粗体" bold />
        </view>
      </view>
    </view>

    <view class="wd-h5-demo__section">
      <text class="wd-h5-demo__section-title">格式化模式</text>
      <view class="wd-h5-demo__panel">
        <view class="wd-h5-demo__row">
          <wd-text mode="price" text="1234567.89" />
          <wd-text mode="phone" format text="22644212509" />
          <wd-text mode="date" text="1735689600000" />
        </view>
      </view>
    </view>

    <view class="wd-h5-demo__section">
      <text class="wd-h5-demo__section-title">行数限制 / 前后缀</text>
      <view class="wd-h5-demo__panel">
        <wd-text
          text="这是一段较长的文本，用于演示 lines 行数限制与省略效果，超出部分会以省略号结尾。"
          :lines="2"
        />
        <view style="height: 8px" />
        <wd-text text="99" prefix="¥" suffix="元" type="primary" size="18" />
      </view>
    </view>

    <view class="wd-h5-demo__section">
      <wd-divider>分割线</wd-divider>
    </view>
  </scroll-view>
</template>
