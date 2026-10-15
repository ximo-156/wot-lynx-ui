/*
 * wd-index-bar — 索引栏
 *
 * Lynx 实现说明：
 * - 经 useChildren 收集 index-anchor 子项（子组件 setup 内经 link 注册），
 *   右侧索引条触摸跳转到对应锚点：官方 scrollIntoView 方法平滑滚动
 *   （scroll-with-animation 属性 Lynx 不支持，属性定位是瞬时的）；
 * - scrollIntoView 由节点自身定位最近的可滚动祖先，无需度量内容与
 *   视口的相对位置（CONVENTIONS §16：热路径不重复 getRect）。
 */
<script lang="ts" setup>
import './index.css'

import { computed, ref } from 'vue-lynx'
import { indexBarProps, indexBarInjectionKey } from './types'
import { useChildren } from '../../composables/useChildren'
import { scrollIntoViewById, uuid } from '../../common/util'

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

// linkChildren 的 value 与 useChildren 的 link/unlink/children 合并后
// provide：子组件（index-anchor）才能经 link 注册自身，同时读 props/anchorState。
// （曾用第二个 provide 覆盖整个对象，导致 link 丢失、子组件无法注册。）
const { children, linkChildren } = useChildren(indexBarInjectionKey)

linkChildren({
  props: { sticky: props.sticky },
  anchorState: state
})

// 子组件 props 经 c.$.props 读取（CONVENTIONS §13：运行时 proxy.props 不可靠，
// 参照 wd-checkbox-group 的 child.$.props 约定）。
const sidebarIndexes = computed(() => children.map((c: any) => c.$?.props?.index).filter((i: any) => i !== undefined))

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
    // 把目标锚点平滑滚入可见区（官方 scrollIntoView；scroll-top 属性
    // 从未被更新，仅靠属性锚点跳转实际是空转）
    scrollIntoViewById(`#wd-index-anchor-${target}`, 'start')
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
