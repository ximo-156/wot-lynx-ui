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
import { uuid } from '../../common/util'

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

// DOM id 前缀：优先取父 index-bar 下发的唯一前缀（同页多个 index-bar 时
// anchor id 不重复，与 index-bar 侧 scrollIntoViewById 的拼接口径一致）；
// 父级缺失（独立使用）时退化为实例自身 uuid。历史上这里按
// `wd-index-anchor-${index}` 裸派生，两个 index-bar 的 anchor A/B id
// 完全重复，会撞引擎 id→签名注册表（真机 9902 removeNode 家族）。
const anchorIdPrefix = indexBar?.id || `wd-index-anchor-${uuid()}`

const isSticky = computed(() => Boolean(indexBar?.props?.sticky))
</script>

<template>
  <view :class="`wd-index-anchor ${isSticky ? 'is-sticky' : ''} ${customClass}`" :style="parseStyle(customStyle)" :id="`${anchorIdPrefix}-anchor-${index}`">
    <slot>{{ index }}</slot>
  </view>
</template>
