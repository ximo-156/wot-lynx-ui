<script setup lang="ts">
/**
 * Badge 徽标 — 文档站 H5 预览演示（手工编写）。
 */
import WdBadge from 'wot-lynx-ui/components/wd-badge/wd-badge.vue'
import WdAvatar from 'wot-lynx-ui/components/wd-avatar/wd-avatar.vue'
import WdButton from 'wot-lynx-ui/components/wd-button/wd-button.vue'
</script>

<template>
  <scroll-view scroll-orientation="vertical" class="wd-h5-demo">
    <view class="wd-h5-demo__section">
      <text class="wd-h5-demo__section-title">基础用法</text>
      <view class="wd-h5-demo__panel">
        <view class="wd-h5-demo__row">
          <wd-badge :value="8">
            <wd-avatar size="36" text="A" />
          </wd-badge>
          <wd-badge :value="56">
            <wd-avatar size="36" text="评" />
          </wd-badge>
          <wd-badge is-dot>
            <wd-avatar size="36" text="点" />
          </wd-badge>
          <wd-badge :value="99" :max="9">
            <wd-avatar size="36" text="多" />
          </wd-badge>
        </view>
      </view>
    </view>

    <view class="wd-h5-demo__section">
      <text class="wd-h5-demo__section-title">最大值 / 独立使用</text>
      <view class="wd-h5-demo__panel">
        <view class="wd-h5-demo__row">
          <wd-badge :value="200" :max="99">
            <wd-button size="small">消息</wd-button>
          </wd-badge>
          <wd-badge :value="8" type="primary" />
          <wd-badge :value="8" type="success" />
          <wd-badge :value="8" type="warning" />
          <wd-badge :value="8" :top="4" :right="4" />
        </view>
      </view>
    </view>
  </scroll-view>
</template>
