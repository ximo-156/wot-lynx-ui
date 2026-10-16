<script setup lang="ts">
/**
 * Toast 轻提示 — 文档站 H5 预览演示（手工编写）。
 *
 * 命令式 API：useToast(selector) 与 <wd-toast selector> 配对。
 */
import WdToast from 'wot-lynx-ui/components/wd-toast/wd-toast.vue'
import WdButton from 'wot-lynx-ui/components/wd-button/wd-button.vue'
import { useToast } from 'wot-lynx-ui/components/wd-toast'

const toast = useToast('preview-toast')
</script>

<template>
  <scroll-view scroll-orientation="vertical" class="wd-h5-demo">
    <view class="wd-h5-demo__section">
      <text class="wd-h5-demo__section-title">命令式调用</text>
      <view class="wd-h5-demo__panel">
        <view class="wd-h5-demo__row">
          <wd-button size="small" @tap="toast.show('文字提示')">展示</wd-button>
          <wd-button size="small" @tap="toast.success('成功提示')">成功</wd-button>
          <wd-button size="small" @tap="toast.error('错误提示')">错误</wd-button>
        </view>
        <view class="wd-h5-demo__row">
          <wd-button size="small" @tap="toast.warning('警告提示')">警告</wd-button>
          <wd-button size="small" @tap="toast.loading('加载中...')">加载</wd-button>
          <wd-button size="small" @tap="toast.close()">关闭</wd-button>
        </view>
      </view>
    </view>

    <view class="wd-h5-demo__section">
      <text class="wd-h5-demo__section-title">带图标 / 遮罩</text>
      <view class="wd-h5-demo__panel">
        <view class="wd-h5-demo__row">
          <wd-button size="small" @tap="toast.show({ msg: '带图标提示', iconName: 'setting' })">图标</wd-button>
          <wd-button size="small" @tap="toast.show({ msg: '带遮罩提示', cover: true })">遮罩</wd-button>
        </view>
      </view>
    </view>

    <wd-toast selector="preview-toast" />
  </scroll-view>
</template>
