/*
 * wd-resize — 尺寸监听。
 * getRect 使用真实宿主/引擎查询；原生 layoutchange 补足不触发 scroll 的初始化/变化。
 * 保留官方两个隐藏滚动探针，但不用事件计数猜测初始化，尺寸变化只通知一次。
 * 查询版本和卸载守卫拒绝晚到结果，customStyle 使用逐元素 Style Funnel。
 */
<script lang="ts" setup>
import './index.css'

import { computed, getCurrentInstance, onBeforeUnmount, onMounted, ref } from 'vue-lynx'
import { addUnit, getRect, parseStyle, uuid } from '../../common/util'
import { createStyleResolver } from '../../common/style'
import { resizeProps } from './types'

const props = defineProps(resizeProps)
const emit = defineEmits(['resize', 'layoutchange'])
const instance = getCurrentInstance()!
const resizeId = `resize${uuid()}`
const height = ref(0)
const width = ref(0)
const expandScrollTop = ref(0)
const shrinkScrollTop = ref(0)
const expandScrollLeft = ref(0)
const shrinkScrollLeft = ref(0)
let measured = false
let alive = true
let revision = 0
const resolveRootStyle = createStyleResolver({ width: '0px', height: '0px' })
const rootStyle = computed(() => resolveRootStyle({ width: addUnit(width.value), height: addUnit(height.value) }, parseStyle(props.customStyle)))

function scrollToBottom() {
  expandScrollTop.value = 100000 + height.value
  shrinkScrollTop.value = 4 * height.value
  expandScrollLeft.value = 100000 + width.value
  shrinkScrollLeft.value = 4 * width.value
}
async function measure() {
  if (!alive) return
  const version = ++revision
  const rect = await getRect(`#${resizeId}`, false, instance.proxy)
  if (!alive || version !== revision) return
  const newWidth = Number(rect?.width)
  const newHeight = Number(rect?.height)
  if (!Number.isFinite(newWidth) || !Number.isFinite(newHeight) || newWidth < 0 || newHeight < 0) return
  const changed = !measured || newWidth !== width.value || newHeight !== height.value
  width.value = newWidth
  height.value = newHeight
  measured = true
  scrollToBottom()
  if (changed) {
    const detail: Record<string, number> = {}
    for (const key of ['top', 'bottom', 'left', 'right', 'height', 'width']) detail[key] = Number(rect[key]) || 0
    emit('resize', detail)
  }
}
function onLayoutChange(event: any) {
  emit('layoutchange', event)
  if (measured && Number(event?.detail?.width) === width.value && Number(event?.detail?.height) === height.value) return
  void measure()
}
onMounted(measure)
onBeforeUnmount(() => { alive = false; revision++ })
</script>

<template>
  <view :class="`wd-resize ${customClass}`" :style="rootStyle">
    <view :id="resizeId" :class="`wd-resize__container ${customContainerClass}`" @layoutchange="onLayoutChange">
      <slot />
      <scroll-view class="wd-resize__wrapper" :scroll-y="true" :scroll-top="expandScrollTop" :scroll-x="true" :scroll-left="expandScrollLeft" @scroll="measure">
        <view class="wd-resize__wrapper--placeholder" :style="{ height: '100000px', width: '100000px' }" />
      </scroll-view>
      <scroll-view class="wd-resize__wrapper" :scroll-y="true" :scroll-top="shrinkScrollTop" :scroll-x="true" :scroll-left="shrinkScrollLeft" @scroll="measure">
        <view class="wd-resize__wrapper--placeholder" :style="{ height: '250%', width: '250%' }" />
      </scroll-view>
    </view>
  </view>
</template>
