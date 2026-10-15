/*
 * wd-sort-button — 排序按钮
 *
 * Lynx 实现说明：三态循环（无 → 升序 → 降序 → 无），
 * descFirst 时降序优先；allowReset 控制是否回到无排序。
 */
<script lang="ts" setup>
import './index.css'

import { computed } from 'vue-lynx'
import WdIcon from '../wd-icon/wd-icon.vue'
import { sortButtonProps, type SortButtonChangeDetail, type SortButtonValue } from './types'

const props = defineProps(sortButtonProps)
const emit = defineEmits(['change', 'update:modelValue', 'click'])

const rootClass = computed(() => {
  const classes = ['wd-sort-button']
  if (props.line) classes.push('wd-sort-button--line')
  if (props.customClass) classes.push(props.customClass)
  return classes.join(' ')
})

function handleClick() {
  const order: SortButtonValue[] = props.descFirst
    ? [1, -1, 0]
    : [-1, 1, 0]
  const current = props.modelValue as SortButtonValue
  const next: SortButtonValue = props.allowReset
    ? order[(order.indexOf(current) + 1) % order.length]
    : current === 0
      ? order[0]
      : current === order[0]
        ? order[1]
        : 0
  emit('update:modelValue', next)
  emit('change', { value: next } as SortButtonChangeDetail)
  emit('click')
}
</script>

<template>
  <view :class="rootClass" :style="customStyle" @tap="handleClick">
    <view class="wd-sort-button__wrapper">
      <view :class="`wd-sort-button__left ${modelValue !== 0 ? 'is-active' : ''}`">
        <text>{{ title }}</text>
      </view>
      <view class="wd-sort-button__right">
        <wd-icon name="caret-up" :custom-class="`wd-sort-button__icon-up ${modelValue === -1 ? 'wd-sort-button__icon-up--active' : ''}`" />
        <wd-icon name="caret-down" :custom-class="`wd-sort-button__icon-down ${modelValue === 1 ? 'wd-sort-button__icon-down--active' : ''}`" />
      </view>
    </view>
  </view>
</template>
