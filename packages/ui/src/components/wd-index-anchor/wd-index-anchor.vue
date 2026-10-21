/*
 * wd-index-anchor — 索引锚点
 *
 * index 变化更新唯一 id 与父侧边栏；expose top 是未吸顶的内容位置，加当前 scrollTop
 * 保持滚动坐标稳定。已吸顶时布局回调保留原始 top，避免将屏幕顶边误当内容锚点。
 * 真实度量才设置 measured；晚到/卸载回调忽略。重复 index 只有激活的实例吸顶。
 */
<script lang="ts" setup>
import './index.css'

import { computed, getCurrentInstance, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue-lynx'
import { indexAnchorProps } from './types'
import { indexBarInjectionKey } from '../wd-index-bar/types'
import { getRect, parseStyle, uuid } from '../../common/util'
import { useParent } from '../../composables/useParent'
import { useAlive } from '../../composables/useAlive'

const props = defineProps(indexAnchorProps)
const emit = defineEmits(['layoutchange'])
const isAlive = useAlive()
const instance = getCurrentInstance()!
const { parent: indexBar } = useParent(indexBarInjectionKey)
const prefix = indexBar.value?.id || `wd-index-anchor-${uuid()}`
const indexAnchorId = computed(() => indexBar.value?.getAnchorId?.(instance.uid, props.index) || `${prefix}-anchor-${encodeURIComponent(String(props.index))}`)
const top = ref(0)
const measured = ref(false)
let measureVersion = 0
const isSticky = computed(() => {
  const parent = indexBar.value
  return Boolean(parent?.props.sticky && parent.anchorState.activeIndex === props.index && (!parent.getActiveUid || parent.getActiveUid() === instance.uid))
})
async function getInfo() {
  const version = ++measureVersion
  const id = indexAnchorId.value
  const scrollTop = indexBar.value?.getScrollTop?.() || 0
  const rect = await getRect(`#${id}`)
  if (!isAlive() || version !== measureVersion || id !== indexAnchorId.value) return
  if (!(Number(rect?.height) > 0 || Number(rect?.width) > 0) || !Number.isFinite(Number(rect?.top))) return
  // position:sticky 的 rect 是绘制位置。已有内容坐标且顶边钳制时不能覆盖缓存。
  const parentTop = indexBar.value?.getOffsetTop?.() || 0
  if (!(measured.value && isSticky.value && scrollTop > 0 && Number(rect.top) <= parentTop + 0.5)) {
    top.value = Math.floor(Number(rect.top)) + scrollTop
  }
  measured.value = true
}
function requestMeasure() {
  measureVersion++
  void nextTick(getInfo)
}
function handleLayoutChange(event: any) {
  emit('layoutchange', event)
  requestMeasure()
}
watch(() => props.index, () => {
  indexBar.value?.onAnchorChange?.()
  requestMeasure()
})
watch(indexAnchorId, requestMeasure)
onMounted(() => {
  indexBar.value?.onAnchorChange?.()
  void getInfo()
})
onBeforeUnmount(() => { measureVersion++ })
defineExpose({ top, id: indexAnchorId, measured, refresh: getInfo })
</script>

<template>
  <view :class="`wd-index-anchor ${isSticky ? 'is-sticky' : ''} ${customClass}`" :style="parseStyle(customStyle)" :id="indexAnchorId" @layoutchange="handleLayoutChange"><slot><text class="wd-index-anchor__text">{{ index }}</text></slot></view>
</template>
