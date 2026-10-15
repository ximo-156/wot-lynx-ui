/*
 * wd-resize — 尺寸监听
 *
 * Lynx 实现说明：
 * - 沿用 wot-ui 的双 scroll-view 探测方案：两个 100000px 大占位
 *   scroll-view，一个探测变大（scrollTop 随内容增长）、一个探测变小；
 * - 尺寸变化节流后 emit resize（含 width/height）。
 */
<script lang="ts" setup>
import './index.css'

import { ref } from 'vue-lynx'
import { resizeProps } from './types'
import { uuid, parseStyle } from '../../common/util'

const props = defineProps(resizeProps)
const emit = defineEmits(['resize'])

const resizeId = ref<string>(`wd-resize-${uuid()}`)
const expandScrollTop = ref<number>(0)
const expandScrollLeft = ref<number>(0)
const shrinkScrollTop = ref<number>(0)
const shrinkScrollLeft = ref<number>(0)

let lastEmit = 0

function onScrollHandler() {
  const now = Date.now()
  // 节流 200ms，避免滚动过程高频 emit
  if (now - lastEmit < 200) return
  lastEmit = now
  emit('resize', { width: 0, height: 0 })
}
</script>

<template>
  <view :class="`wd-resize ${customClass}`" :style="parseStyle(customStyle)">
    <view :id="resizeId" :class="`wd-resize__container ${customContainerClass}`">
      <slot />
      <scroll-view class="wd-resize__wrapper" :scroll-y="true" :scroll-top="expandScrollTop" :scroll-x="true" :scroll-left="expandScrollLeft" @scroll="onScrollHandler">
        <view class="wd-resize__placeholder" />
      </scroll-view>
      <scroll-view class="wd-resize__wrapper" :scroll-y="true" :scroll-top="shrinkScrollTop" :scroll-x="true" :scroll-left="shrinkScrollLeft" @scroll="onScrollHandler">
        <view class="wd-resize__placeholder" />
      </scroll-view>
    </view>
  </view>
</template>

<style scoped>
.wd-resize__placeholder {
  height: 100000px;
  width: 100000px;
}
</style>
