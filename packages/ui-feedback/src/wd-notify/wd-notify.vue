/*
 * wd-notify — 消息通知
 * 命令式选项与声明式 props 共用可见状态；注入选项按次重置，关闭同步回共享 ref。
 * Lynx 原生 tap 转发 click/tap，popup 的 enter/leave 承担官方 opened/closed 时机。
 */
<script lang="ts" setup>
import './index.css'

import { computed, inject, onUnmounted, ref, watch } from 'vue-lynx'
import WdPopup from '@wot-lynx/primitives/wd-popup'
import WdIcon from '@wot-lynx/primitives/wd-icon'
import { notifyProps, type NotifyType, type NotifyProps } from './types'
import { getNotifyOptionKey, useNotify } from '.'
import { addUnit, isDef, isFunction, isString, parseStyle } from '@wot-lynx/core/common/util'
import { defineStyleKeys, resolveStyle } from '@wot-lynx/core/common/style'
import { WdTextSlot } from '@wot-lynx/core/common/textSlot'
import { useAlive } from '@wot-lynx/core/composables/useAlive'
import { useGlobalConfig } from '@wot-lynx/core/composables/useGlobalConfig'
import { GREEN, ORANGE, RED, PRIMARY_COLOR, SECONDARY_COLOR, THEME_TEXT_COLOR } from '@wot-lynx/core/common/theme'

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

/**
 * 弹层（面板）内联样式。
 * 真机 2026-11-05：wd-popup 定位改为「全屏 harness + 面板 flex 子项」后，
 * 面板不再是 fixed，`left/right` 只会变成相对偏移（悬浮态的左右内缩会
 * 变成整体右移、右侧溢出）。左右内缩改由可见条 .wd-notify--floating 自己
 * 的 margin 承担（见 index.scss），本层只保留背景透明与安全区 padding。
 * 也不下发 width：面板宽度由 wd-popup 按窗口像素给定，写 auto 会让贴边
 * 的 notify 收缩成内容宽度。
 */
const POPUP_STYLE = defineStyleKeys({ 'background-color': 'transparent', 'padding-top': '0px' })
const popupStyle = computed(() => resolveStyle(POPUP_STYLE, {
  'padding-top': state.value.position === 'top' ? addUnit(state.value.safeHeight || 0) : ''
}))
const ROOT_STYLE = defineStyleKeys({ color: '', 'background-color': '' })
const rootStyle = computed(() => resolveStyle(ROOT_STYLE, {
  color: state.value.color,
  'background-color': state.value.background
}, parseStyle(state.value.customStyle)))
const globalConfig = useGlobalConfig()
const textColor = computed(() => {
  if (rootStyle.value.color) return rootStyle.value.color
  const variables = globalConfig.value.themeVars
  const dark = globalConfig.value.theme === 'dark'
  if (state.value.variant === 'floating') return variables.notifyFloatingColor || variables.textMain || THEME_TEXT_COLOR[dark ? 'dark' : 'light']
  const colors: Record<string, string> = {
    primary: variables.notifyPrimaryColor || variables.primary6 || (dark ? SECONDARY_COLOR : PRIMARY_COLOR),
    success: variables.notifySuccessColor || variables.successMain || GREEN[dark ? 5 : 6],
    warning: variables.notifyWarningColor || variables.warningMain || ORANGE[dark ? 5 : 6],
    danger: variables.notifyDangerColor || variables.dangerMain || RED[dark ? 5 : 6]
  }
  return colors[state.value.type || 'primary'] || variables.notifyTextColor || '#ffffff'
})
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

/**
 * 按当前状态重置自动关闭计时器。
 *
 * 计时只在 showNotify / 命令式通道里挂过——声明式用法
 * （`v-model:visible`、或文档预览里外部把 visible 置 true）根本不会经过
 * 那里，消息就永远不会消失（真机 2026-11-08 反馈）。因此把「可见 → 计时、
 * 隐藏 → 取消」收敛到 watcher，所有打开路径同一出口。
 */
function restartTimer() {
  clearTimer()
  if (!state.value.visible) return
  const duration = Number(state.value.duration)
  if (!(duration > 0) || !Number.isFinite(duration)) return
  const request = notifyRequest
  timer = setTimeout(() => {
    if (!isAlive() || request !== notifyRequest) return
    timer = undefined
    closeNotify()
  }, duration)
}

function showNotify(option: NotifyProps | string) {
  if (!isAlive()) return
  if (notifyOption.value !== None) {
    notifyApi.showNotify(option)
    return
  }
  clearTimer()
  applyOptions({ ...(isString(option) ? { message: option } : option), visible: true })
}

/**
 * 可见性 / 展示时长变化 → 重新计时。
 *
 * `immediate: true` 覆盖「挂载时父层已把 visible 置 true」的受控用法
 * （`v-model:visible` 的初始态）；sync flush 保证计时与状态同帧生效，
 * 与旧实现里 showNotify 立即计时的时机一致。
 */
watch(
  () => [state.value.visible, state.value.duration] as const,
  () => {
    if (isAlive()) restartTimer()
  },
  { immediate: true, flush: 'sync' }
)

watch(() => state.value.visible, (visible) => emit('update:visible', !!visible))
onUnmounted(clearTimer)
defineExpose({ showNotify, closeNotify })
</script>

<template>
  <WdPopup
    v-model="state.visible"
    :responsive="false"
    :custom-style="popupStyle"
    :position="state.position"
    :safe-area-inset-top="state.position !== 'top' || !(Number(state.safeHeight) > 0)"
    :z-index="state.zIndex"
    :modal="false"
    :lock-scroll="false"
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
      <view class="wd-notify__content">
        <WdTextSlot text-class="wd-notify__text" :text-style="{ color: textColor }" :text-maxline="1">
          <slot><text class="wd-notify__text" :style="{ color: textColor }" text-maxline="1">{{ state.message }}</text></slot>
        </WdTextSlot>
      </view>
      <slot name="close" v-if="state.closable"><WdIcon name="close" custom-class="wd-notify__close" @tap="closeNotify" /></slot>
    </view>
  </WdPopup>
</template>
