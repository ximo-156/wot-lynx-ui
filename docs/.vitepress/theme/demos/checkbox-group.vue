<script setup lang="ts">
/**
 * CheckboxGroup 多选组 — 文档站 H5 预览演示（手工编写）。
 */
import { ref } from 'vue'
import WdCheckbox from 'wot-lynx-ui/components/wd-checkbox/wd-checkbox.vue'
import WdCheckboxGroup from 'wot-lynx-ui/components/wd-checkbox-group/wd-checkbox-group.vue'

const values = ref<string[]>(['a'])
</script>

<template>
  <scroll-view scroll-orientation="vertical" class="wd-h5-demo">
    <view class="wd-h5-demo__section">
      <text class="wd-h5-demo__section-title">基础用法</text>
      <view class="wd-h5-demo__panel">
        <wd-checkbox-group v-model="values">
          <wd-checkbox name="a">选项 A</wd-checkbox>
          <wd-checkbox name="b">选项 B</wd-checkbox>
          <wd-checkbox name="c">选项 C</wd-checkbox>
        </wd-checkbox-group>
        <text class="wd-h5-demo__panel-label">已选：{{ values.join('、') || '（无）' }}</text>
      </view>
    </view>

    <view class="wd-h5-demo__section">
      <text class="wd-h5-demo__section-title">水平排列 / 形状 / 禁用</text>
      <view class="wd-h5-demo__panel">
        <wd-checkbox-group v-model="values" direction="horizontal">
          <wd-checkbox name="a">A</wd-checkbox>
          <wd-checkbox name="b">B</wd-checkbox>
        </wd-checkbox-group>
        <view class="wd-h5-demo__row" style="margin-top: 8px">
          <wd-checkbox-group v-model="values" direction="horizontal" shape="square">
            <wd-checkbox name="a">方形</wd-checkbox>
            <wd-checkbox name="b">按钮</wd-checkbox>
          </wd-checkbox-group>
        </view>
        <view class="wd-h5-demo__row" style="margin-top: 8px">
          <wd-checkbox name="a" disabled>禁用</wd-checkbox>
          <wd-checkbox name="b" disabled model-value>选中且禁用</wd-checkbox>
        </view>
      </view>
    </view>
  </scroll-view>
</template>
