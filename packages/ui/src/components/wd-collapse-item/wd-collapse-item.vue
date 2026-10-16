/*
 * wd-collapse-item — 折叠面板项
 *
 * Lynx 实现说明：经 useParent 读取展开状态并 toggle；
 * 内容区高度过渡用 max-height（Lynx 支持有限，用显式高度切换）。
 */
<script lang="ts" setup>
import './index.css'

import { computed } from 'vue-lynx'
import WdIcon from '../wd-icon/wd-icon.vue'
import { collapseItemProps } from './types'
import { useParent } from '../../composables/useParent'
import { COLLAPSE_KEY } from '../wd-collapse/types'
import { isArray, parseStyle } from '../../common/util'

const props = defineProps(collapseItemProps)
const emit = defineEmits(['click'])

const { parent: collapse } = useParent(COLLAPSE_KEY)

const expanded = computed(() => {
  const value = collapse.value?.currentValue.value
  if (isArray(value)) {
    return value.map(String).includes(String(props.name))
  }
  return String(value) === String(props.name)
})

function handleClick() {
  // 禁用态早退：不再先 emit('click') 再 return
  if (props.disabled) return
  emit('click')
  // 传原始 name（保留数字/字符串类型），toggle 内部统一转 String 比较；
  // name 未传时回落空串（与 modelValue 默认 '' 对齐）
  collapse.value?.toggle(props.name ?? '', !expanded.value)
}
</script>

<template>
  <view :class="`wd-collapse-item ${expanded ? 'is-expanded' : ''} ${disabled ? 'is-disabled' : ''} ${customClass}`" :style="parseStyle(customStyle)">
    <view class="wd-collapse-item__header" @tap="handleClick">
      <view v-if="useTitleSlot && $slots.title" class="wd-collapse-item__title-slot">
        <slot name="title" :expanded="expanded" />
      </view>
      <text v-else-if="title" class="wd-collapse-item__title">{{ title }}</text>
      <wd-icon custom-class="wd-collapse-item__arrow" :name="expanded ? 'arrow-up' : 'arrow-down'" />
    </view>
    <view v-if="expanded" class="wd-collapse-item__body">
      <slot />
    </view>
  </view>
</template>
