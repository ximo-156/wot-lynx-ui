/*
 * wd-checkbox-group — 多选框组
 *
 * Lynx 实现说明：
 * - 经 useChildren 向子复选框提供共享配置与 changeSelectState；
 * - toggleAll 全选/反选经 children 列表驱动（跳过禁用项可配）；
 * - 横向排列根容器显式 display: flex。
 */
<script lang="ts" setup>
import './index.css'

import { computed } from 'vue-lynx'
import { checkboxGroupProps, type CheckboxGroupToggleAllOptions } from './types'
import { useChildren } from '../../composables/useChildren'
import { CHECKBOX_GROUP_KEY } from '../../composables/useCheckboxGroup'
import { checkNumRange, deepClone, isDef } from '../../common/util'

const props = defineProps(checkboxGroupProps)
const emit = defineEmits(['change', 'update:modelValue'])

const { linkChildren, children } = useChildren(CHECKBOX_GROUP_KEY)

linkChildren({ props, changeSelectState })

const rootClass = computed(() => {
  const classes = ['wd-checkbox-group', `wd-checkbox-group--${props.direction}`]
  if (props.customClass) classes.push(props.customClass)
  return classes.join(' ')
})

/**
 * 子节点通知父节点修改选中状态
 */
function changeSelectState(value: string | number | boolean) {
  const temp: (string | number | boolean)[] = deepClone(props.modelValue)
  const index = temp.indexOf(value)
  if (index > -1) {
    temp.splice(index, 1)
  } else {
    if (props.max !== 0 && temp.length >= props.max) {
      return
    }
    temp.push(value)
  }
  emit('update:modelValue', temp)
  emit('change', { value: temp })
}

/**
 * 全选 / 反选
 */
function toggleAll(options: CheckboxGroupToggleAllOptions = true) {
  const opts = typeof options === 'boolean' ? { checked: options } : options
  const checked = opts.checked === undefined ? true : opts.checked
  const skipDisabled = opts.skipDisabled === undefined ? true : opts.skipDisabled

  const selectable = children
    .filter((child: any) => {
      if (!skipDisabled) return true
      const childProps = child.$ && child.$.props
      return !(childProps && childProps.disabled)
    })
    .map((child: any) => child.$.props.name)
    .filter((name: any) => isDef(name))

  const next = checked ? selectable : []
  emit('update:modelValue', next)
  emit('change', { value: next })
}

defineExpose({
  toggleAll
})
</script>

<template>
  <view :class="rootClass" :style="customStyle">
    <slot />
  </view>
</template>
