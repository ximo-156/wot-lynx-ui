/*
 * wd-notify — 消息通知
 *
 * Lynx 实现说明：基于 wd-popup（无遮罩）；命令式 API 经
 * useNotify(selector) 驱动（模块级注入单例，与 wd-toast 同范式）。
 */
<script lang="ts" setup>
import './index.css'

import { computed, ref, watch } from 'vue-lynx'
import WdPopup from '../wd-popup/wd-popup.vue'
import WdIcon from '../wd-icon/wd-icon.vue'
import { notifyProps, type NotifyType } from './types'
import { getNotifyOptionKey } from '.'
import { filterStyle, parseStyle } from '../../common/util'

const props = defineProps(notifyProps)
const emit = defineEmits(['click', 'closed', 'opened', 'update:visible', 'tap'])

const notifyOptionKey = getNotifyOptionKey(props.selector)
const state = ref({ ...props })

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
