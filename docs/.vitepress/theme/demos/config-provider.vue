<script setup lang="ts">
/**
 * ConfigProvider 全局配置 — 文档站 H5 预览演示（手工编写）。
 *
 * 演示按钮 / 标签的全局默认值经 theme-vars 与组件级默认配置下发。
 */
import WdConfigProvider from 'wot-lynx-ui/components/wd-config-provider/wd-config-provider.vue'
import WdButton from 'wot-lynx-ui/components/wd-button/wd-button.vue'
import WdTag from 'wot-lynx-ui/components/wd-tag/wd-tag.vue'
</script>

<template>
  <scroll-view scroll-orientation="vertical" class="wd-h5-demo">
    <view class="wd-h5-demo__section">
      <text class="wd-h5-demo__section-title">全局默认（主题外默认值）</text>
      <view class="wd-h5-demo__panel">
        <view class="wd-h5-demo__row">
          <wd-button>默认按钮</wd-button>
          <wd-tag>默认标签</wd-tag>
        </view>
      </view>
    </view>

    <view class="wd-h5-demo__section">
      <text class="wd-h5-demo__section-title">嵌套 ConfigProvider 覆盖</text>
      <view class="wd-h5-demo__panel">
        <wd-config-provider :button="{ type: 'success', size: 'small' }" :tag="{ type: 'primary' }">
          <view class="wd-h5-demo__row">
            <wd-button>success/small</wd-button>
            <wd-tag>primary</wd-tag>
          </view>
        </wd-config-provider>
      </view>
    </view>

    <view class="wd-h5-demo__section">
      <text class="wd-h5-demo__section-title">themeVars 自定义令牌</text>
      <view class="wd-h5-demo__panel">
        <wd-config-provider :theme-vars="{ 'var(--wot-primary-6)': '#00A06D' }">
          <view class="wd-h5-demo__row">
            <wd-button type="primary">绿色主色</wd-button>
          </view>
        </wd-config-provider>
      </view>
    </view>
  </scroll-view>
</template>
