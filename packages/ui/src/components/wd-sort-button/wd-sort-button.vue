/*
 * wd-sort-button — 排序按钮
 *
 * Lynx 实现说明：三态循环（默认 无 → 降序 → 升序 → 无），
 * descFirst 时升序优先；allowReset 控制是否回到无排序。
 */
<script lang="ts" setup>
import './index.css'
import { parseStyle } from '../../common/util'

import { computed } from 'vue-lynx'
import WdIcon from '../wd-icon/wd-icon.vue'
import { sortButtonProps, type SortButtonChangeDetail, type SortButtonValue } from './types'

const props = defineProps(sortButtonProps)
const emit = defineEmits(['change', 'update:modelValue', 'click', 'tap'])

const rootClass = computed(() => {
  const classes = ['wd-sort-button']
  if (props.line) classes.push('wd-sort-button--line')
  if (props.customClass) classes.push(props.customClass)
  return classes.join(' ')
})

/**
 * 处理点击事件，按排序循环切换排序方向（与 wot-ui 对齐）：
 * descFirst 开启时循环：0 → -1(升) → 1(降) → (allowReset ? 0 : -1)
 * descFirst 关闭时循环：0 → 1(降) → -1(升) → (allowReset ? 0 : 1)
 *
 * 曾把降序当作首态且 allowReset=false 时仍会回到 0（第三态无守卫），
 * 三态方向与 wot-ui 相反。
 */
function handleClick() {
  const value = props.modelValue as SortButtonValue
  let next: SortButtonValue
  if (props.descFirst) {
    if (value === 0) {
      next = -1
    } else if (value === -1) {
      next = 1
    } else {
      next = props.allowReset ? 0 : -1
    }
  } else {
    if (value === 0) {
      next = 1
    } else if (value === 1) {
      next = -1
    } else {
      next = props.allowReset ? 0 : 1
    }
  }
  emit('update:modelValue', next)
  emit('change', { value: next } as SortButtonChangeDetail)
  emit('click')
  emit('tap')
}
</script>

<template>
  <view :class="rootClass" :style="parseStyle(customStyle)" @tap="handleClick">
    <view class="wd-sort-button__wrapper">
      <view :class="`wd-sort-button__left ${modelValue !== 0 ? 'is-active' : ''}`">
        <text>{{ title }}</text>
      </view>
      <view class="wd-sort-button__right">
        <wd-icon name="arrow-up-filling" :custom-class="`wd-sort-button__icon-up ${modelValue === -1 ? 'wd-sort-button__icon-up--active' : ''}`" />
        <wd-icon name="arrow-down-filling" :custom-class="`wd-sort-button__icon-down ${modelValue === 1 ? 'wd-sort-button__icon-down--active' : ''}`" />
      </view>
    </view>
  </view>
</template>
