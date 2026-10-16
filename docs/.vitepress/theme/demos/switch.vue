<script setup lang="ts">
/**
 * Switch 开关 — 文档站 H5 预览演示（手工编写）。
 */
import { ref } from 'vue'
import WdSwitch from 'wot-lynx-ui/components/wd-switch/wd-switch.vue'
import WdCell from 'wot-lynx-ui/components/wd-cell/wd-cell.vue'
import WdCellGroup from 'wot-lynx-ui/components/wd-cell-group/wd-cell-group.vue'

const value = ref(true)
const cellValue = ref(true)
</script>

<template>
  <scroll-view scroll-orientation="vertical" class="wd-h5-demo">
    <view class="wd-h5-demo__section">
      <text class="wd-h5-demo__section-title">基础用法</text>
      <view class="wd-h5-demo__panel">
        <view class="wd-h5-demo__row">
          <wd-switch v-model="value" />
          <text class="wd-h5-demo__tag">状态：{{ value }}</text>
        </view>
      </view>
    </view>

    <view class="wd-h5-demo__section">
      <text class="wd-h5-demo__section-title">尺寸 / 禁用 / 加载</text>
      <view class="wd-h5-demo__panel">
        <view class="wd-h5-demo__row">
          <wd-switch v-model="value" size="small" />
          <wd-switch v-model="value" size="medium" />
          <wd-switch v-model="value" size="large" />
        </view>
        <view class="wd-h5-demo__row">
          <wd-switch v-model="value" disabled />
          <wd-switch v-model="value" loading />
        </view>
      </view>
    </view>

    <view class="wd-h5-demo__section">
      <text class="wd-h5-demo__section-title">单元格中使用</text>
      <view class="wd-h5-demo__panel" style="padding: 0">
        <wd-cell-group border>
          <wd-cell title="开关" center>
            <template #value>
              <wd-switch v-model="cellValue" />
            </template>
          </wd-cell>
        </wd-cell-group>
      </view>
    </view>
  </scroll-view>
</template>
