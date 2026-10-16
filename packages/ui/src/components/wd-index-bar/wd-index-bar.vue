/*
 * wd-index-bar — 索引栏
 *
 * Lynx 实现说明：
 * - 经 useChildren 收集 index-anchor 子项（子组件 setup 内经 link 注册），
 *   右侧索引条触摸跳转到对应锚点：官方 scrollIntoView 方法平滑滚动
 *   （scroll-with-animation 属性 Lynx 不支持，属性定位是瞬时的）；
 * - scrollIntoView 由节点自身定位最近的可滚动祖先，无需度量内容与
 *   视口的相对位置（CONVENTIONS §16：热路径不重复 getRect）；
 * - 索引条自身几何（top/height）挂载后一次性度量并缓存到 ref，touchmove
 *   只读缓存——曾读全仓库无赋值点的 globalThis.__wdIndexBarRect，
 *   永远走 top:0/height:300 兜底，clientY 映射错误。
 */
<script lang="ts" setup>
import './index.css'

import { computed, onMounted, ref, watch } from 'vue-lynx'
import { indexBarProps, indexBarInjectionKey } from './types'
import { useChildren } from '../../composables/useChildren'
import { getRect, scrollIntoViewById, uuid } from '../../common/util'
import { useAlive } from '../../composables/useAlive'

const props = defineProps(indexBarProps)
const isAlive = useAlive()

const indexBarId = ref<string>(`wd-index-bar-${uuid()}`)
const scrollState = ref({
  scrollTop: 0,
  touching: false
})
type AnchorIndex = number | string

const state = ref<{ activeIndex: AnchorIndex }>({
  activeIndex: ''
})

/**
 * 索引条几何缓存（top / height）。
 *
 * 触摸定位曾读 globalThis.__wdIndexBarRect——该全局在全仓库没有任何
 * 赋值点，永远走 top:0 / height:300 兜底，clientY 映射错误。现按
 * CONVENTIONS §16 挂载后一次性度量并缓存，touchmove 热路径只读缓存；
 * 度量不可用（高度为 0）时回落历史默认值，保证映射仍 deterministic。
 */
const sidebarRect = ref<{ top: number; height: number } | null>(null)

/** 索引条默认几何（度量不可用时的兜底，保持历史行为） */
const DEFAULT_SIDEBAR_RECT = { top: 0, height: 300 }

// linkChildren 的 value 与 useChildren 的 link/unlink/children 合并后
// provide：子组件（index-anchor）才能经 link 注册自身，同时读 props/anchorState。
// id 字段把本实例的唯一前缀下发给 anchor——anchor 的 DOM id 由父级前缀 +
// index 派生，避免同页多个 index-bar 时 anchor id 重复（引擎 id→签名注册表
// 错乱，真机 9902 removeNode 家族；scrollIntoViewById 亦按此前缀定位）。
// （曾用第二个 provide 覆盖整个对象，导致 link 丢失、子组件无法注册。）
const { children, linkChildren } = useChildren(indexBarInjectionKey)

linkChildren({
  props: { sticky: props.sticky },
  anchorState: state,
  id: indexBarId.value
})

// 子组件 props 经 c.$.props 读取（CONVENTIONS §13：运行时 proxy.props 不可靠，
// 参照 wd-checkbox-group 的 child.$.props 约定）。
// index 去重：两个 anchor 传入相同 index 时，右侧索引条会出现同 key 兄弟节点，
// keyed diff 在锚点挂载/卸载场景下会错配移除错误的平台节点。
const sidebarIndexes = computed(() => {
  const indexes = children.map((c: any) => c.$?.props?.index).filter((i: any) => i !== undefined)
  return indexes.filter((i: any, idx: number) => indexes.indexOf(i) === idx)
})

/** 一次性度量索引条几何并缓存（挂载 / 索引集合变化时；§16 合规） */
function measureSidebar() {
  getRect(`#${indexBarId.value}-sidebar`).then((rect) => {
    // 度量回调晚于组件卸载落地时丢弃（9902 防护）
    if (!isAlive()) return
    const height = Number(rect && rect.height) || 0
    sidebarRect.value = height > 0 ? { top: Number(rect.top) || 0, height } : null
  })
}

onMounted(measureSidebar)

// 索引数量变化时间隔条高度可能变化（如动态增删锚点），重新度量一次
watch(
  () => sidebarIndexes.value.length,
  () => {
    measureSidebar()
  }
)

function handleTouchStart() {
  scrollState.value.touching = true
}

function handleTouchEnd() {
  scrollState.value.touching = false
}

function handleTouchMove(event: any) {
  // 索引条高度均分，按触点位置计算目标索引（几何读缓存，见 sidebarRect）
  const sidebar = event.currentTarget || event.target
  const touch = event.touches?.[0] || event.changedTouches?.[0] || {}
  const clientY = Number(touch.clientY || 0)
  const count = sidebarIndexes.value.length
  if (count === 0) return
  const rect = sidebarRect.value || DEFAULT_SIDEBAR_RECT
  const index = Math.floor(((clientY - rect.top) / rect.height) * count)
  const target = sidebarIndexes.value[Math.min(Math.max(index, 0), count - 1)]
  if (target !== undefined) {
    state.value.activeIndex = target
    // 把目标锚点平滑滚入可见区（官方 scrollIntoView；scroll-top 属性
    // 从未被更新，仅靠属性锚点跳转实际是空转）。锚点 id 由本实例唯一前缀
    // 派生（anchor 侧同规则拼接），避免同页多 index-bar 跨实例命中。
    scrollIntoViewById(`#${indexBarId.value}-anchor-${target}`, 'start')
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
      :id="`${indexBarId}-sidebar`"
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
