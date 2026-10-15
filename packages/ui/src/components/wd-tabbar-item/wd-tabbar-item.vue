/*
 * wd-tabbar-item — 标签栏项
 *
 * Lynx 实现说明：经 useParent 读取激活索引并 setChange；
 * 激活态图标/文字变色，按压用 :active。
 */
<script lang="ts" setup>
import './index.css'

import { computed } from 'vue-lynx'
import WdIcon from '../wd-icon/wd-icon.vue'
import WdBadge from '../wd-badge/wd-badge.vue'
import { tabbarItemProps } from './types'
import { useParent } from '../../composables/useParent'
import { TABBAR_KEY } from '../wd-tabbar/types'
import { isDef, parseStyle } from '../../common/util'

const props = defineProps(tabbarItemProps)
const emit = defineEmits(['tap'])

const { parent: tabbar, index } = useParent(TABBAR_KEY)

const active = computed(() => {
  if (!tabbar.value) return false
  const modelValue = tabbar.value.props.modelValue
  return isDef(props.name) ? props.name === modelValue : index.value === modelValue
})

const activeColor = computed(() => tabbar.value?.props.activeColor || 'var(--wd-color-primary)')
const inactiveColor = computed(() => tabbar.value?.props.inactiveColor || 'var(--wd-text-3)')

const badgeProps = computed<Record<string, any> | null>(() => {
  if (!isDef(props.value) && !props.isDot) return null
  return { value: props.value, isDot: props.isDot, max: props.max }
})

function handleClick() {
  tabbar.value?.setChange({ name: isDef(props.name) ? props.name : index.value })
  emit('tap')
}
</script>

<template>
  <view :class="`wd-tabbar-item ${active ? 'is-active' : ''} ${customClass}`" :style="parseStyle(customStyle)" @tap="handleClick">
    <view class="wd-tabbar-item__icon">
      <wd-badge v-if="badgeProps" v-bind="badgeProps" custom-class="wd-tabbar-item__badge">
        <wd-icon :name="active ? (activeIcon || icon) : icon" :color="active ? activeColor : inactiveColor" custom-class="wd-tabbar-item__icon-img" />
      </wd-badge>
      <wd-icon v-else :name="active ? (activeIcon || icon) : icon" :color="active ? activeColor : inactiveColor" custom-class="wd-tabbar-item__icon-img" />
    </view>
    <text v-if="title" class="wd-tabbar-item__title" :style="{ color: active ? activeColor : inactiveColor }">{{ title }}</text>
  </view>
</template>
