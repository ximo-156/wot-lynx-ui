/*
 * wd-resize — 尺寸监听
 *
 * Lynx 实现说明：
 * - Web 预览（及任何提供 ResizeObserver 的运行时）：直接观察容器，
 *   尺寸变化即时 emit；
 * - 真机 Lynx（无 ResizeObserver）：沿用 wot-ui 的双 scroll-view 探测
 *   方案——容器脱离文档流（absolute），隐藏的探测 scroll-view 绝对定位
 *   铺满容器；expand 探测占位 100000px，scroll 位置拉到远超底部后被
 *   钳制到 maxScroll = 100000 - 容器尺寸，scroll 事件的 scrollTop /
 *   scrollLeft 直接反推容器高/宽（不依赖 SelectorQuery）；尺寸变化时
 *   maxScroll 变化 → 引擎重新钳位 → scroll 事件 → 比对emit；
 * - shrink 探测：占位 250%（随容器伸缩），缩小场景的第二触发源。
 */
<script lang="ts" setup>
import './index.css'

import { computed, onBeforeUnmount, onMounted, ref } from 'vue-lynx'
import { resizeProps } from './types'
import { uuid, filterStyle, parseStyle } from '../../common/util'

const props = defineProps(resizeProps)
/**
 * resize 事件，容器尺寸变化时触发
 * 事件参数: { top, bottom, left, right, height, width }
 */
const emit = defineEmits(['resize'])

const resizeId = ref<string>(`wd-resize-${uuid()}`)
const expandScrollTop = ref<number>(0)
const expandScrollLeft = ref<number>(0)
const shrinkScrollTop = ref<number>(0)
const shrinkScrollLeft = ref<number>(0)
const height = ref<number>(0)
const width = ref<number>(0)

/** 探测占位尺寸（expand 探测的 100000px，与 index.scss 保持一致） */
const PROBE_SIZE = 100000

// 根视图宽度由 SCSS 的 width:100% 承担，高度随内容；不再内联下发度量尺寸
const rootStyle = computed<Record<string, string>>(() => {
  return filterStyle({ ...parseStyle(props.customStyle) })
})

/** 已记录的容器尺寸（用于比对与布置滚动位置） */
let lastHeight = 0
let lastWidth = 0
/** 是否已拿到初始尺寸（首次只填充根容器高宽防坍塌，不 emit） */
let inited = false
/** ResizeObserver 实例（Web 预览路径） */
let observer: any = null

/** 上报尺寸变化（首帧只填充根容器高宽防坍塌，不 emit） */
function report(newHeight: number, newWidth: number) {
  const changed = newHeight !== lastHeight || newWidth !== lastWidth
  lastHeight = newHeight
  lastWidth = newWidth
  height.value = newHeight
  width.value = newWidth
  if (!inited) {
    inited = true
    return
  }
  if (changed) {
    emit('resize', {
      top: 0,
      bottom: newHeight,
      left: 0,
      right: newWidth,
      height: newHeight,
      width: newWidth
    })
  }
}

onMounted(() => {
  // Web 预览路径：ResizeObserver 直接观察容器。
  // 该分支仅在提供 ResizeObserver 与 document 的运行时（Web 预览）执行，
  // Lynx 真机两者皆无，自动落到下方探针路径（不触碰 DOM API）。
  if (typeof (globalThis as any).ResizeObserver !== 'undefined' && typeof document !== 'undefined') {
    // 元素位于 lynx-view 的 shadow root 内，须在 shadow root 中按 id 查询
    const host = document.querySelector('lynx-view')
    const target = host && host.shadowRoot ? host.shadowRoot.querySelector(`#${resizeId.value}`) : null
    if (target) {
      observer = new (globalThis as any).ResizeObserver((entries: any[]) => {
        const rect = entries[0]?.contentRect
        if (rect) report(Math.round(rect.height), Math.round(rect.width))
      })
      observer.observe(target)
      return
    }
  }
  // 真机探针路径：初始布置，把滚动位置拉到远超底部触发首次钳位 scroll
  expandScrollTop.value = PROBE_SIZE
  expandScrollLeft.value = PROBE_SIZE
})

onBeforeUnmount(() => {
  if (observer) {
    observer.disconnect()
    observer = null
  }
})

/** 把滚动位置布置到「远超底部」，进入下一轮监听 */
function rearm() {
  expandScrollTop.value = PROBE_SIZE + lastHeight
  expandScrollLeft.value = PROBE_SIZE + lastWidth
  shrinkScrollTop.value = 3 * height.value + lastHeight
  shrinkScrollLeft.value = 3 * width.value + lastWidth
}

/**
 * 探针 scroll 事件：由钳位后的滚动位置反推容器尺寸。
 * scrollTop = min(布置值, PROBE_SIZE - 容器高) → 容器高 = PROBE_SIZE - scrollTop。
 * 两轴独立处理：事件只携带某轴的有效滚动时只更新该轴（首帧分别到位）。
 */
function onScroll(e: any) {
  const scrollTop = Number(e?.detail?.scrollTop ?? 0)
  const scrollLeft = Number(e?.detail?.scrollLeft ?? 0)
  if (scrollTop <= 0 && scrollLeft <= 0) return
  const h = scrollTop > 0 ? Math.max(PROBE_SIZE - scrollTop, 0) : lastHeight
  const w = scrollLeft > 0 ? Math.max(PROBE_SIZE - scrollLeft, 0) : lastWidth
  report(h, w)
  rearm()
}

/** shrink 探测的 scroll（占位 250%）：缩小场景的第二触发源，重新布置 expand 探测 */
function onShrinkScroll() {
  rearm()
}
</script>

<template>
  <view :class="`wd-resize ${customClass}`" :style="rootStyle">
    <view :id="resizeId" :class="`wd-resize__container ${customContainerClass}`">
      <slot />
      <!-- 真机探针：expand（100000px 占位，反推尺寸） -->
      <scroll-view
        class="wd-resize__wrapper"
        :scroll-y="true"
        :scroll-top="expandScrollTop"
        :scroll-x="true"
        :scroll-left="expandScrollLeft"
        @scroll="onScroll"
      >
        <view class="wd-resize__placeholder is-expand" />
      </scroll-view>
      <!-- 真机探针：shrink（250% 占位，缩小场景第二触发源） -->
      <scroll-view
        class="wd-resize__wrapper"
        :scroll-y="true"
        :scroll-top="shrinkScrollTop"
        :scroll-x="true"
        :scroll-left="shrinkScrollLeft"
        @scroll="onShrinkScroll"
      >
        <view class="wd-resize__placeholder is-shrink" />
      </scroll-view>
    </view>
  </view>
</template>
