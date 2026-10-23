<script setup lang="ts">
/**
 * Card 卡片 — 文档站 H5 预览演示（手工编写）。
 */
import WdCard from 'wot-lynx-ui/components/wd-card/wd-card.vue'
import WdButton from 'wot-lynx-ui/primitives/wd-button/wd-button.vue'
</script>

<template>
  <scroll-view scroll-orientation="vertical" class="wd-h5-demo">
    <view class="wd-h5-demo__section">
      <text class="wd-h5-demo__section-title">基础用法</text>
      <wd-card title="卡片标题">
        <text style="font-size: 13px; color: var(var(--wot-text-secondary))">这是卡片内容区域，支持任意节点嵌套。</text>
      </wd-card>
    </view>

    <view class="wd-h5-demo__section">
      <text class="wd-h5-demo__section-title">描述 / 页脚</text>
      <wd-card title="服务订阅">
        <text style="font-size: 13px; color: var(var(--wot-text-secondary))">含 12 次专家咨询。</text>
        <template #footer>
          <view class="wd-h5-demo__row wd-h5-demo__row--block">
            <wd-button size="small" type="primary" block>立即续费</wd-button>
          </view>
        </template>
      </wd-card>
    </view>
  </scroll-view>
</template>
