/*
 * wd-table-column — 表格列
 *
 * Lynx 实现说明：声明式列配置（供 wd-table 收集），
 * 自身不渲染——渲染由 table 统一完成。
 */
<script lang="ts" setup>
import './index.css'

import { tableColumnProps } from './types'

defineProps(tableColumnProps)
</script>

<template>
  <view />
</template>
