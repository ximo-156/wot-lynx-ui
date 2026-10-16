<script setup lang="ts">
/**
 * RadioGroup 单选组 — 文档站 H5 预览演示（手工编写）。
 */
import { ref } from 'vue'
import WdRadio from 'wot-lynx-ui/components/wd-radio/wd-radio.vue'
import WdRadioGroup from 'wot-lynx-ui/components/wd-radio-group/wd-radio-group.vue'

const value = ref('a')
</script>

<template>
  <scroll-view scroll-orientation="vertical" class="wd-h5-demo">
    <view class="wd-h5-demo__section">
      <text class="wd-h5-demo__section-title">基础用法</text>
      <view class="wd-h5-demo__panel">
        <wd-radio-group v-model="value">
          <wd-radio value="a">选项 A</wd-radio>
          <wd-radio value="b">选项 B</wd-radio>
          <wd-radio value="c">选项 C</wd-radio>
        </wd-radio-group>
        <text class="wd-h5-demo__panel-label">已选：{{ value }}</text>
      </view>
    </view>

    <view class="wd-h5-demo__section">
      <text class="wd-h5-demo__section-title">水平排列 / 禁用</text>
      <view class="wd-h5-demo__panel">
        <wd-radio-group v-model="value" direction="horizontal">
          <wd-radio value="a">A</wd-radio>
          <wd-radio value="b">B</wd-radio>
        </wd-radio-group>
        <view class="wd-h5-demo__row" style="margin-top: 8px">
          <wd-radio value="a" disabled>禁用</wd-radio>
          <wd-radio value="b" disabled model-value>选中且禁用</wd-radio>
        </view>
      </view>
    </view>
  </scroll-view>
</template>
