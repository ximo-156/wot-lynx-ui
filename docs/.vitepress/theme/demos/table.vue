<script setup lang="ts">
/**
 * Table 表格 — 文档站 H5 预览演示（手工编写）。
 * 列必须由 wd-table-column 子组件声明：wd-table 没有 columns prop，
 * 传入 columns 不会渲染任何列（表头与单元格全空、内容宽度塌成 0）。
 */
import WdTable from '@wot-lynx/ui-display/wd-table'
import WdTableColumn from '@wot-lynx/ui-display/wd-table-column'

const data = [
  { name: '张三', age: 28, city: '北京' },
  { name: '李四', age: 34, city: '上海' },
  { name: '王五', age: 25, city: '广州' }
]
</script>

<template>
  <scroll-view scroll-orientation="vertical" class="wd-h5-demo">
    <view class="wd-h5-demo__section">
      <text class="wd-h5-demo__section-title">基础用法</text>
      <view class="wd-h5-demo__panel" :style="{ padding: '0px' }">
        <wd-table :data="data">
          <wd-table-column prop="name" label="姓名" :width="92" />
          <wd-table-column prop="age" label="年龄" :width="80" />
          <wd-table-column prop="city" label="城市" :width="104" />
        </wd-table>
      </view>
    </view>

    <view class="wd-h5-demo__section">
      <text class="wd-h5-demo__section-title">斑马纹 / 边框</text>
      <view class="wd-h5-demo__panel" :style="{ padding: '0px' }">
        <wd-table :data="data" stripe border>
          <wd-table-column prop="name" label="姓名" :width="92" />
          <wd-table-column prop="age" label="年龄" :width="80" />
          <wd-table-column prop="city" label="城市" :width="104" />
        </wd-table>
      </view>
    </view>
  </scroll-view>
</template>
