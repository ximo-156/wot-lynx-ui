/*
 * wd-sidebar-item — 侧边导航项
 *
 * Lynx 实现说明：经 useParent 从 sidebar 读取 modelValue 与 setChange；
 * 激活态左侧指示条 + 主题色文字；按压用 :active。
 */
<script lang="ts" setup>
import './index.css'

import { computed } from 'vue-lynx'
import WdIcon from '../wd-icon/wd-icon.vue'
import WdBadge from '../wd-badge/wd-badge.vue'
import { sidebarItemProps } from './types'
import { useParent } from '../../composables/useParent'
import { SIDEBAR_KEY } from '../wd-sidebar/types'
import { isDef } from '../../common/util'

const props = defineProps(sidebarItemProps)

const { parent: sidebar } = useParent(SIDEBAR_KEY)

const active = computed(() => {
  return sidebar.value && String(sidebar.value.props.modelValue) === String(props.value)
})

const hasIcon = computed(() => Boolean(props.icon || props.cssIcon))

const badgeProps = computed(() => {
  if (props.badgeProps) return props.badgeProps
  if (isDef(props.badge)) {
    return { value: props.badge, isDot: props.isDot }
  }
  return null
})

function handleClick() {
  if (props.disabled) return
  sidebar.value?.setChange(props.value, props.label)
}
</script>

<template>
  <view
    :class="[
      'wd-sidebar-item',
      active ? 'wd-sidebar-item--active' : '',
      hasIcon ? 'wd-sidebar-item--prefix' : '',
      badgeProps ? 'wd-sidebar-item--suffix' : '',
      disabled ? 'wd-sidebar-item--disabled' : '',
      customClass
    ]"
    :style="customStyle"
    @tap="handleClick"
  >
    <slot name="icon" />
    <wd-icon v-if="!$slots.icon && hasIcon" custom-class="wd-sidebar-item__icon" :name="icon" :class-prefix="iconPrefix" :css-icon="cssIcon" />
    <text class="wd-sidebar-item__label">{{ label }}</text>
    <wd-badge v-if="badgeProps" v-bind="badgeProps" custom-class="wd-sidebar-item__badge" />
  </view>
</template>
