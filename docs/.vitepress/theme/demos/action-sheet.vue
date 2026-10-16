<script setup lang="ts">
/**
 * ActionSheet 动作面板 — 文档站 H5 预览演示（手工编写）。
 */
import { ref } from 'vue'
import WdActionSheet from 'wot-lynx-ui/components/wd-action-sheet/wd-action-sheet.vue'
import WdButton from 'wot-lynx-ui/components/wd-button/wd-button.vue'

const visible = ref(false)
const actions = ref([
  { name: '选项一' },
  { name: '选项二' },
  { name: '选项三', subname: '描述信息' }
])
</script>

<template>
  <scroll-view scroll-orientation="vertical" class="wd-h5-demo">
    <view class="wd-h5-demo__section">
      <text class="wd-h5-demo__section-title">基础用法</text>
      <view class="wd-h5-demo__panel">
        <view class="wd-h5-demo__row">
          <wd-button size="small" type="primary" @tap="visible = true">打开动作面板</wd-button>
        </view>
      </view>
    </view>

    <wd-action-sheet
      v-model="visible"
      :actions="actions"
      cancel-text="取消"
      @select="(e: any) => console.log('[preview] select', e)"
      @close="console.log('[preview] close')"
    />
  </scroll-view>
</template>
