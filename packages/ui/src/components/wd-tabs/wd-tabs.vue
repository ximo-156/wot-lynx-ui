/*
 * wd-tabs — 选项卡
 *
 * Lynx 实现说明：
 * - 经 useChildren 收集子 wd-tab（name/title/disabled/badgeProps），
 *   维护激活索引与已渲染集合（懒渲染保持）；
 * - 指示线位置经一次性度量各 tab 宽度后以 transform 定位，
 *   tab 集合变化时重新度量（CONVENTIONS §16：不在触摸热路径度量）。
 */
<script lang="ts" setup>
import './index.css'

import { computed, getCurrentInstance, onMounted, ref, useSlots, watch } from 'vue-lynx'
import WdBadge from '../wd-badge/wd-badge.vue'
import { tabsProps } from './types'
import { useChildren } from '../../composables/useChildren'
import { TABS_KEY } from './types'
import { getRect, isObj, parseStyle } from '../../common/util'
import { useAlive } from '../../composables/useAlive'

const props = defineProps(tabsProps)
const emit = defineEmits(['change', 'click', 'update:modelValue'])

// setup 时捕获实例代理（事件处理器中 getCurrentInstance() 为 null）
const tabsProxy = (getCurrentInstance() as any)?.proxy

const { children, linkChildren } = useChildren(TABS_KEY)
const isAlive = useAlive()

const state = ref({
  activeIndex: 0,
  scrollLeft: 0,
  lineStyle: {} as Record<string, string>,
  inited: false
})

/** 已渲染过的 tab 索引集合（懒渲染保持） */
const renderedSet = ref<Set<number>>(new Set())

/**
 * 导航项缓存。
 *
 * 必须是 ref：曾是非响应式 let，innerSlidable / activeIndex 两个 computed
 * 在首帧求值时 navCache 还是 []，computed 没有任何响应式依赖被永久缓存
 * （false / 0）——is-slide 永不添加、scroll-x 恒 false，多 tab 导航不可滚动。
 */
const navCache = ref<Array<{ title: any; disabled: boolean; badgeProps: any; name: any }>>([])

const innerSlidable = computed(() => navCache.value.length > props.slidableNum)

const slots = useSlots()

/** 深比较（common/util 的 isEqual 只做数组浅比较，对象项恒不相等） */
function deepEqual(a: any, b: any): boolean {
  if (a === b) return true
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((item, index) => deepEqual(item, b[index]))
  }
  if (isObj(a) && isObj(b)) {
    const objA = a as Record<string, any>
    const objB = b as Record<string, any>
    const keysA = Object.keys(objA)
    const keysB = Object.keys(objB)
    return keysA.length === keysB.length && keysA.every((key) => deepEqual(objA[key], objB[key]))
  }
  return false
}

/**
 * 导航项：从默认插槽的 vnodes 直读 props。
 * 不依赖子组件 link 数组——子选项卡挂载晚于导航首帧渲染，
 * 且部分运行环境下 link 后的响应式更新不会反映到 DOM。
 *
 * 注意：slots.default() 只能在渲染上下文调用（否则子组件 setup
 * 拿到 null instance）。故模板每次渲染时求值并写入 navCache，
 * 事件处理器只读 navCache，不再调用 slot。
 *
 * 写入带深比较哨兵：每次渲染都会生成新的 items 数组（含消费方可能新建的
 * badgeProps 对象），若无条件写 ref 会在渲染期间反复触发依赖它的 computed
 * → 无限重渲染（Maximum recursive updates exceeded）。navCache 只作为
 * innerSlidable / activeIndex 的响应式数据源，内容一致时保留原引用；
 * 渲染始终返回新数组，避免缓存导致 badgeProps 陈旧。
 */
function navItems(): Array<{ title: any; disabled: boolean; badgeProps: any; name: any }> {
  const vnodes = slots.default ? slots.default() : []
  const items: Array<{ title: any; disabled: boolean; badgeProps: any; name: any }> = []
  for (const vnode of vnodes as any[]) {
    const p = vnode && vnode.props
    if (!p) continue
    items.push({
      title: p.title,
      disabled: Boolean(p.disabled),
      badgeProps: p.badgeProps,
      name: p.name
    })
  }
  if (!deepEqual(navCache.value, items)) {
    navCache.value = items
  }
  return items
}

