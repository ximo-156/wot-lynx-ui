/*
 * wd-sidebar — 侧边导航
 *
 * Lynx 实现说明（相对 wot-ui 的适配点）：
 * - 参考源根 view 直接绑定 customStyle 字符串，Lynx 的 patchProp 对字符串
 *   style 会静默丢弃（CONVENTIONS §19），改为 parseStyle(customStyle) 归一
 *   的对象语法；
 * - 经 useChildren 向 sidebar-item 提供 props + setChange，setChange 经
 *   callInterceptor 支持 before-change 同步/异步拦截；
 * - 根 view 非交互节点（无可点击语义），不涉及事件映射。
 */
<script lang="ts" setup>
import './index.css'

import { parseStyle } from '../../common/util'
import { sidebarProps } from './types'
import { useChildren } from '../../composables/useChildren'
import { SIDEBAR_KEY } from './types'
import { callInterceptor } from '../../common/interceptor'

const props = defineProps(sidebarProps)
const emit = defineEmits(['change', 'update:modelValue'])

const { linkChildren } = useChildren(SIDEBAR_KEY)

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

linkChildren({
  props,
  setChange
})
</script>

<template>
  <view :class="`wd-sidebar ${customClass}`" :style="parseStyle(customStyle)">
    <slot></slot>
    <view class="wd-sidebar__padding"></view>
  </view>
</template>
