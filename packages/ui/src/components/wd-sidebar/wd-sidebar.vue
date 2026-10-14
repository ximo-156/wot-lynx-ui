<template>
  <view :class="`wd-sidebar ${customClass}`" :style="styleToObject(customStyle)">
    <slot></slot>
    <view class="wd-sidebar__padding"></view>
  </view>
</template>

<script setup lang="ts">
import './index.css'
import { styleToObject } from '../../common/util'
import { callInterceptor } from '../../common/interceptor'
import { useChildren } from '../../composables/useChildren'
import { SIDEBAR_KEY, sidebarProps } from './types'

const props = defineProps(sidebarProps)
const emit = defineEmits(['change', 'update:modelValue'])

const { linkChildren } = useChildren(SIDEBAR_KEY)
linkChildren({ props, setChange })

/**
 * 子项状态变更
 * @param value 目标值
 * @param label 目标值标题
 */
function setChange(value: number | string, label: string) {
  callInterceptor(props.beforeChange, {
    args: [value],
    done: () => updateValue(value, label)
  })
}

/**
 * 更新选中状态
 * @param value 目标值
 * @param label 目标值标题
 */
function updateValue(value: number | string, label: string) {
  emit('update:modelValue', value)
  emit('change', { value, label })
}
</script>

