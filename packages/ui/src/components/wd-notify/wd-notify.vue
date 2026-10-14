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
      :class="[
        'wd-notify',
        `wd-notify--${state.type}`,
        `wd-notify--${state.position}`,
        state.variant === 'floating' ? 'wd-notify--floating' : '',
        customClass
      ]"
      :style="styleToObject(rootStyle)"
      @tap="onClick"
    >
      <slot name="prefix">
        <WdIcon v-if="iconName" :name="iconName" custom-class="wd-notify__prefix" :size="18" :color="prefixIconColor"></WdIcon>
      </slot>
      <view class="wd-notify__content">
        <slot>
          <text>{{ state.message }}</text>
        </slot>
      </view>
      <slot name="close" v-if="state.closable">
        <WdIcon name="close" custom-class="wd-notify__close" :size="18" :color="closeIconColor" @click="handleClose"></WdIcon>
      </slot>
    </view>
  </WdPopup>
</template>
<script setup lang="ts">
import './index.css'
import WdPopup from '../wd-popup/wd-popup.vue'
import WdIcon from '../wd-icon/wd-icon.vue'
import { computed, inject, watch, ref } from 'vue-lynx'
import { notifyProps, type NotifyProps } from './types'
import { getNotifyOptionKey } from '.'
import { styleToObject, type CSSProperties, addUnit, isFunction, objToStyle } from '../../common/util'
import { BLUE, GREEN, RED, ORANGE, COOLGREY, WHITE } from '../../common/theme'

const props = defineProps(notifyProps)
const emits = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'click', event: MouseEvent): void
  (e: 'closed'): void
  (e: 'opened'): void
}>()
const state = inject(getNotifyOptionKey(props.selector), ref<NotifyProps>(props))

/**
 * 根据消息类型获取对应的图标
 */
const iconName = computed(() => {
  const { type } = state.value
  switch (type) {
    case 'success':
      return 'check-circle-fill'
    case 'warning':
      return 'exclamation-circle-fill'
    case 'danger':
      return 'close-circle-fill'
    default:
      return 'info-circle-fill'
  }
})

// 通知条图标颜色：Lynx 的 svg content 不继承 CSS currentColor，需显式下发颜色。
// 实色通知条（主色/危险色底）为白字白图标；floating 卡片按类型取语义色。
const NOTIFY_TYPE_ICON_COLORS: Record<string, string> = {
  primary: BLUE[6],
  success: GREEN[6],
  danger: RED[6],
  warning: ORANGE[6]
}

const prefixIconColor = computed(() => {
  const { type, variant } = state.value
  if (variant === 'floating') {
    return NOTIFY_TYPE_ICON_COLORS[type || 'primary'] || BLUE[6]
  }
  return WHITE
})

const closeIconColor = computed(() => {
  if (state.value.variant === 'floating') {
    return COOLGREY[6]
  }
  return WHITE
})

/**
 * 计算通知的自定义样式
 */
const popupStyle = computed(() => {
  const { safeHeight, position, variant } = state.value
  const styles: CSSProperties = {
    overflow: 'unset',
    background: 'transparent'
  }
  switch (position) {
    case 'top':
      styles['top'] = `calc(var(--window-top) + ${addUnit(safeHeight || 0)})`
      break
    case 'bottom':
      styles['bottom'] = 'var(--window-bottom)'
      break
    default:
      break
  }
  if (variant === 'floating') {
    styles['left'] = '12px'
    styles['right'] = '12px'
    styles['width'] = 'auto'
  }
  return objToStyle(styles)
})

const rootStyle = computed(() => {
  const { customStyle } = props
  const style: CSSProperties = {}
  if (state.value.color) {
    style.color = state.value.color
  }
  if (state.value.background) {
    style.background = state.value.background
  }
  return `${objToStyle(style)};${customStyle}`
})

/**
 * 处理点击事件
 * @param {MouseEvent} event 鼠标事件
 */
const onClick = (event: MouseEvent) => {
  if (isFunction(state.value.onClick)) return state.value.onClick(event)
  emits('click', event)
}
/**
 * 处理关闭动画结束事件
 */
const onClosed = () => {
  if (isFunction(state.value.onClosed)) return state.value.onClosed()
  emits('closed')
}
/**
 * 处理打开动画结束事件
 */
const onOpened = () => {
  if (isFunction(state.value.onOpened)) return state.value.onOpened()
  emits('opened')
}
/**
 * 点击关闭按钮处理
 */
const handleClose = () => {
  state.value.visible = false
}

watch(
  () => state.value.visible,
  (visible) => {
    emits('update:visible', visible as boolean)
  },
  { deep: true }
)
</script>

