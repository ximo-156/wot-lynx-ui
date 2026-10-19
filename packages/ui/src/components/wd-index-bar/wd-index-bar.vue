/*
 * wd-index-bar — 索引栏
 *
 * Lynx 实现说明（相对 wot-ui 2.3.2 的适配点）：
 * - 子锚点经 useChildren/useParent 注册（indexBarInjectionKey 提供
 *   props / anchorState / id），右侧索引条 v-for children 渲染——
 *   锚点注册发生在挂载阶段，首帧索引条为空、次帧补齐（与参考源一致）；
 * - 索引去重：两个 anchor 传相同 index 时右侧索引条会出现同 key 兄弟节点，
 *   keyed diff 在锚点挂载/卸载场景下会错配移除错误的平台节点，故
 *   sidebarIndexes 去重后渲染（docs/guide/native-crash-audit.md 的 P1 修复）；
 * - 索引条自身几何（top / height）挂载后一次性度量并缓存，touchmove 热路径
 *   只读缓存（CONVENTIONS §16）；度量不可用（高度为 0）时回落默认几何
 *   { top: 0, height: 300 }，触点映射仍 deterministic；
 * - 触点→索引映射：参考源按「单项实测高度」均分（sidebarInfo.indexHeight），
 *   度量缺失时除数为 0；此处按索引条整体高度等比映射
 *   （floor((pageY - top) / height * count)），对度量缺失更稳健，语义等价；
 * - 触摸跳转：参考源经 scroll-top 属性 + nextTick 强制刷新定位；Lynx 下改用
 *   官方 scrollIntoView（SelectorQuery.invoke，见 common/util）按锚点 id 把
 *   目标滚入可见区——无需度量内容与视口的相对位置，也不依赖 scroll-top
 *   属性被引擎应用（PORTING §3.9：平台能力按 Lynx API 等价实现）。锚点 id
 *   由本实例唯一前缀派生（anchor 侧同规则拼接），避免同页多 index-bar
 *   跨实例命中；
 * - 触点纵坐标取 pageY，缺失时回落 clientY（Lynx 触摸事件两者都可能提供）；
 * - 滚动联动：参考源经 hanleScroll 比较各锚点 top 与滚动位置刷新激活索引，
 *   锚点 top 由各 anchor 挂载后 getRect 实测并经 defineExpose 暴露、
 *   经 anchorTop() 防御式读取（$.exposed 未就绪时取 0）；getRect 不可用
 *   （零矩形）时该联动退化为不更新，不影响触摸跳转；
 * - 文本节点包 text 元素（Lynx view 内裸文本不渲染）。
 */
<script lang="ts" setup>
import './index.css'

import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue-lynx'
import { indexBarInjectionKey, indexBarProps } from './types'
import { useChildren } from '../../composables/useChildren'
import { getRect, isDef, pause, scrollIntoViewById, uuid } from '../../common/util'
import { useAlive } from '../../composables/useAlive'

const props = defineProps(indexBarProps)
const isAlive = useAlive()

const indexBarId = ref<string>(`wd-index-bar-${uuid()}`)

const scrollState = reactive({
  scrollTop: 0, // 即将滚动到的位置
  prevScrollTop: 0, // 上次记录的位置
  // 滚动距离
  touching: false
})

type AnchorIndex = number | string

const state = reactive({
  activeIndex: null as AnchorIndex | null
})

const { linkChildren, children } = useChildren(indexBarInjectionKey)

linkChildren({ props, anchorState: state, id: indexBarId.value })

watch(
  () => children,
  (newValue) => {
    if (!newValue.length) {
      state.activeIndex = null // 或者设置为一个默认值，如第一个子项的索引
      return
    }

    if (!isDef(state.activeIndex) || !newValue.find((item) => item.index === state.activeIndex)) {
      state.activeIndex = newValue[0].index
    }
  },
  { deep: true, immediate: true }
)

// 组件距离页面顶部的高度（滚动联动用，挂载后一次性度量）
let offsetTop = 0

/**
 * 索引条几何缓存（top / height）：挂载后一次性度量，touchmove 只读缓存。
 */
const sidebarRect = ref<{ top: number; height: number } | null>(null)

/** 索引条默认几何（度量不可用时的兜底，保持历史行为） */
const DEFAULT_SIDEBAR_RECT = { top: 0, height: 300 }

