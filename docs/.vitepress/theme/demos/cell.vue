<script setup lang="ts">
/**
 * Cell 单元格 — 文档站 H5 预览演示（手工编写）。
 */
import { ref } from 'vue'
import WdCell from 'wot-lynx-ui/primitives/wd-cell/wd-cell.vue'
import WdCellGroup from 'wot-lynx-ui/components/wd-cell-group/wd-cell-group.vue'
import WdSwitch from 'wot-lynx-ui/components/wd-switch/wd-switch.vue'

const switchValue = ref(true)
</script>

<template>
  <scroll-view scroll-orientation="vertical" class="wd-h5-demo">
    <view class="wd-h5-demo__section">
      <text class="wd-h5-demo__section-title">基础用法</text>
      <view class="wd-h5-demo__panel" style="padding: 0">
        <wd-cell-group>
          <wd-cell title="单元格" value="内容" />
          <wd-cell title="图标 + 箭头" prefix-icon="setting" is-link value="跳转" />
          <wd-cell title="描述文本" label="这是描述信息" value="内容" />
        </wd-cell-group>
      </view>
    </view>

    <view class="wd-h5-demo__section">
      <text class="wd-h5-demo__section-title">卡片分组（insert）</text>
      <view class="wd-h5-demo__panel" style="padding: 0">
        <wd-cell-group title="卡片分组" insert>
          <wd-cell title="左侧标题宽度" value="内容" title-width="120" />
          <wd-cell title="垂直布局" label="上下排列" value="内容" layout="vertical" />
        </wd-cell-group>
      </view>
    </view>

    <view class="wd-h5-demo__section">
      <text class="wd-h5-demo__section-title">单元格嵌套</text>
      <view class="wd-h5-demo__panel" style="padding: 0">
        <wd-cell-group title="设置" border>
          <wd-cell title="开关" center>
            <template #value>
              <wd-switch v-model="switchValue" />
            </template>
          </wd-cell>
          <wd-cell title="徽标" value="8" is-link />
          <wd-cell title="禁用" value="不可用" disabled />
        </wd-cell-group>
      </view>
    </view>
  </scroll-view>
</template>
