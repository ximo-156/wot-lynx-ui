/*
 * wd-sticky — 粘性布局
 *
 * 无宿主 observer 时保持直接的 position: sticky（不添加会限制吸顶范围的父包装）。
 * 有真实 IntersectionObserver 时使用稳定的文档流占位作为探针，按官方状态机切换
 * absolute/fixed；sticky-box 离开底边时定位到父包含块。setPosition 操作真实样式。
 * 内容尺寸在挂载/layoutchange 时缓存，offsetTop/容器变化重建监听，不在滚动热路径
 * 查询节点。默认空 observer 不是有效能力；Lynx 无 H5 的 44px 导航栏补偿。
 */
<script lang="ts" setup>
import './index.css'

import { computed, getCurrentInstance, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue-lynx'
import { stickyProps, type StickyExpose } from './types'
import { STICKY_BOX_KEY } from '../wd-sticky-box/types'
import { useParent } from '../../composables/useParent'
import { useAlive } from '../../composables/useAlive'
import { addUnit, getRect, parseStyle, uuid } from '../../common/util'
import { defineStyleKeys, resolveStyle } from '../../common/style'
import { hasUniAdapter, uni } from '../../common/uni'

const props = defineProps(stickyProps)
const emit = defineEmits(['layoutchange'])
const instance = getCurrentInstance()!
const isAlive = useAlive()
const { parent: stickyBox } = useParent(STICKY_BOX_KEY)
const stickyId = `wd-sticky-${uuid()}`
// 宿主能力应在挂载前配置；默认没有 observer 时不创建假的监听对象。
const observerSupported = hasUniAdapter('createIntersectionObserver')
const manualPosition = ref(observerSupported)
const stickyState = reactive({ position: 'absolute', boxLeaved: false, top: 0, height: 0, width: 0, state: 'normal' })
let observer: any = null
let measureVersion = 0

const outOfFlow = computed(() => manualPosition.value && ['fixed', 'absolute'].includes(stickyState.position))
const STICKY_STYLE = defineStyleKeys({ position: 'sticky', top: '0px', zIndex: '1', width: '', height: '' })
const rootStyle = computed(() => ({
  ...resolveStyle(STICKY_STYLE, {
    position: manualPosition.value ? stickyState.position : 'sticky',
    top: addUnit(manualPosition.value ? stickyState.top : props.offsetTop),
    zIndex: String(props.zIndex),
    width: outOfFlow.value && stickyState.width > 0 ? addUnit(stickyState.width) : '',
    height: outOfFlow.value && stickyState.height > 0 ? addUnit(stickyState.height) : ''
  }),
  ...parseStyle(props.customStyle)
}))
const placeholderStyle = computed(() => ({ width: addUnit(stickyState.width), height: addUnit(stickyState.height) }))
const WRAPPER_STYLE = defineStyleKeys({ position: 'relative', width: '', height: '', zIndex: '1' })
const wrapperStyle = computed(() => resolveStyle(WRAPPER_STYLE, {
  position: stickyState.boxLeaved ? 'static' : 'relative',
  width: stickyState.width > 0 ? addUnit(stickyState.width) : '',
  height: stickyState.height > 0 ? addUnit(stickyState.height) : '',
  zIndex: String(props.zIndex)
}))

function setPosition(boxLeaved: boolean, position: string, top: number) {
  if (!isAlive() || !['static', 'relative', 'absolute', 'sticky', 'fixed'].includes(position) || !Number.isFinite(top)) return
  manualPosition.value = position !== 'sticky'
  stickyState.boxLeaved = boxLeaved
  stickyState.position = position
  stickyState.top = top
}
function handleRelativeTo(result: any) {
  if (!isAlive()) return
  const rect = result?.boundingClientRect
  if (!rect || !Number.isFinite(Number(rect.top))) return
  const box = stickyBox.value?.boxStyle
  if (box && box.height > 0 && stickyState.height >= box.height) {
    stickyState.state = 'normal'
    setPosition(false, 'absolute', 0)
  } else if (Number(rect.top) <= props.offsetTop) {
    stickyState.state = 'sticky'
    setPosition(false, 'fixed', props.offsetTop)
  } else {
    stickyState.state = 'normal'
    setPosition(false, 'absolute', 0)
  }
  // 父容器缓存的底边状态优先，避免两个 observer 回调顺序将 leaved 覆盖成 fixed。
  stickyBox.value?.updateChildPosition?.(instance)
}
function clearObserver() {
  observer?.disconnect?.()
  observer = null
}
async function measure() {
  const version = ++measureVersion
  const size = await getRect(`#${stickyId}-container`)
  if (!isAlive() || version !== measureVersion) return
  stickyState.width = Math.max(0, Number(size?.width) || 0)
  stickyState.height = Math.max(0, Number(size?.height) || 0)
  clearObserver()
  await nextTick()
  if (!isAlive() || version !== measureVersion) return
  if (observerSupported && hasUniAdapter('createIntersectionObserver') && stickyState.height > 0) {
    const nextObserver = uni.createIntersectionObserver(instance.proxy, { thresholds: [0, 0.5] })
    observer = nextObserver
    nextObserver?.relativeToViewport?.({ top: -(props.offsetTop + stickyState.height) })
    nextObserver?.observe?.(`#${stickyId}-probe`, (result: any) => {
      if (isAlive() && version === measureVersion && observer === nextObserver) handleRelativeTo(result)
    })
    const rect = await getRect(`#${stickyId}-probe`)
    if (isAlive() && version === measureVersion && observer === nextObserver && (Number(rect?.width) > 0 || Number(rect?.height) > 0)) handleRelativeTo({ boundingClientRect: rect })
  }
  if (isAlive() && version === measureVersion) stickyBox.value?.observerForChild?.(instance)
}
function requestMeasure() {
  measureVersion++
  clearObserver()
  void nextTick(measure)
}
function handleLayoutChange(event: any) {
  emit('layoutchange', event)
  const width = Number(event?.detail?.width)
  const height = Number(event?.detail?.height)
  if (width === stickyState.width && height === stickyState.height) return
  requestMeasure()
}
watch(() => props.offsetTop, () => {
  if (manualPosition.value && stickyState.position === 'fixed' && !stickyState.boxLeaved) stickyState.top = props.offsetTop
  requestMeasure()
})
onMounted(measure)
onBeforeUnmount(() => {
  measureVersion++
  clearObserver()
  stickyBox.value?.unobserveChild?.(instance)
})
defineExpose<StickyExpose>({ setPosition, stickyState, offsetTop: computed(() => props.offsetTop) })
</script>

<template>
  <template v-if="observerSupported">
    <view :id="`${stickyId}-probe`" class="wd-sticky__wrapper" :style="wrapperStyle">
      <view class="wd-sticky__placeholder" :style="placeholderStyle" />
      <view :class="`wd-sticky ${customClass}`" :style="rootStyle" :id="stickyId">
        <view :id="`${stickyId}-container`" class="wd-sticky__container" @layoutchange="handleLayoutChange"><slot /></view>
      </view>
    </view>
  </template>
  <template v-else>
    <view v-if="outOfFlow" :id="`${stickyId}-probe`" class="wd-sticky__placeholder" :style="placeholderStyle" />
    <view :class="`wd-sticky ${customClass}`" :style="rootStyle" :id="stickyId">
      <view :id="`${stickyId}-container`" class="wd-sticky__container" @layoutchange="handleLayoutChange"><slot /></view>
    </view>
  </template>
</template>