/** 一次性度量索引条几何并缓存（挂载 / 索引集合变化时；§16 合规） */
function measureSidebar() {
  getRect(`#${indexBarId.value}-sidebar`).then((rect) => {
    // 度量回调晚于组件卸载落地时丢弃（9902 防护）
    if (!isAlive()) return
    const height = Number(rect && rect.height) || 0
    sidebarRect.value = height > 0 ? { top: Number(rect.top) || 0, height } : null
  })
}

onMounted(() => {
  measureSidebar()
  // 索引数量变化时间隔条高度可能变化（如动态增删锚点），次帧再补一次
  nextTick(measureSidebar)
  getRect(`#${indexBarId.value}`).then((rect) => {
    if (!isAlive()) return
    offsetTop = Number(rect && rect.top) || 0
  })
})

// 子组件 props 经 c.$.props 读取（CONVENTIONS §13：运行时 proxy.props 不可靠，
// 参照 wd-checkbox-group 的 child.$.props 约定）。
const sidebarIndexes = computed(() => {
  const indexes = children.map((c: any) => c.$?.props?.index).filter((i: any) => i !== undefined)
  return indexes.filter((i: any, idx: number) => indexes.indexOf(i) === idx)
})

// 索引数量变化时间隔条高度可能变化（如动态增删锚点），重新度量一次
watch(
  () => sidebarIndexes.value.length,
  () => {
    measureSidebar()
  }
)

/** 取锚点暴露的 top（未暴露 / 未挂载时为 0） */
function anchorTop(child: any): number {
  const exposed = child && child.$ && child.$.exposed
  const top = exposed && exposed.top
  return Number((top && top.value) || 0)
}

function hanleScroll(scrollEvent: any) {
  if (scrollState.touching) {
    return
  }
  const { detail } = scrollEvent
  const scrolltop = Math.floor(detail.scrollTop)
  const anchor = children.find((item, index) => {
    if (!isDef(children[index + 1])) return true
    if (anchorTop(item) - offsetTop <= scrolltop && anchorTop(children[index + 1]) - offsetTop > scrolltop) return true
    return false
  })
  if (isDef(anchor) && state.activeIndex !== anchor.index) {
    state.activeIndex = anchor.index
  }
  scrollState.prevScrollTop = scrolltop
}

function getAnchorByPageY(pageY: number) {
  const count = sidebarIndexes.value.length
  if (count === 0) return undefined
  const rect = sidebarRect.value || DEFAULT_SIDEBAR_RECT
  const idx = Math.floor(((pageY - rect.top) / rect.height) * count)
  return children[Math.min(Math.max(idx, 0), count - 1)]
}

function handleTouchStart() {
  scrollState.touching = true
}

function handleTouchMove(e: TouchEvent) {
  const touch = (e.touches && e.touches[0]) || (e.changedTouches && e.changedTouches[0]) || ({} as any)
  const pageY = Number(isDef(touch.pageY) ? touch.pageY : touch.clientY)
  const target = getAnchorByPageY(pageY)
  if (!target) return
  if (state.activeIndex === target.index) {
    return
  }
  state.activeIndex = target.index
  setScrollTop(target)
}

async function handleTouchEnd(e: TouchEvent) {
  const touch = (e.changedTouches && e.changedTouches[0]) || (e.touches && e.touches[0]) || ({} as any)
  const pageY = Number(isDef(touch.pageY) ? touch.pageY : touch.clientY)
  const target = getAnchorByPageY(pageY)
  if (target) {
    state.activeIndex = target.index
    setScrollTop(target)
  }
  await pause()
  scrollState.touching = false
}

/**
 * 把目标锚点滚入可见区。
 *
 * Lynx 适配：参考源经 setScrollTop 写 scroll-top 属性（并靠 nextTick 强制
 * 刷新），此处改用官方 scrollIntoView 按锚点 id 定位。
 */
function setScrollTop(target: any) {
  scrollIntoViewById(`#${indexBarId.value}-anchor-${target.index}`, 'start')
}
</script>

<template>
  <view class="wd-index-bar" :id="indexBarId">
    <scroll-view :scroll-top="scrollState.scrollTop" :scroll-y="true" class="wd-index-bar__content" @scroll="hanleScroll">
      <slot></slot>
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
      <view class="wd-index-bar__index" :class="{ 'is-active': item === state.activeIndex }" v-for="item in sidebarIndexes" :key="item">
        <text>{{ item }}</text>
      </view>
    </view>
  </view>
</template>
