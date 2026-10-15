/*
 * wd-tabbar — 标签栏
 *
 * Lynx 实现说明：经 useChildren 向 tabbar-item 提供 setChange；
 * fixed 时 position: fixed 由引擎提升；round 形状悬浮圆角。
 */
<script lang="ts" setup>
import './index.css'

import { tabbarProps, TABBAR_KEY } from './types'
import { useChildren } from '../../composables/useChildren'

const props = defineProps(tabbarProps)
const emit = defineEmits(['change', 'update:modelValue'])

const { linkChildren } = useChildren(TABBAR_KEY)

function setChange(child: { name: string | number }) {
  emit('update:modelValue', child.name)
  emit('change', { name: child.name })
}

linkChildren({
  props: props as any,
  setChange
})
</script>

<template>
  <view :class="`wd-tabbar ${fixed ? 'is-fixed' : ''} ${bordered ? 'is-bordered' : ''} ${safeAreaInsetBottom ? 'is-safe-area' : ''} wd-tabbar--${shape} ${customClass}`" :style="customStyle">
    <slot />
  </view>
</template>
