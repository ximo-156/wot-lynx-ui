/*
 * wd-checkbox-group — 多选框组
 *
 * Lynx 实现说明（相对 wot-ui 2.3.2 的适配点）：
 * - wot-ui 的分组容器是普通块级 view，横向排列靠子 wd-checkbox 的 inline-flex
 *   行内流式布局实现；Lynx 3.x 默认 linear 布局（纵向堆叠）且不识别
 *   inline-flex，故在容器上显式声明 flex 方向，并按 direction 追加
 *   `wd-checkbox-group--horizontal | --vertical` 修饰类；
 * - 横向项间距：wot-ui 用 `.wd-checkbox--horizontal:not(:last-child)` 的
 *   margin 实现，Lynx 无兄弟选择器，改为容器 gap（取值与
 *   --wot-checkbox-horizontal-margin 的水平间距一致）；
 * - toggleAll 读取子组件 props 走 toRaw 非跟踪读取（CONVENTIONS §13）。
 */
<script lang="ts" setup>
import './index.css'

import { computed, toRaw, watch } from 'vue-lynx'
import { checkboxGroupProps, type CheckboxGroupExpose, type CheckboxGroupToggleAllOptions } from './types'
import { useChildren } from '../../composables/useChildren'
import { CHECKBOX_GROUP_KEY } from '../../composables/useCheckboxGroup'
import { checkNumRange, deepClone, isBoolean, parseStyle } from '../../common/util'

const props = defineProps(checkboxGroupProps)
const emit = defineEmits(['change', 'update:modelValue'])

const { linkChildren, children } = useChildren(CHECKBOX_GROUP_KEY)

linkChildren({ props, changeSelectState })

watch(
  () => props.modelValue,
  (newValue) => {
    // 传入的value数组中包括重复的元素，这种情况非法。
    if (new Set(newValue).size !== newValue.length) {
      console.error("checkboxGroup's bound value includes same value")
    }
    if (newValue.length < props.min) {
      console.error("checkboxGroup's bound value's length can't be less than min")
    }
    if (props.max !== 0 && newValue.length > props.max) {
      console.error("checkboxGroup's bound value's length can't be large than max")
    }
  },
  { deep: true, immediate: true }
)

watch(
  () => props.type,
  (newValue) => {
    const type = ['circle', 'square', 'button', 'dot']
    if (type.indexOf(newValue) === -1) console.error(`type must be one of ${type.toString()}`)
  },
  { deep: true, immediate: true }
)

watch(
  () => props.min,
  (newValue) => {
    checkNumRange(newValue, 'min')
  },
  { deep: true, immediate: true }
)

watch(
  () => props.max,
  (newValue) => {
    checkNumRange(newValue, 'max')
  },
  { deep: true, immediate: true }
)

const rootClass = computed(() => {
  const classes = ['wd-checkbox-group', `wd-checkbox-group--${props.direction}`]
  if (props.customClass) classes.push(props.customClass)
  return classes.join(' ')
})

/** 子组件 props 的非跟踪读取（CONVENTIONS §13） */
function rawChildProps(child: any): Record<string, any> {
  const childProps = child && child.$ && child.$.props
  return (childProps && toRaw(childProps)) || {}
}

/**
 * 子节点通知父节点修改子节点选中状态
 * @param value 子组件的标识符
 */
function changeSelectState(value: string | number | boolean) {
  const temp: (string | number | boolean)[] = deepClone(props.modelValue)
  const index = temp.indexOf(value)
  if (index > -1) {
    // 已经选中，则从 value 列表中删除子节点的标识符。
    temp.splice(index, 1)
  } else {
    // 之前未选中，则现在把加子节点的标识符加到 value 列表中。
    if (props.max !== 0 && temp.length >= props.max) {
      // Limit reached
      return
    }
    temp.push(value)
  }
  emit('update:modelValue', temp)

  emit('change', {
    value: temp
  })
}

/**
 * 切换所有复选框，传 true 为选中，false 为取消选中，不传参为取反
 * @param options
 */
const toggleAll = (options: CheckboxGroupToggleAllOptions = {}) => {
  const { modelValue } = props
  let checked: boolean | undefined
  let skipDisabled = false

  if (isBoolean(options)) {
    checked = options
  } else {
    checked = options.checked
    skipDisabled = options.skipDisabled || false
  }

  const newModelValue: (string | number | boolean)[] = []

  children.forEach((child: any) => {
    const childProps = rawChildProps(child)
    if (skipDisabled && childProps.disabled) {
      if (modelValue.includes(childProps.name)) {
        newModelValue.push(childProps.name)
      }
    } else {
      const isCurrentChecked = modelValue.includes(childProps.name)
      const target = checked === undefined ? !isCurrentChecked : checked

      if (target) {
        newModelValue.push(childProps.name)
      }
    }
  })

  emit('update:modelValue', newModelValue)
  emit('change', {
    value: newModelValue
  })
}

defineExpose<CheckboxGroupExpose>({
  toggleAll
})
</script>

<template>
  <view :class="rootClass" :style="parseStyle(customStyle)">
    <slot />
  </view>
</template>
