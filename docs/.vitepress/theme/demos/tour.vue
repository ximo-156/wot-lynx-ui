<script setup lang="ts">
/**
 * Tour 新手引导 — 文档站 H5 预览演示（手工编写）。
 */
import { ref } from 'vue'
import WdTour from 'wot-lynx-ui/components/wd-tour/wd-tour.vue'
import WdButton from 'wot-lynx-ui/primitives/wd-button/wd-button.vue'

const visible = ref(false)
const steps = ref([
  { element: '#tour-target-1', title: '第一步', content: '这里是第一步的引导说明' },
  { element: '#tour-target-2', title: '第二步', content: '这里是第二步的引导说明' }
])
</script>

<template>
  <scroll-view scroll-orientation="vertical" class="wd-h5-demo">
    <view class="wd-h5-demo__section">
      <text class="wd-h5-demo__section-title">新手引导</text>
      <view class="wd-h5-demo__panel">
        <view id="tour-target-1" class="wd-h5-demo__row">
          <wd-button size="small" type="primary" @tap="visible = true">开始引导</wd-button>
        </view>
        <view id="tour-target-2" class="wd-h5-demo__row">
          <text class="wd-h5-demo__tag">引导目标二</text>
        </view>
        <text class="wd-h5-demo__panel-label">element 指定目标节点选择器</text>
      </view>
    </view>

    <wd-tour v-model="visible" :steps="steps" />
  </scroll-view>
</template>
