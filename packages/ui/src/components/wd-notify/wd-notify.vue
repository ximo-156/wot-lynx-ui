/*
 * wd-notify — 消息通知
 *
 * Lynx 实现说明：基于 wd-popup（无遮罩）；命令式 API 经
 * useNotify(selector) 驱动（模块级注入单例，与 wd-toast 同范式）。
 */
<script lang="ts" setup>
import './index.css'

import { computed, inject, ref, watch } from 'vue-lynx'
import WdPopup from '../wd-popup/wd-popup.vue'
import WdIcon from '../wd-icon/wd-icon.vue'
import { notifyProps, type NotifyType } from './types'
import { getNotifyOptionKey } from '.'
import { filterStyle, isDef, isString, parseStyle } from '../../common/util'
import { useAlive } from '../../composables/useAlive'

const props = defineProps(notifyProps)
const emit = defineEmits(['click', 'closed', 'opened', 'update:visible', 'tap'])

const notifyOptionKey = getNotifyOptionKey(props.selector)
const state = ref({ ...props })
const isAlive = useAlive()

// 命令式 API（useNotify(selector) / defineExpose 的 showNotify）与 props
// 两条通道都汇入本地 state：useNotify 写的是页面级 provide 下来的共享
// option ref，此前本组件只计算 key 从未 inject，导致命令式调用无人消费
// （demo 的 notifyRef.value.showNotify() 静默无效）。
// None 哨兵 = 页面未调用 useNotify，此时仅 props / 暴露方法生效。
const notifyOption = inject(notifyOptionKey, ref<any>(Symbol('None')))

/** 把外部选项合并进 state（仅覆盖已定义字段，与 useToast.reset 同语义） */
function applyOptions(options: Record<string, any>) {
  const next: Record<string, any> = { ...state.value }
  for (const key of Object.keys(options)) {
    if (isDef(options[key])) next[key] = options[key]
  }
  state.value = next as typeof state.value
}

watch(
  () => notifyOption.value,
  (newVal) => {
    // 卸载后晚到的写入直接丢弃：vue-lynx 在已销毁树上继续 patch 会产生
    // 晚到的 remove/insert，真机表现为 removeNode 未知签名（9902）。
    if (!newVal || typeof newVal === 'symbol' || !isAlive()) return
    applyOptions(newVal as Record<string, any>)
  },
  { deep: true }
)

const popupStyle = computed(() => {
  return `background-color: transparent;${state.value.safeHeight ? `padding-top: ${state.value.safeHeight}px;` : ''}`
})

const rootStyle = computed(() => {
  const style: Record<string, string> = {}
  if (state.value.color) style.color = state.value.color
  if (state.value.background) style['background-color'] = state.value.background
  return { ...filterStyle(style), ...parseStyle(props.customStyle) }
})

const iconName = computed(() => {
  const map: Record<NotifyType, string> = {
    primary: 'info-circle',
    success: 'check-circle',
    warning: 'exclamation-circle',
    danger: 'close-circle'
  }
  return map[state.value.type] || ''
})

function onClick() {
  emit('click')
  emit('tap')
}

function handleClose() {
  state.value.visible = false
  emit('update:visible', false)
}

function onClosed() {
  emit('closed')
}

function onOpened() {
  emit('opened')
}

/**
 * 命令式展示（组件实例方法，demo 的 ref 调用方式；与 useNotify 共享
 * 同一 option ref 的页面会经 watch 同步）。字符串入参视为 message。
 */
function showNotify(option: Record<string, any> | string) {
  applyOptions({ ...(isString(option) ? { message: option } : option), visible: true })
}

/** 命令式关闭 */
function closeNotify() {
  state.value.visible = false
}

defineExpose({ showNotify, closeNotify })
</script>

<template>
  <wd-popup
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
      :class="[
        'wd-notify',
        `wd-notify--${state.type}`,
        `wd-notify--${state.position}`,
        state.variant === 'floating' ? 'wd-notify--floating' : '',
        customClass
      ]"
      :style="rootStyle"
      @tap="onClick"
    >
      <slot name="prefix">
        <wd-icon v-if="iconName" :name="iconName" custom-class="wd-notify__prefix" />
      </slot>
      <view class="wd-notify__content">
        <slot>
          <text class="wd-notify__text">{{ state.message }}</text>
        </slot>
      </view>
      <slot name="close" v-if="state.closable">
        <wd-icon name="close" custom-class="wd-notify__close" @tap="handleClose" />
      </slot>
    </view>
  </wd-popup>
</template>