const activeIndex = computed(() => {
  const items = navCache.value
  const index = items.findIndex((p) => p.name === props.modelValue)
  return index > -1 ? index : Number(props.modelValue) || 0
})

const showScrollbar = computed(() => true)

watch(
  () => props.modelValue,
  () => {
    state.value.activeIndex = activeIndex.value
    renderedSet.value.add(state.value.activeIndex)
    updateLineStyle()
  },
  { immediate: true }
)

onMounted(() => {
  state.value.activeIndex = activeIndex.value
  renderedSet.value.add(state.value.activeIndex)
  state.value.inited = true
  // 首帧后必须补一次指示线度量：watch(modelValue, { immediate: true }) 在
  // setup 阶段就发起了 getRect，此时节点尚未挂载 → 度量到零矩形，指示线宽度
  // 为 0 / 位置错位；旧实现此后只在 modelValue 变化时更新，首屏指示线一直失效。
  updateLineStyle()
})

function isRendered(index: number): boolean {
  return renderedSet.value.has(index)
}

// 直接提供 reactive 的 props 对象，子选项卡读取的 modelValue 保持响应式
linkChildren({
  props: props as any,
  isRendered
})

function handleSelect(index: number) {
  const item = navCache.value[index]
  if (!item || item.disabled) return
  state.value.activeIndex = index
  renderedSet.value.add(index)
  const value = item.name !== undefined ? item.name : index
  emit('update:modelValue', value)
  emit('change', { index, name: item.name })
  emit('click', { index, name: item.name })
  updateLineStyle()
}

function getTabItemStyle(index: number): Record<string, string> {
  return {}
}

/** 指示线定位：度量各 tab 宽度，累计偏移 */
function updateLineStyle() {
  getRect('.wd-tabs__nav-item', true, tabsProxy).then((rects: any[]) => {
    // 度量回调晚于组件卸载落地时丢弃：在已销毁树上写 ref 会触发 vue-lynx
    // 继续 patch，产生晚到的 remove/insert（真机 9902 removeNode 家族）。
    if (!isAlive()) return
    if (!rects || rects.length === 0) return
    const index = state.value.activeIndex
    const rect = rects[index]
    if (!rect) return
    const left = rects.slice(0, index).reduce((prev, curr) => prev + Number(curr.width), 0)
    const width = props.lineWidth ? (typeof props.lineWidth === 'number' ? `${props.lineWidth}px` : props.lineWidth) : `${Number(rect.width)}px`
    const height = props.lineHeight ? (typeof props.lineHeight === 'number' ? `${props.lineHeight}px` : props.lineHeight) : '3px'
    state.value.lineStyle = {
      width,
      height,
      transform: `translateX(${left + (Number(rect.width) - (props.lineWidth ? Number(props.lineWidth) : Number(rect.width))) / 2}px)`
    }
  })
}

const rootClass = computed(() => {
  const classes = ['wd-tabs']
  if (innerSlidable.value) classes.push('is-slide')
  if (props.animated) classes.push('is-animated')
  if (props.customClass) classes.push(props.customClass)
  return classes.join(' ')
})
</script>

<template>
  <view :class="rootClass" :style="parseStyle(customStyle)">
    <view class="wd-tabs__nav">
      <view class="wd-tabs__nav--wrap">
        <scroll-view :scroll-x="innerSlidable" scroll-with-animation :scroll-left="state.scrollLeft" enhanced :show-scrollbar="false">
          <view class="wd-tabs__nav-container">
            <view
              v-for="(item, index) in navItems()"
              :key="index"
              :class="`wd-tabs__nav-item ${state.activeIndex === index ? 'is-active' : ''} ${item.disabled ? 'is-disabled' : ''}`"
              :style="getTabItemStyle(index)"
              @tap="handleSelect(index)"
            >
              <wd-badge v-if="item.badgeProps" v-bind="item.badgeProps">
                <text class="wd-tabs__nav-item-text">{{ item.title }}</text>
              </wd-badge>
              <text v-else class="wd-tabs__nav-item-text">{{ item.title }}</text>
            </view>
            <view class="wd-tabs__line" :class="`wd-tabs__line--${lineTheme}`" :style="state.lineStyle" />
          </view>
        </scroll-view>
      </view>
    </view>
    <view class="wd-tabs__body">
      <slot />
    </view>
  </view>
</template>
