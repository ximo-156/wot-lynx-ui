/*
 * wd-notify — 消息通知
 * 命令式选项与声明式 props 共用可见状态；注入选项按次重置，关闭同步回共享 ref。
 * Lynx 原生 tap 转发 click/tap，popup 的 enter/leave 承担官方 opened/closed 时机。
 */
<script lang="ts" setup>
import './index.css'

import { computed, inject, onUnmounted, ref, watch } from 'vue-lynx'
import WdPopup from '../../primitives/wd-popup/wd-popup.vue'
import WdIcon from '../../primitives/wd-icon/wd-icon.vue'
import { notifyProps, type NotifyType, type NotifyProps } from './types'
import { getNotifyOptionKey, useNotify } from '.'
import { addUnit, isDef, isFunction, isString, parseStyle } from '../../common/util'
import { defineStyleKeys, resolveStyle } from '../../common/style'
import { useAlive } from '../../composables/useAlive'

const props = defineProps(notifyProps)
const emit = defineEmits(['click', 'closed', 'opened', 'update:visible', 'tap'])
const isAlive = useAlive()
const None = Symbol('None')
const notifyOption = inject(getNotifyOptionKey(props.selector), ref<NotifyProps | typeof None>(None))
const notifyApi = useNotify(props.selector)
const state = ref<NotifyProps>({ ...props })
let timer: ReturnType<typeof setTimeout> | undefined
let notifyRequest = 0

function clearTimer() {
  ++notifyRequest
  if (timer !== undefined) clearTimeout(timer)
  timer = undefined
}

// 不以旧请求为基底：undefined 配置恢复 props，旧回调/安全高度不能泄漏到下一次。
function applyOptions(options: NotifyProps) {
  const next: NotifyProps = { ...props }
  for (const [key, value] of Object.entries(options)) {
    if (isDef(value)) (next as Record<string, any>)[key] = value
  }
  state.value = next
}

watch(
  () => notifyOption.value,
  (options) => {
    if (!isAlive() || options === None) return
    clearTimer()
    applyOptions(options)
  },
  { deep: true, immediate: true }
)

// 只同步变化的 prop，避免修改 customClass 等布局 prop 时清空正在显示的命令式消息。
watch(
  () => ({ ...props }),
  (next, previous) => {
    if (!isAlive()) return
    const options: NotifyProps = { ...state.value }
    for (const key of Object.keys(next)) {
      if ((next as any)[key] !== (previous as any)[key]) (options as any)[key] = (next as any)[key]
    }
    state.value = options
  },
  { deep: true }
)

const POPUP_STYLE = defineStyleKeys({ 'background-color': 'transparent', 'padding-top': '0px', left: '0px', right: '0px', width: 'auto' })
const popupStyle = computed(() => resolveStyle(POPUP_STYLE, {
  'padding-top': state.value.position === 'top' ? addUnit(state.value.safeHeight || 0) : '',
  left: state.value.variant === 'floating' ? '12px' : '',
  right: state.value.variant === 'floating' ? '12px' : ''
}))
const ROOT_STYLE = defineStyleKeys({ color: '', 'background-color': '' })
const rootStyle = computed(() => resolveStyle(ROOT_STYLE, {
  color: state.value.color,
  'background-color': state.value.background
}, parseStyle(state.value.customStyle)))
const iconName = computed(() => {
  const icons: Record<NotifyType, string> = {
    primary: 'info-circle-fill', success: 'check-circle-fill', warning: 'exclamation-circle-fill', danger: 'close-circle-fill'
  }
  return icons[state.value.type!] || ''
})

function onClick(event: any) {
  if (!isAlive()) return
  if (isFunction(state.value.onClick)) state.value.onClick(event)
  else emit('click', event)
  emit('tap', event)
}
function onClosed() {
  if (!isAlive()) return
  if (isFunction(state.value.onClosed)) state.value.onClosed()
  else emit('closed')
}
function onOpened() {
  if (!isAlive()) return
  if (isFunction(state.value.onOpened)) state.value.onOpened()
  else emit('opened')
}
function closeNotify() {
  if (!isAlive()) return
  clearTimer()
  state.value.visible = false
  // 关闭按钮必须同步 useNotify 注入通道，不能仅关闭快照。
  if (notifyOption.value !== None) notifyApi.closeNotify()
}
function showNotify(option: NotifyProps | string) {
  if (!isAlive()) return
  if (notifyOption.value !== None) {
    notifyApi.showNotify(option)
    return
  }
  clearTimer()
  applyOptions({ ...(isString(option) ? { message: option } : option), visible: true })
  const request = notifyRequest
  const duration = state.value.duration
  if (duration && duration > 0) {
    timer = setTimeout(() => {
      if (!isAlive() || request !== notifyRequest) return
      timer = undefined
      closeNotify()
    }, duration)
  }
}
watch(() => state.value.visible, (visible) => emit('update:visible', !!visible))
onUnmounted(clearTimer)
defineExpose({ showNotify, closeNotify })
</script>

<template>
  <WdPopup
    v-model="state.visible"
    :custom-style="popupStyle"
    :position="state.position"
    :z-index="state.zIndex"
    :modal="false"
    :root-portal="state.rootPortal"
    @leave="onClosed"
    @enter="onOpened"
  >
    <view
      :class="['wd-notify', `wd-notify--${state.type}`, `wd-notify--${state.position}`, state.variant === 'floating' ? 'wd-notify--floating' : '', state.customClass]"
      :style="rootStyle"
      @tap="onClick"
    >
      <slot name="prefix"><WdIcon v-if="iconName" :name="iconName" custom-class="wd-notify__prefix" /></slot>
      <view class="wd-notify__content"><slot><text class="wd-notify__text">{{ state.message }}</text></slot></view>
      <slot name="close" v-if="state.closable"><WdIcon name="close" custom-class="wd-notify__close" @tap="closeNotify" /></slot>
    </view>
  </WdPopup>
</template>
