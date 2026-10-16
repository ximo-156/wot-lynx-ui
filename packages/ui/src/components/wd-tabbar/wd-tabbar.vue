/*
 * wd-tabbar — 标签栏
 *
 * Lynx 实现说明：经 useChildren 向 tabbar-item 提供 setChange；
 * fixed 时 position: fixed 由引擎提升；round 形状悬浮圆角。
 */
<script lang="ts" setup>
import './index.css'
import { parseStyle } from '../../common/util'

import { tabbarProps, TABBAR_KEY } from './types'
import { useChildren } from '../../composables/useChildren'

const props = defineProps(tabbarProps)
const emit = defineEmits(['change', 'update:modelValue'])

const { linkChildren } = useChildren(TABBAR_KEY)

function setChange(child: { name: string | number }) {
  // 点已激活项早退（wot-ui 同）：不重复 update:modelValue / change
  if (child.name === props.modelValue) return
  emit('update:modelValue', child.name)
  // change 载荷与 wot-ui 一致：{ value }
  emit('change', { value: child.name })
}

linkChildren({
  props: props as any,
  setChange
})
</script>

<template>
  <view :class="`wd-tabbar ${fixed ? 'is-fixed' : ''} ${bordered ? 'is-bordered' : ''} ${safeAreaInsetBottom ? 'is-safe-area' : ''} wd-tabbar--${shape} ${customClass}`" :style="parseStyle(customStyle)">
    <slot />
  </view>
</template>
