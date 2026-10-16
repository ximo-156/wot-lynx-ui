<script setup lang="ts">
/**
 * Tabbar 标签栏 — 文档站 H5 预览演示（手工编写）。
 */
import { ref } from 'vue'
import WdTabbar from 'wot-lynx-ui/components/wd-tabbar/wd-tabbar.vue'
import WdTabbarItem from 'wot-lynx-ui/components/wd-tabbar-item/wd-tabbar-item.vue'

const value = ref(0)
const roundValue = ref(1)
</script>

<template>
  <scroll-view scroll-orientation="vertical" class="wd-h5-demo">
    <view class="wd-h5-demo__section">
      <text class="wd-h5-demo__section-title">基础用法</text>
      <view class="wd-h5-demo__panel" style="padding: 0; overflow: hidden">
        <wd-tabbar v-model="value" bordered>
          <wd-tabbar-item title="首页" icon="home" />
          <wd-tabbar-item title="消息" icon="comment" />
          <wd-tabbar-item title="我的" icon="user" />
        </wd-tabbar>
      </view>
    </view>

    <view class="wd-h5-demo__section">
      <text class="wd-h5-demo__section-title">圆角形状 + 徽标</text>
      <view class="wd-h5-demo__panel" style="padding: 0; overflow: hidden">
        <wd-tabbar v-model="roundValue" shape="round" active-color="#7F5CFF">
          <wd-tabbar-item title="首页" icon="home" active-icon="home-filling" />
          <wd-tabbar-item title="消息" icon="comment" :value="8" />
          <wd-tabbar-item title="通知" icon="notification" :is-dot="true" />
          <wd-tabbar-item title="我的" icon="user" :name="99" :value="150" :max="99" />
        </wd-tabbar>
      </view>
    </view>
  </scroll-view>
</template>
