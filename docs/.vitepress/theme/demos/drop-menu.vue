<script setup lang="ts">
/**
 * DropMenu 下拉菜单 — 文档站 H5 预览演示（手工编写）。
 */
import { ref } from 'vue'
import WdDropMenu from 'wot-lynx-ui/components/wd-drop-menu/wd-drop-menu.vue'
import WdDropMenuItem from 'wot-lynx-ui/components/wd-drop-menu-item/wd-drop-menu-item.vue'

const sortValue = ref('')
const priceValue = ref('')

const sortOptions = ref([
  { value: 'new', label: '最新发布' },
  { value: 'sales', label: '销量优先' },
  { value: 'price', label: '价格从低到高' }
])
const priceOptions = ref([
  { value: '0-50', label: '50 元以下' },
  { value: '50-100', label: '50 - 100 元' },
  { value: '100+', label: '100 元以上' }
])
</script>

<template>
  <scroll-view scroll-orientation="vertical" class="wd-h5-demo">
    <view class="wd-h5-demo__section">
      <text class="wd-h5-demo__section-title">基础用法</text>
      <view class="wd-h5-demo__panel" style="padding: 0; overflow: hidden">
        <wd-drop-menu>
          <wd-drop-menu-item v-model="sortValue" :options="sortOptions" title="排序" />
          <wd-drop-menu-item v-model="priceValue" :options="priceOptions" title="价格" />
        </wd-drop-menu>
      </view>
      <text class="wd-h5-demo__panel-label">排序：{{ sortValue || '未选择' }} · 价格：{{ priceValue || '未选择' }}</text>
    </view>
  </scroll-view>
</template>
