<script setup lang="ts">
/**
 * Table 表格 — 文档站 H5 预览演示（手工编写）。
 */
import WdTable from 'wot-lynx-ui/components/wd-table/wd-table.vue'

const data = [
  { name: '张三', age: 28, city: '北京' },
  { name: '李四', age: 34, city: '上海' },
  { name: '王五', age: 25, city: '广州' }
]
const columns = [
  { prop: 'name', label: '姓名', width: 80 },
  { prop: 'age', label: '年龄', width: 60 },
  { prop: 'city', label: '城市', width: 80 }
]
</script>

<template>
  <scroll-view scroll-orientation="vertical" class="wd-h5-demo">
    <view class="wd-h5-demo__section">
      <text class="wd-h5-demo__section-title">基础用法</text>
      <view class="wd-h5-demo__panel" style="padding: 0">
        <wd-table :data="data" :columns="columns" />
      </view>
    </view>

    <view class="wd-h5-demo__section">
      <text class="wd-h5-demo__section-title">斑马纹 / 边框</text>
      <view class="wd-h5-demo__panel" style="padding: 0">
        <wd-table :data="data" :columns="columns" stripe border />
      </view>
    </view>
  </scroll-view>
</template>
