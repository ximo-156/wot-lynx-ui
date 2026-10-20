/*
 * wd-pull-refresh — 下拉刷新
 *
 * Lynx 实现说明：
 * - 结构：view.wd-pull-refresh > 刷新提示区 + 内容区；
 * - 使用原生 scroll-view 的 scroll 事件实现下拉刷新；
 * - 状态机：pulling → loosing → loading → success；
 * - 根节点三件套：display: flex + flex-direction: column；
 * - Style Funnel：rootStyle 经 defineStyleKeys + resolveStyle 输出完整键集。
 */
<script lang="ts" setup>
import './index.css'

import { computed, ref, watch } from 'vue-lynx'
import WdLoading from '../wd-loading/wd-loading.vue'
import { pullRefreshProps } from './types'
import { parseStyle } from '../../common/util'
import { defineStyleKeys, resolveStyle } from '../../common/style'

const props = defineProps(pullRefreshProps)
const emit = defineEmits(['refresh', 'update:modelValue'])

type RefreshStatus = 'normal' | 'pulling' | 'loosing' | 'loading' | 'success'

const status = ref<RefreshStatus>('normal')
const pullDistance = ref(0)

const PULL_STYLE = defineStyleKeys({
  transform: 'translateY(0px)'
})

const rootStyle = computed(() => {
  return {
    ...resolveStyle(PULL_STYLE, {
      transform: `translateY(${pullDistance.value}px)`
    }),
    ...parseStyle(props.customStyle)
  }
})

const statusText = computed(() => {
  switch (status.value) {
    case 'pulling':
      return props.pullingText
    case 'loosing':
      return props.loosingText
    case 'loading':
      return props.loadingText
    case 'success':
      return props.successText
    default:
      return ''
  }
})

watch(
  () => props.modelValue,
  (newVal) => {
    if (newVal) {
      status.value = 'loading'
    } else if (status.value === 'loading') {
      status.value = 'success'
      setTimeout(() => {
        status.value = 'normal'
        pullDistance.value = 0
      }, props.successDuration)
    }
  }
)

function onScroll(e: any) {
  if (props.disabled || status.value === 'loading') return
  const { scrollTop } = e.detail
  if (scrollTop <= 0) {
    const distance = Math.min(Math.abs(scrollTop), props.headHeight)
    pullDistance.value = distance
    if (distance >= props.headHeight) {
      status.value = 'loosing'
    } else if (distance > 0) {
      status.value = 'pulling'
    } else {
      status.value = 'normal'
    }
  }
}

function onTouchEnd() {
  if (props.disabled || status.value === 'loading') return
  if (status.value === 'loosing') {
    status.value = 'loading'
    emit('update:modelValue', true)
    emit('refresh')
  } else {
    status.value = 'normal'
    pullDistance.value = 0
  }
}
</script>

<template>
  <view class="wd-pull-refresh" :class="customClass" :style="rootStyle">
    <view class="wd-pull-refresh__head" :style="{ height: `${headHeight}px` }">
      <view v-if="status === 'loading'" class="wd-pull-refresh__loading">
        <wd-loading size="16px" />
        <text class="wd-pull-refresh__text">{{ statusText }}</text>
      </view>
      <text v-else-if="statusText" class="wd-pull-refresh__text">{{ statusText }}</text>
    </view>
    <scroll-view
      class="wd-pull-refresh__scroll"
      scroll-y
      :scroll-top="0"
      @scroll="onScroll"
      @touchend="onTouchEnd"
    >
      <slot />
    </scroll-view>
  </view>
</template>
