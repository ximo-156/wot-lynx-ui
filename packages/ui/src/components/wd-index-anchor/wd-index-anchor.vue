/*
 * wd-index-anchor — 索引锚点
 *
 * Lynx 实现说明：向 index-bar 注册自身（link/unlink），sticky 时锚点
 * 标题吸顶（position: sticky 降级为 fixed + 占位）。
 */
<script lang="ts" setup>
import './index.css'
import { parseStyle } from '../../common/util'

import { computed, getCurrentInstance, inject, onUnmounted } from 'vue-lynx'
import { indexAnchorProps } from './types'
import { indexBarInjectionKey } from '../wd-index-bar/types'

const props = defineProps(indexAnchorProps)

// 注册契约与 useParent 一致（setup 同步 inject + link，卸载时 unlink），
// 但父组件未暴露 link（旧版 index-bar 的 provide 形状）时静默跳过而非
// 崩溃——新旧父组件形状下均可安全挂载。
const indexBar = inject(indexBarInjectionKey, null) as any

if (indexBar && typeof indexBar.link === 'function') {
  const instance = getCurrentInstance()!
  indexBar.link(instance)
  onUnmounted(() => indexBar.unlink(instance))
}

const isSticky = computed(() => Boolean(indexBar?.props?.sticky))
</script>

<template>
  <view :class="`wd-index-anchor ${isSticky ? 'is-sticky' : ''} ${customClass}`" :style="parseStyle(customStyle)" :id="`wd-index-anchor-${index}`">
    <slot>{{ index }}</slot>
  </view>
</template>
