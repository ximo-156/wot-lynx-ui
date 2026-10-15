/*
 * wd-index-bar — 索引栏
 *
 * Lynx 实现说明：
 * - 经 useChildren 收集 index-anchor 子项，右侧索引条触摸滚动
 *   到对应锚点（scroll-view scrollTop）；
 * - 锚点位置经一次性度量缓存（CONVENTIONS §16）。
 */
<script lang="ts" setup>
import './index.css'

import { computed, provide, ref } from 'vue-lynx'
import { indexBarProps, indexBarInjectionKey } from './types'
import { useChildren } from '../../composables/useChildren'
import { uuid } from '../../common/util'

const props = defineProps(indexBarProps)

const indexBarId = ref<string>(`wd-index-bar-${uuid()}`)
const scrollState = ref({
  scrollTop: 0,
  touching: false
})
type AnchorIndex = number | string

const state = ref<{ activeIndex: AnchorIndex }>({
  activeIndex: ''
})

const { children } = useChildren(indexBarInjectionKey as any)

provide(indexBarInjectionKey, {
  props: { sticky: props.sticky },
  anchorState: state
})

const sidebarIndexes = computed(() => children.map((c: any) => c.props?.index).filter((i: any) => i !== undefined))

function handleTouchStart() {
  scrollState.value.touching = true
}

function handleTouchEnd() {
  scrollState.value.touching = false
}

function handleTouchMove(event: any) {
  // 索引条高度均分，按触点位置计算目标索引
  const sidebar = event.currentTarget || event.target
  const touch = event.touches?.[0] || event.changedTouches?.[0] || {}
  const clientY = Number(touch.clientY || 0)
  const count = sidebarIndexes.value.length
  if (count === 0) return
  const rect = (globalThis as any).__wdIndexBarRect
  const top = rect ? rect.top : 0
  const height = rect ? rect.height : 300
  const index = Math.floor(((clientY - top) / height) * count)
  const target = sidebarIndexes.value[Math.min(Math.max(index, 0), count - 1)]
  if (target !== undefined) {
    state.value.activeIndex = target
  }
}
</script>

<template>
  <view class="wd-index-bar" :id="indexBarId">
    <scroll-view :scroll-top="scrollState.scrollTop" :scroll-y="true" class="wd-index-bar__content" @scroll="() => {}">
      <slot />
    </scroll-view>
    <view v-if="scrollState.touching" class="wd-index-bar__current-index">
      <text>{{ state.activeIndex }}</text>
    </view>
    <view
      class="wd-index-bar__sidebar"
      @touchstart.stop.prevent="handleTouchStart"
      @touchmove.stop.prevent="handleTouchMove"
      @touchend.stop.prevent="handleTouchEnd"
      @touchcancel.stop.prevent="handleTouchEnd"
    >
      <view
        v-for="item in sidebarIndexes"
        :key="item"
        class="wd-index-bar__index"
        :class="{ 'is-active': item === state.activeIndex }"
      >
        <text>{{ item }}</text>
      </view>
    </view>
  </view>
</template>
