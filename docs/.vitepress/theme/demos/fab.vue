<script setup lang="ts">
/**
 * Fab 悬浮按钮 — 文档站 H5 预览演示（手工编写）。
 */
import { ref } from 'vue'
import WdFab from 'wot-lynx-ui/components/wd-fab/wd-fab.vue'
import WdButton from 'wot-lynx-ui/components/wd-button/wd-button.vue'

const active = ref(false)
const activeLeft = ref(false)
</script>

<template>
  <scroll-view scroll-orientation="vertical" class="wd-h5-demo">
    <view class="wd-h5-demo__section">
      <text class="wd-h5-demo__section-title">右下角向上展开（默认）</text>
      <view class="wd-h5-demo__panel">
        <view class="wd-h5-demo__row">
          <wd-button size="small" @tap="active = true">展开</wd-button>
          <wd-button size="small" @tap="active = false">收起</wd-button>
          <text class="wd-h5-demo__tag">active: {{ active }}</text>
        </view>
      </view>
    </view>

    <view class="wd-h5-demo__section">
      <text class="wd-h5-demo__section-title">左上角向下展开</text>
      <view class="wd-h5-demo__panel">
        <view class="wd-h5-demo__row">
          <wd-button size="small" @tap="activeLeft = true">展开</wd-button>
          <text class="wd-h5-demo__tag">position="left-top" + direction="bottom"</text>
        </view>
      </view>
    </view>

    <wd-fab v-model:active="active" @click="console.log('[preview] fab click')">
      <wd-button size="small" @tap="console.log('[preview] 菜单一')">菜单一</wd-button>
      <wd-button size="small" @tap="console.log('[preview] 菜单二')">菜单二</wd-button>
    </wd-fab>
    <wd-fab v-model:active="activeLeft" position="left-top" direction="bottom" type="warning" inactive-icon="edit">
      <wd-button size="small" type="warning" @tap="console.log('[preview] 左上菜单')">编辑</wd-button>
    </wd-fab>
  </scroll-view>
</template>
