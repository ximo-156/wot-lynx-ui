<template>
  <view class="wd-index-bar" :id="indexBarId">
    <scroll-view :scrollTop="scrollState.scrollTop" :scroll-y="true" class="wd-index-bar__content" @scroll="hanleScroll">
        <slot></slot>
      </scroll-view>
      <view v-if="scrollState.touching" class="wd-index-bar__current-index"><text>{{ state.activeIndex }}</text></view>
      <view
        class="wd-index-bar__sidebar"
        @touchstart.stop.prevent="handleTouchStart"
        @touchmove.stop.prevent="handleTouchMove"
        @touchend.stop.prevent="handleTouchEnd"
        @touchcancel.stop.prevent="handleTouchEnd"
      >
        <view class="wd-index-bar__index" :class="{ 'is-active': item.index === state.activeIndex }" v-for="item in children" :key="item.index">
          <text>{{ item.index }}</text>
        </view>
      </view>
    </view>
</template>

<script setup lang="ts">
import './index.css'
import type { AnchorIndex } from './type'
import { indexBarInjectionKey, indexBarProps } from './type'
import { ref, getCurrentInstance, onMounted, reactive, nextTick, watch } from 'vue-lynx'
import { getRect, isDef, uuid, pause } from '../../common/util'
import { useChildren } from '../../composables/useChildren'

const props = defineProps(indexBarProps)

const indexBarId = ref<string>(`indexBar${uuid()}`)

const { proxy } = getCurrentInstance()!

const state = reactive({
  activeIndex: null as AnchorIndex | null
})

const { linkChildren, children } = useChildren(indexBarInjectionKey)

linkChildren({ props, anchorState: state })

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

const scrollState = reactive({
  scrollTop: 0, // 即将滚动到的位置
  prevScrollTop: 0, // 上次记录的位置
  // 滚动距离
  touching: false
})

// 组件距离页面顶部的高度
let offsetTop = 0
let sidebarInfo = {
  // 侧边栏距离顶部的高度
  offsetTop: 0,
  // 高度固定24px
  indexHeight: 24
}

function init() {
  setTimeout(() => {
    Promise.all([
      getRect(`#${indexBarId.value}`, false, proxy),
      getRect('.wd-index-bar__sidebar', false, proxy),
      getRect('.wd-index-bar__index', false, proxy)
    ]).then(([bar, sidebar, index]) => {
      offsetTop = bar.top!
      sidebarInfo.offsetTop = sidebar.top!
      sidebarInfo.indexHeight = index.height!
    })
      .catch((error) => {
        // 节点度量失败（无匹配节点 / 宿主不支持 SelectorQuery）时跳过初始化定位，
        // 避免未处理的 Promise 拒绝被 Sentry 上报为 USER_RUNTIME_ERROR。
      })
  }, 100)
}

onMounted(() => {
  init()
})

function hanleScroll(scrollEvent: any) {
  if (scrollState.touching) {
    return
  }
  const { detail } = scrollEvent
  const scrolltop = Math.floor(detail.scrollTop)
  const anchor = children.find((item, index) => {
    if (!isDef(children[index + 1])) return true
    // 子 anchor 可能尚未暴露 exposed，非空断言会抛错中断滚动联动
    const cur = item.$ && item.$.exposed ? item.$.exposed.top.value : 0
    const next = children[index + 1].$ && children[index + 1].$.exposed ? children[index + 1].$.exposed.top.value : 0
    if (cur - offsetTop <= scrolltop && next - offsetTop > scrolltop) return true
    return false
  })
  if (isDef(anchor) && state.activeIndex !== anchor.index) {
    state.activeIndex = anchor.index
  }
  scrollState.prevScrollTop = scrolltop
}

function getAnchorByPageY(pageY: number) {
  // children 为空（无子 anchor）时返回 undefined，调用方需判空
  if (children.length === 0) return undefined
  const y = pageY - sidebarInfo.offsetTop
  let idx = Math.floor(y / sidebarInfo.indexHeight)
  if (!Number.isFinite(idx) || idx < 0) idx = 0
  else if (idx > children.length - 1) idx = children.length - 1
  return children[idx]
}

function handleTouchStart() {
  scrollState.touching = true
}

function handleTouchMove(e: TouchEvent) {
  // touches 可能为空数组（异常事件序列），touches[0] 取属性会抛 TypeError
  const clientY = e.touches && e.touches[0] ? e.touches[0].pageY : 0
  const anchor = getAnchorByPageY(clientY)
  if (!anchor) return
  if (state.activeIndex === anchor.index) {
    return
  }
  state.activeIndex = anchor.index
  const top = anchor.$ && anchor.$.exposed ? anchor.$.exposed.top.value : 0
  setScrollTop(top - offsetTop)
}

async function handleTouchEnd(e: TouchEvent) {
  const clientY = e.changedTouches && e.changedTouches[0] ? e.changedTouches[0].pageY : 0
  const anchor = getAnchorByPageY(clientY)
  if (!anchor) {
    scrollState.touching = false
    return
  }
  state.activeIndex = anchor.index
  const top = anchor.$ && anchor.$.exposed ? anchor.$.exposed.top.value : 0
  setScrollTop(top - offsetTop)
  await pause()
  scrollState.touching = false
}

function setScrollTop(top: number) {
  if (scrollState.scrollTop === top) {
    scrollState.scrollTop = scrollState.prevScrollTop
    nextTick(() => {
      scrollState.scrollTop = top
    })
  } else {
    scrollState.scrollTop = top
  }
}
</script>

