/*
 * wd-index-anchor — 索引锚点
 *
 * Lynx 实现说明：经 useChildren 向 index-bar 注册索引；
 * sticky 时锚点标题吸顶（position: sticky 降级为 fixed + 占位）。
 */
<script lang="ts" setup>
import './index.css'

import { computed, inject } from 'vue-lynx'
import { indexAnchorProps } from './types'
import { indexBarInjectionKey } from '../wd-index-bar/types'

const props = defineProps(indexAnchorProps)

const indexBar = inject(indexBarInjectionKey, null)

const isSticky = computed(() => Boolean(indexBar?.props.sticky))
</script>

<template>
  <view :class="`wd-index-anchor ${isSticky ? 'is-sticky' : ''} ${customClass}`" :style="customStyle" :id="`wd-index-anchor-${index}`">
    <slot>{{ index }}</slot>
  </view>
</template>
