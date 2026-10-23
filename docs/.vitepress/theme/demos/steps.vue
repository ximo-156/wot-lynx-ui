<script setup lang="ts">
/**
 * Steps 步骤条 — 文档站 H5 预览演示（手工编写）。
 */
import { ref } from 'vue'
import WdSteps from 'wot-lynx-ui/components/wd-steps/wd-steps.vue'
import WdStep from 'wot-lynx-ui/components/wd-step/wd-step.vue'
import WdButton from 'wot-lynx-ui/primitives/wd-button/wd-button.vue'

const active = ref(1)
</script>

<template>
  <scroll-view scroll-orientation="vertical" class="wd-h5-demo">
    <view class="wd-h5-demo__section">
      <text class="wd-h5-demo__section-title">基础用法</text>
      <view class="wd-h5-demo__panel">
        <wd-steps :active="active">
          <wd-step title="步骤一" description="填写信息" />
          <wd-step title="步骤二" description="身份认证" />
          <wd-step title="步骤三" description="完成" />
        </wd-steps>
        <view class="wd-h5-demo__row" style="margin-top: 12px">
          <wd-button size="small" @tap="active = Math.max(0, active - 1)">上一步</wd-button>
          <wd-button size="small" type="primary" @tap="active = Math.min(3, active + 1)">下一步</wd-button>
          <text class="wd-h5-demo__tag">active: {{ active }}</text>
        </view>
      </view>
    </view>

    <view class="wd-h5-demo__section">
      <text class="wd-h5-demo__section-title">竖向 / 图标</text>
      <view class="wd-h5-demo__panel">
        <wd-steps :active="1" vertical>
          <wd-step title="步骤一" description="竖向排列" />
          <wd-step title="步骤二" description="带自定义图标" icon="setting" />
          <wd-step title="步骤三" description="完成" />
        </wd-steps>
      </view>
    </view>
  </scroll-view>
</template>
