/*
 * wd-cell-group — 单元格组
 *
 * Lynx 实现说明：
 * - 经 useChildren 向子单元格提供共享配置（border/center/size/
 *   titleWidth/layout/valueAlign），子单元格 props 优先；
 * - insert 模式为卡片式分组（圆角容器 + 水平外边距）。
 */
<script lang="ts" setup>
import './index.css'

import { computed } from 'vue-lynx'
import { cellGroupProps } from './types'
import { useChildren } from '../../composables/useChildren'
import { CELL_GROUP_KEY } from '../../composables/useCell'

const props = defineProps(cellGroupProps)

const { linkChildren } = useChildren(CELL_GROUP_KEY)

linkChildren({ props })

const rootClass = computed(() => {
  const classes = ['wd-cell-group']
  if (props.border) classes.push('is-border')
  if (props.insert) classes.push('wd-cell-group--insert')
  if (props.customClass) classes.push(props.customClass)
  return classes.join(' ')
})
</script>

<template>
  <view :class="rootClass" :style="customStyle">
    <view v-if="title || value || $slots.title || $slots.value" class="wd-cell-group__title">
      <view class="wd-cell-group__left">
        <text v-if="!$slots.title">{{ title }}</text>
        <slot v-else name="title" />
      </view>
      <view class="wd-cell-group__right">
        <text v-if="!$slots.value">{{ value }}</text>
        <slot v-else name="value" />
      </view>
    </view>
    <view class="wd-cell-group__body">
      <slot />
    </view>
  </view>
</template>
