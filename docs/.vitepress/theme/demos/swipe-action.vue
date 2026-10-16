<script setup lang="ts">
/**
 * SwipeAction 滑动操作 — 文档站 H5 预览演示（手工编写）。
 */
import { ref } from 'vue'
import WdSwipeAction from 'wot-lynx-ui/components/wd-swipe-action/wd-swipe-action.vue'
import WdCell from 'wot-lynx-ui/components/wd-cell/wd-cell.vue'
import WdButton from 'wot-lynx-ui/components/wd-button/wd-button.vue'

const cells = ref([
  { title: '单元格一', status: 'close' },
  { title: '单元格二', status: 'close' },
  { title: '单元格三', status: 'close' }
])

function onClose(title: string) {
  console.log('[preview] swipe close', title)
}
</script>

<template>
  <scroll-view scroll-orientation="vertical" class="wd-h5-demo">
    <view class="wd-h5-demo__section">
      <text class="wd-h5-demo__section-title">左右横滑单元格</text>
      <view class="wd-h5-demo__panel" style="padding: 0">
        <wd-swipe-action v-for="cell in cells" :key="cell.title">
          <template #default>
            <wd-cell :title="cell.title" value="内容" />
          </template>
          <template #right>
            <wd-button type="danger" @tap="onClose(cell.title)">删除</wd-button>
          </template>
        </wd-swipe-action>
      </view>
      <text class="wd-h5-demo__panel-label">横滑露出右侧操作按钮</text>
    </view>
  </scroll-view>
</template>
