/*
 * wd-tab — 选项卡面板
 *
 * Lynx 实现说明：经 useParent 向 wd-tabs 注册自身
 * （name/title/disabled/lazy/badgeProps）；非激活且 lazy 时不渲染。
 */
<script lang="ts" setup>
import './index.css'

import { computed } from 'vue-lynx'
import { tabProps } from './types'
import { useParent } from '../../composables/useParent'
import { TABS_KEY } from '../wd-tabs/types'
import { isDef, parseStyle } from '../../common/util'

const props = defineProps(tabProps)

const { parent: tabs, index } = useParent(TABS_KEY)

const active = computed(() => {
  if (!tabs.value) return true
  const modelValue = tabs.value.props.modelValue
  if (isDef(props.name)) {
    return props.name === modelValue
  }
  return index.value === modelValue
})

const shouldBeRender = computed(() => {
  if (!props.lazy) return true
  if (active.value) return true
  // 激活过就保持渲染
  return tabs.value?.isRendered(index.value) || false
})

const tabBodyStyle = computed(() => {
  return {}
})
</script>

<template>
  <view :class="`wd-tab ${customClass}`" :style="parseStyle(customStyle)">
    <view :class="['wd-tab__body', { 'wd-tab__body--inactive': !active }]" v-if="shouldBeRender" :style="tabBodyStyle">
      <slot />
    </view>
  </view>
</template>
