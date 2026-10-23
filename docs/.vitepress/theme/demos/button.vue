<script setup lang="ts">
/**
 * Button 按钮 — 文档站 H5 预览演示（手工编写）。
 *
 * 与 packages/demo/src/App.vue 的 Button 小节保持同构；新增演示只需
 * 在 demos/ 下新建 <slug>.vue，demo-registry 自动发现。
 */
import { ref } from 'vue'
import WdButton from 'wot-lynx-ui/primitives/wd-button/wd-button.vue'

const count = ref(0)
const loading = ref(false)

function onTapButton() {
  count.value++
}

function toggleLoading() {
  loading.value = !loading.value
}
</script>

<template>
  <scroll-view scroll-orientation="vertical" class="wd-h5-demo">
    <view class="wd-h5-demo__section">
      <text class="wd-h5-demo__section-title">按钮类型</text>
      <view class="wd-h5-demo__panel">
        <view class="wd-h5-demo__row">
          <wd-button type="primary" @tap="onTapButton">主要按钮</wd-button>
          <wd-button type="success">成功</wd-button>
          <wd-button type="danger">危险</wd-button>
        </view>
        <view class="wd-h5-demo__row">
          <wd-button type="warning">警告</wd-button>
          <wd-button type="info">信息</wd-button>
        </view>
        <text class="wd-h5-demo__panel-label">点击计数：{{ count }}</text>
      </view>
    </view>

    <view class="wd-h5-demo__section">
      <text class="wd-h5-demo__section-title">变体 variant</text>
      <view class="wd-h5-demo__panel">
        <view class="wd-h5-demo__row">
          <wd-button type="primary" variant="base">基础</wd-button>
          <wd-button type="primary" variant="plain">朴素</wd-button>
          <wd-button type="primary" variant="dashed">虚线</wd-button>
        </view>
        <view class="wd-h5-demo__row">
          <wd-button type="primary" variant="soft">柔和</wd-button>
          <wd-button type="primary" variant="subtle">淡雅</wd-button>
          <wd-button type="primary" variant="text">文字</wd-button>
        </view>
      </view>
    </view>

    <view class="wd-h5-demo__section">
      <text class="wd-h5-demo__section-title">尺寸 size</text>
      <view class="wd-h5-demo__panel">
        <view class="wd-h5-demo__row">
          <wd-button type="primary" size="large">大按钮</wd-button>
          <wd-button type="primary" size="medium">中按钮</wd-button>
          <wd-button type="primary" size="small">小按钮</wd-button>
          <wd-button type="primary" size="mini">迷你</wd-button>
        </view>
      </view>
    </view>

    <view class="wd-h5-demo__section">
      <text class="wd-h5-demo__section-title">图标与状态</text>
      <view class="wd-h5-demo__panel">
        <view class="wd-h5-demo__row">
          <wd-button type="primary" icon="setting">设置</wd-button>
          <wd-button type="primary" :loading="loading" @tap="toggleLoading">{{
            loading ? '加载中' : '点击加载'
          }}</wd-button>
          <wd-button disabled>禁用</wd-button>
        </view>
        <view class="wd-h5-demo__row">
          <wd-button type="danger" round>圆角</wd-button>
          <wd-button type="primary" hairline variant="plain">细线</wd-button>
          <wd-button type="primary" icon="picture" is-icon />
        </view>
      </view>
    </view>

    <view class="wd-h5-demo__section">
      <text class="wd-h5-demo__section-title">块级 block</text>
      <view class="wd-h5-demo__panel">
        <view class="wd-h5-demo__row wd-h5-demo__row--block">
          <wd-button type="primary" block>主要按钮</wd-button>
        </view>
        <view class="wd-h5-demo__row wd-h5-demo__row--block">
          <wd-button type="primary" variant="plain" block>朴素按钮</wd-button>
        </view>
      </view>
    </view>
  </scroll-view>
</template>
