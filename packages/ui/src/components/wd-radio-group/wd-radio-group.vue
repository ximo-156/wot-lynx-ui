/*
 * wd-radio-group — 单选框组
 *
 * Lynx 实现说明：
 * - 经 useChildren 向子单选框提供共享配置与 updateValue；
 * - 横向排列时根容器显式 display: flex（Lynx 3.x linear 布局默认纵向）。
 */
<script lang="ts" setup>
import './index.css'
import { parseStyle } from '../../common/util'

import { computed } from 'vue-lynx'
import { radioGroupProps } from './types'
import { useChildren } from '../../composables/useChildren'
import { RADIO_GROUP_KEY } from '../../composables/useRadioGroup'

const props = defineProps(radioGroupProps)
const emit = defineEmits(['change', 'update:modelValue'])

const { linkChildren } = useChildren(RADIO_GROUP_KEY)

linkChildren({ props, updateValue })

const rootClass = computed(() => {
  const classes = ['wd-radio-group', `wd-radio-group--${props.direction}`]
  if (props.customClass) classes.push(props.customClass)
  return classes.join(' ')
})

/**
 * 处理 radio 子节点通知
 */
function updateValue(value: string | number | boolean | null) {
  emit('update:modelValue', value)
  emit('change', { value })
}
</script>

<template>
  <view :class="rootClass" :style="parseStyle(customStyle)">
    <slot />
  </view>
</template>
