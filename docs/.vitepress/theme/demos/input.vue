<script setup lang="ts">
/**
 * Input 输入框 — 文档站 H5 预览演示（手工编写）。
 */
import { ref } from 'vue'
import WdInput from 'wot-lynx-ui/primitives/wd-input/wd-input.vue'
import WdButton from 'wot-lynx-ui/primitives/wd-button/wd-button.vue'

const value = ref('')
const disabledValue = ref('禁用状态')
</script>

<template>
  <scroll-view scroll-orientation="vertical" class="wd-h5-demo">
    <view class="wd-h5-demo__section">
      <text class="wd-h5-demo__section-title">基础用法</text>
      <view class="wd-h5-demo__panel">
        <wd-input v-model="value" placeholder="请输入内容" clearable style="flex: 1" />
        <text class="wd-h5-demo__panel-label">输入值：{{ value || '（空）' }}</text>
      </view>
    </view>

    <view class="wd-h5-demo__section">
      <text class="wd-h5-demo__section-title">带图标 / 密码 / 禁用</text>
      <view class="wd-h5-demo__panel">
        <wd-input v-model="value" placeholder="前缀图标" prefix-icon="setting" style="flex: 1" />
        <wd-input v-model="value" placeholder="密码输入" show-password style="flex: 1" />
        <wd-input v-model="disabledValue" placeholder="禁用" disabled style="flex: 1" />
        <wd-input v-model="value" placeholder="只读" readonly style="flex: 1" />
      </view>
    </view>

    <view class="wd-h5-demo__section">
      <text class="wd-h5-demo__section-title">字数统计</text>
      <view class="wd-h5-demo__panel">
        <wd-input v-model="value" placeholder="最多输入 20 字" :maxlength="20" show-word-limit style="flex: 1" />
        <view class="wd-h5-demo__row">
          <wd-button size="small" type="primary" @tap="value = ''">清空</wd-button>
        </view>
      </view>
    </view>
  </scroll-view>
</template>
