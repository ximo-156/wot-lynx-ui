<script setup lang="ts">
/**
 * Dialog 对话框 — 文档站 H5 预览演示（手工编写）。
 */
import { ref } from 'vue'
import WdDialog from 'wot-lynx-ui/components/wd-dialog/wd-dialog.vue'
import WdButton from 'wot-lynx-ui/components/wd-button/wd-button.vue'

const dialogRef = ref<any>(null)

function showAlert() {
  dialogRef.value?.alert({
    title: '提示',
    msg: '这是命令式 alert 对话框'
  })
}

function showConfirm() {
  dialogRef.value
    ?.confirm({
      title: '确认',
      msg: '确认删除这条记录吗？'
    })
    .then(() => {
      console.log('[preview] dialog confirm')
    })
    .catch(() => {
      console.log('[preview] dialog cancel')
    })
}
</script>

<template>
  <scroll-view scroll-orientation="vertical" class="wd-h5-demo">
    <view class="wd-h5-demo__section">
      <text class="wd-h5-demo__section-title">命令式调用</text>
      <view class="wd-h5-demo__panel">
        <view class="wd-h5-demo__row">
          <wd-button size="small" @tap="showAlert">alert 提示</wd-button>
          <wd-button size="small" type="primary" @tap="showConfirm">confirm 确认</wd-button>
        </view>
      </view>
    </view>

    <view class="wd-h5-demo__section">
      <text class="wd-h5-demo__section-title">受控用法</text>
      <view class="wd-h5-demo__panel">
        <text style="font-size: 13px; color: var(--wd-text-2)">
          除命令式外，也可用 v-model:visible 受控打开（见 API）。
        </text>
      </view>
    </view>

    <wd-dialog ref="dialogRef" selector="preview-dialog" />
  </scroll-view>
</template>
