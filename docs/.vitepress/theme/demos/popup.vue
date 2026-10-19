<script setup lang="ts">
/**
 * Popup 弹出层 — 文档站 H5 预览演示（手工编写）。
 */
import { ref } from 'vue'
import WdPopup from 'wot-lynx-ui/components/wd-popup/wd-popup.vue'
import WdButton from 'wot-lynx-ui/components/wd-button/wd-button.vue'

const visible = ref(false)
const position = ref<'center' | 'top' | 'bottom' | 'left' | 'right'>('center')

function open(pos: 'center' | 'top' | 'bottom' | 'left' | 'right') {
  position.value = pos
  visible.value = true
}
</script>

<template>
  <scroll-view scroll-orientation="vertical" class="wd-h5-demo">
    <view class="wd-h5-demo__section">
      <text class="wd-h5-demo__section-title">弹出位置</text>
      <view class="wd-h5-demo__panel">
        <view class="wd-h5-demo__row">
          <wd-button size="small" @tap="open('center')">居中</wd-button>
          <wd-button size="small" @tap="open('top')">顶部</wd-button>
          <wd-button size="small" @tap="open('bottom')">底部</wd-button>
        </view>
        <view class="wd-h5-demo__row">
          <wd-button size="small" @tap="open('left')">左侧</wd-button>
          <wd-button size="small" @tap="open('right')">右侧</wd-button>
        </view>
      </view>
    </view>

    <view class="wd-h5-demo__section">
      <text class="wd-h5-demo__section-title">圆角 / 关闭图标</text>
      <view class="wd-h5-demo__panel">
        <view class="wd-h5-demo__row">
          <wd-button size="small" type="primary" @tap="open('bottom')">圆角弹出</wd-button>
        </view>
      </view>
    </view>

    <wd-popup v-model="visible" :position="position" round closable custom-style="padding: 24px; min-width: 60%">
      <text style="font-size: 14px; color: var(var(--wot-text-main))">position: {{ position }}</text>
    </wd-popup>
  </scroll-view>
</template>
