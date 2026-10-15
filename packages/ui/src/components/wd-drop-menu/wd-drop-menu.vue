/*
 * wd-drop-menu — 下拉菜单
 *
 * Lynx 实现说明：经 useChildren 向 drop-menu-item 提供 offset/fold；
 * 展开项经 wd-popup 定位在菜单栏下方。
 */
<script lang="ts" setup>
import './index.css'

import { computed, ref } from 'vue-lynx'
import WdOverlay from '../wd-overlay/wd-overlay.vue'
import WdPopup from '../wd-popup/wd-popup.vue'
import { dropMenuProps, DROP_MENU_KEY } from './types'
import { useChildren } from '../../composables/useChildren'

const props = defineProps(dropMenuProps)

const offset = ref<number>(0)

const { children, linkChildren } = useChildren(DROP_MENU_KEY)

function fold(child?: any) {
  children.forEach((c: any) => {
    if (!child || c !== child) {
      // 关闭其他展开项由各 item 自身状态控制
    }
  })
}

linkChildren({
  props: props as any,
  offset,
  fold
})

const showOverlay = computed(() => {
  return children.some((c: any) => c.props?.modelValue)
})
</script>

<template>
  <view :class="`wd-drop-menu ${customClass}`" :style="customStyle">
    <slot />
    <wd-overlay v-if="modal" :show="showOverlay" :lock-scroll="false" :z-index="zIndex - 1" custom-style="background-color: transparent;" />
  </view>
</template>
