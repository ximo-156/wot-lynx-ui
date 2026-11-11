/*
 * wd-resize — 尺寸监听。
 * getRect 使用真实宿主/引擎查询；原生 layoutchange 补足不触发 scroll 的初始化/变化。
 * 保留官方两个隐藏滚动探针，但不用事件计数猜测初始化，尺寸变化只通知一次。
 * 查询版本和卸载守卫拒绝晚到结果，customStyle 使用逐元素 Style Funnel。
 */
<script lang="ts" setup>
import './index.css'

import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue-lynx'
import { getRect, parseStyle, uuid } from '@wot-lynx/core/common/util'
import { createStyleResolver } from '@wot-lynx/core/common/style'
import { resizeProps } from './types'

const props = defineProps(resizeProps)
const emit = defineEmits(['resize', 'layoutchange'])
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
// 只观察内容尺寸，不把测量值写回约束内容的父节点；否则首次 0px 会形成
// “窄容器 → 文字换行 → 测得窄宽度 → 再锁窄容器”的反馈环。
const resolveRootStyle = createStyleResolver({ width: '', height: '' })
const rootStyle = computed(() => resolveRootStyle(parseStyle(props.customStyle)))

function scrollToBottom() {
  expandScrollTop.value = 100000 + height.value
  shrinkScrollTop.value = 4 * height.value
  expandScrollLeft.value = 100000 + width.value
  shrinkScrollLeft.value = 4 * width.value
}
async function measure() {
  if (!alive) return
  const version = ++revision
  await nextTick()
  if (!alive || version !== revision) return
  const rect = await getRect(`#${resizeId}`)
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
  const layout = event?.detail?.layout || event?.detail
  if (measured && Number(layout?.width) === width.value && Number(layout?.height) === height.value) return
  void measure()
}
onMounted(measure)
onBeforeUnmount(() => { alive = false; revision++ })
</script>

<template>
  <view :class="`wd-resize ${customClass}`" :style="rootStyle">
    <view :id="resizeId" :class="`wd-resize__container ${customContainerClass}`" @layoutchange="onLayoutChange">
      <slot />
      <scroll-view class="wd-resize__wrapper" :user-interaction-enabled="false" :scroll-y="true" :scroll-top="expandScrollTop" :scroll-x="true" :scroll-left="expandScrollLeft" @scroll="measure">
        <view class="wd-resize__wrapper--placeholder" :style="{ height: '100000px', width: '100000px' }" />
      </scroll-view>
      <scroll-view class="wd-resize__wrapper" :user-interaction-enabled="false" :scroll-y="true" :scroll-top="shrinkScrollTop" :scroll-x="true" :scroll-left="shrinkScrollLeft" @scroll="measure">
        <view class="wd-resize__wrapper--placeholder" :style="{ height: '250%', width: '250%' }" />
      </scroll-view>
    </view>
  </view>
</template>
