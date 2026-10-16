/*
 * wd-collapse — 折叠面板
 *
 * Lynx 实现说明：经 useChildren 向 collapse-item 提供
 * currentValue + toggle；accordion 模式只允许展开一项。
 */
<script lang="ts" setup>
import './index.css'
import { parseStyle } from '../../common/util'

import { computed } from 'vue-lynx'
import { collapseProps, COLLAPSE_KEY, type CollapseValue } from './types'
import { useChildren } from '../../composables/useChildren'

const props = defineProps(collapseProps)
const emit = defineEmits(['change', 'update:modelValue'])

const currentValue = computed<CollapseValue>(() => props.modelValue as CollapseValue)

const { linkChildren } = useChildren(COLLAPSE_KEY)

function toggle(name: string | number, expanded: boolean) {
  if (props.accordion) {
    emit('update:modelValue', expanded ? name : '')
    emit('change', { value: expanded ? name : '' })
    return
  }
  const list = Array.isArray(currentValue.value) ? [...currentValue.value] : currentValue.value !== '' ? [currentValue.value] : []
  // 统一转 String 比较：modelValue 可能是数字数组（如 [1]）而 item 的 name
  // 是数字 1，严格 indexOf 漏配会把已展开项重复 push 进去
  const index = list.map(String).indexOf(String(name))
  if (expanded && index === -1) {
    // push 原始 name：保留调用方的数字/字符串类型，不混型
    list.push(name)
  } else if (!expanded && index > -1) {
    list.splice(index, 1)
  }
  emit('update:modelValue', list)
  emit('change', { value: list })
}

linkChildren({
  props: props as any,
  currentValue,
  toggle
})
</script>

<template>
  <view :class="`wd-collapse ${customClass}`" :style="parseStyle(customStyle)">
    <slot />
    <!-- more 插槽守卫：viewmore 为 true 但未提供 more 插槽时不渲染空容器 -->
    <view v-if="viewmore && $slots.more" :class="`wd-collapse__more ${customMoreSlotClass}`">
      <slot name="more" />
    </view>
  </view>
</template>
