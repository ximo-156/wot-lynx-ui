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

function toggle(name: string, expanded: boolean) {
  if (props.accordion) {
    emit('update:modelValue', expanded ? name : '')
    emit('change', { value: expanded ? name : '' })
    return
  }
  const list = Array.isArray(currentValue.value) ? [...currentValue.value] : currentValue.value !== '' ? [currentValue.value] : []
  const index = list.indexOf(name)
  if (expanded && index === -1) {
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
    <view v-if="viewmore" :class="`wd-collapse__more ${customMoreSlotClass}`">
      <slot name="more" />
    </view>
  </view>
</template>
