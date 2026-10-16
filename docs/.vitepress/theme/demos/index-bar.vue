<script setup lang="ts">
/**
 * IndexBar 索引栏 — 文档站 H5 预览演示（手工编写）。
 */
import WdIndexBar from 'wot-lynx-ui/components/wd-index-bar/wd-index-bar.vue'
import WdIndexAnchor from 'wot-lynx-ui/components/wd-index-anchor/wd-index-anchor.vue'

const groups = [
  { index: 'A', cities: ['北京', '蚌埠', '保定'] },
  { index: 'B', cities: ['重庆', '成都'] },
  { index: 'C', cities: ['长沙', '长春'] }
]
</script>

<template>
  <scroll-view scroll-orientation="vertical" class="wd-h5-demo">
    <view class="wd-h5-demo__section">
      <text class="wd-h5-demo__section-title">城市列表（sticky 吸顶）</text>
      <view class="wd-h5-demo__panel" style="padding: 0">
        <view style="height: 320px">
          <wd-index-bar sticky>
            <wd-index-anchor v-for="group in groups" :key="group.index" :index="group.index">
              <text class="wd-h5-demo__panel-label" style="margin: 0">{{ group.index }}</text>
              <view v-for="city in group.cities" :key="city" style="padding: 6px 0">
                <text class="wd-h5-demo__tag">{{ city }}</text>
              </view>
            </wd-index-anchor>
          </wd-index-bar>
        </view>
      </view>
      <text class="wd-h5-demo__panel-label">触摸右侧索引条跳转</text>
    </view>
  </scroll-view>
</template>
