/*
 * wd-sidebar — 侧边导航
 *
 * Lynx 实现说明：经 useChildren 向 sidebar-item 提供
 * props + setChange；setChange 经 callInterceptor 支持 beforeChange。
 */
<script lang="ts" setup>
import './index.css'
import { parseStyle } from '../../common/util'

import { sidebarProps, type SidebarProvide } from './types'
import { useChildren } from '../../composables/useChildren'
import { SIDEBAR_KEY } from './types'
import { callInterceptor } from '../../common/interceptor'

const props = defineProps(sidebarProps)
const emit = defineEmits(['change', 'update:modelValue'])

const { children, linkChildren } = useChildren(SIDEBAR_KEY)

function setChange(value: number | string, label: string) {
  callInterceptor(props.beforeChange, {
    args: [value],
    done: () => {
      emit('update:modelValue', value)
      emit('change', { value, label })
    }
  })
}

linkChildren({
  props: props as any,
  setChange
})
</script>

<template>
  <view :class="`wd-sidebar ${customClass}`" :style="parseStyle(customStyle)">
    <slot />
    <view class="wd-sidebar__padding" />
  </view>
</template>
