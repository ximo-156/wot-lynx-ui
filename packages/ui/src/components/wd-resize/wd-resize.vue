/*
 * wd-resize — 尺寸监听
 *
 * Lynx 实现说明：
 * - 沿用 wot-ui 的双 scroll-view 探测方案：容器脱离文档流（absolute），
 *   两个隐藏的探测 scroll-view 绝对定位铺满容器；
 *   - expand 探测：占位 100000px，scroll 位置拉到「远超底部」后被钳制，
 *     容器变大时最大滚动距离变化 → 触发 scroll；
 *   - shrink 探测：占位 250%（随容器伸缩），容器变小时触发 scroll；
 * - 每次 scroll 用 SelectorQuery 度量容器实际尺寸，与上次比对，
 *   变化则 emit resize（载荷 { top, bottom, left, right, height, width }），
 *   随后 scrollToBottom 重新布置滚动位置进入下一轮监听；
 * - 前两次 scroll 为初始化噪声（布置滚动位置引发），按参考实现屏蔽。
 */
<script lang="ts" setup>
import './index.css'

import { computed, onMounted, ref } from 'vue-lynx'
import { resizeProps } from './types'
import { uuid, filterStyle, getRect, parseStyle } from '../../common/util'

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
const scrollEventCount = ref<number>(0)

const rootStyle = computed<Record<string, string>>(() => {
  return filterStyle({
    width: `${width.value}px`,
    height: `${height.value}px`,
    ...parseStyle(props.customStyle)
  })
})

/** 滚动事件处理函数：动态定义用于闭包记录容器尺寸（对齐 wot-ui） */
let onScrollHandler: (() => void) | null = null

/** 把两个探测 scroll-view 的滚动位置布置到「底部」，进入下一轮监听 */
function scrollToBottom(lastWidth: number, lastHeight: number) {
  expandScrollTop.value = 100000 + lastHeight
  shrinkScrollTop.value = 3 * height.value + lastHeight
  expandScrollLeft.value = 100000 + lastWidth
  shrinkScrollLeft.value = 3 * width.value + lastWidth
}

onMounted(() => {
  getRect(`#${resizeId.value}`)
    .then((res) => {
      // 度量不可用时（零矩形）不启动监听，保持默认布局
      if (!res || (!res.width && !res.height)) return
      let lastHeight = res.height
      let lastWidth = res.width
      height.value = lastHeight
      width.value = lastWidth

      onScrollHandler = () => {
        getRect(`#${resizeId.value}`).then((rect) => {
          // 前两次滚动事件为初始化布置引发，仅同步计数
          if (scrollEventCount.value++ === 0) {
            emit('resize', {
              top: rect.top,
              bottom: rect.bottom,
              left: rect.left,
              right: rect.right,
              height: rect.height,
              width: rect.width
            })
          }
          // 前 3 次事件屏蔽（初始化噪声）
          if (scrollEventCount.value < 3) return
          const newHeight = rect.height
          const newWidth = rect.width
          height.value = newHeight
          width.value = newWidth
          let changed = false
          if (newHeight !== lastHeight) {
            lastHeight = newHeight
            changed = true
          }
          if (newWidth !== lastWidth) {
            lastWidth = newWidth
            changed = true
          }
          if (changed) {
            emit('resize', {
              top: rect.top,
              bottom: rect.bottom,
              left: rect.left,
              right: rect.right,
              height: newHeight,
              width: newWidth
            })
          }
          // 重新布置滚动位置，进入下一轮监听
          scrollToBottom(lastWidth, lastHeight)
        })
      }
      // 初始布置
      scrollToBottom(lastWidth, lastHeight)
    })
    .catch(() => {})
})

function handleScroll() {
  if (onScrollHandler) onScrollHandler()
}
</script>

<template>
  <view :class="`wd-resize ${customClass}`" :style="rootStyle">
    <view :id="resizeId" :class="`wd-resize__container ${customContainerClass}`">
      <slot />
      <!-- 监听插槽变大 -->
      <scroll-view
        class="wd-resize__wrapper"
        :scroll-y="true"
        :scroll-top="expandScrollTop"
        :scroll-x="true"
        :scroll-left="expandScrollLeft"
        @scroll="handleScroll"
      >
        <view class="wd-resize__placeholder wd-resize__placeholder--expand" />
      </scroll-view>
      <!-- 监听插槽变小 -->
      <scroll-view
        class="wd-resize__wrapper"
        :scroll-y="true"
        :scroll-top="shrinkScrollTop"
        :scroll-x="true"
        :scroll-left="shrinkScrollLeft"
        @scroll="handleScroll"
      >
        <view class="wd-resize__placeholder wd-resize__placeholder--shrink" />
      </scroll-view>
    </view>
  </view>
</template>
