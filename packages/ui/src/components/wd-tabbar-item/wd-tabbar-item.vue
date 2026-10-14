<template>
  <view :class="`wd-tabbar-item ${customClass}`" :style="styleToObject(customStyle)" @tap="handleClick">
    <slot>
      <WdBadge v-bind="customBadgeProps">
        <view class="wd-tabbar-item__body">
          <slot name="icon" :active="active"></slot>
          <template v-if="!$slots.icon && hasIcon">
            <WdIcon
              :name="icon"
              :class-prefix="iconPrefix"
              :css-icon="cssIcon"
              :custom-style="textStyle"
              :custom-class="`wd-tabbar-item__body-icon ${active ? 'is-active' : 'is-inactive'}`"
            ></WdIcon>
          </template>
          <text v-if="title" :style="styleToObject(textStyle)" :class="`wd-tabbar-item__body-title ${active ? 'is-active' : 'is-inactive'}`">
            <text>{{ title }}</text>
          </text>
        </view>
      </WdBadge>
    </slot>
  </view>
</template>
<script setup lang="ts">
import './index.css'
import WdBadge from '../wd-badge/wd-badge.vue'
import WdIcon from '../wd-icon/wd-icon.vue'
import {computed} from 'vue-lynx'
import { styleToObject, type CSSProperties, deepAssign, isDef, isString, isUndefined, objToStyle, omitBy } from '../../common/util'
import { useParent } from '../../composables/useParent'
import { TABBAR_KEY } from '../wd-tabbar/types'
import { tabbarItemProps } from './types'
import type { BadgeProps } from '../wd-badge/types'

const props = defineProps(tabbarItemProps)

const { parent: tabbar, index } = useParent(TABBAR_KEY)

const hasIcon = computed(() => Boolean(props.icon || (isString(props.cssIcon) && props.cssIcon)))

const customBadgeProps = computed(() => {
  const badgeProps: Partial<BadgeProps> = deepAssign(
    isDef(props.badgeProps) ? omitBy(props.badgeProps, isUndefined) : {},
    omitBy(
      {
        max: props.max,
        isDot: props.isDot,
        value: props.value
      },
      isUndefined
    )
  )
  if (!isDef(badgeProps.max)) {
    badgeProps.max = 99
  }
  return badgeProps
})

const textStyle = computed(() => {
  const style: CSSProperties = {}
  if (tabbar.value) {
    if (active.value && tabbar.value.props.activeColor) {
      style['color'] = tabbar.value.props.activeColor
    }
    if (!active.value && tabbar.value.props.inactiveColor) {
      style['color'] = tabbar.value.props.inactiveColor
    }
  }

  return `${objToStyle(style)}`
})

const active = computed(() => {
  const name = isDef(props.name) ? props.name : index.value
  if (tabbar.value) {
    if (tabbar.value.props.modelValue === name) {
      return true
    } else {
      return false
    }
  } else {
    return false
  }
})

/**
 * 点击tabbar选项
 */
function handleClick() {
  const name: string | number = isDef(props.name) ? props.name : index.value
  tabbar.value && tabbar.value.setChange({ name })
}
</script>
