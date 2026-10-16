<script setup lang="ts">
/**
 * Empty 空状态 — 文档站 H5 预览演示（手工编写）。
 */
import WdEmpty from 'wot-lynx-ui/components/wd-empty/wd-empty.vue'
import WdButton from 'wot-lynx-ui/components/wd-button/wd-button.vue'
</script>

<template>
  <scroll-view scroll-orientation="vertical" class="wd-h5-demo">
    <view class="wd-h5-demo__section">
      <text class="wd-h5-demo__section-title">基础用法</text>
      <view class="wd-h5-demo__panel">
        <wd-empty tip="暂无数据" />
      </view>
    </view>

    <view class="wd-h5-demo__section">
      <text class="wd-h5-demo__section-title">自定义图标</text>
      <view class="wd-h5-demo__panel">
        <view class="wd-h5-demo__row" style="align-items: flex-start">
          <wd-empty icon="delete" :icon-size="56" tip="购物车是空的" style="flex: 1" />
          <wd-empty icon="setting" :icon-size="56" tip="没有搜索结果" style="flex: 1" />
        </view>
      </view>
    </view>

    <view class="wd-h5-demo__section">
      <text class="wd-h5-demo__section-title">底部插槽</text>
      <view class="wd-h5-demo__panel">
        <wd-empty tip="还没有订单" icon="picture" :icon-size="56">
          <template #bottom>
            <wd-button size="small" type="primary">去下单</wd-button>
          </template>
        </wd-empty>
      </view>
    </view>
  </scroll-view>
</template>
