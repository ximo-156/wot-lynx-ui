/*
 * wd-grid-item — 宫格子项
 *
 * Lynx 实现说明：
 * - 列宽经 --wd-grid-column（grid 下发）换算 flex-basis；
 * - 按压反馈用 :active（hover-class 为 uni-app 概念，已移除）；
 * - url 跳转经 common/uni 兼容层下发。
 */
<script lang="ts" setup>
import './index.css'

import { computed, useSlots } from 'vue-lynx'
import WdBadge from '../wd-badge/wd-badge.vue'
import WdIcon from '../wd-icon/wd-icon.vue'
import { gridItemProps } from './types'
import { uni } from '../../common/uni'

const props = defineProps(gridItemProps)
const slots = useSlots()
const emit = defineEmits(['click', 'tap'])

const hasIcon = computed(() => Boolean(props.icon || props.cssIcon || slots.icon))

const customBadgeProps = computed(() => {
  const props_: Record<string, any> = {}
  if (isDef(props.value)) props_.value = props.value
  if (props.isDot) props_.isDot = props.isDot
  if (isDef(props.max)) props_.max = props.max
  return props_
})

function isDef(value: any): boolean {
  return value !== undefined && value !== null
}

const rootClass = computed(() => {
  const classes = ['wd-grid-item']
  if (props.customClass) classes.push(props.customClass)
  return classes.join(' ')
})

const rootStyle = computed(() => {
  const vars = '--wd-grid-item-column: var(--wd-grid-column, 4);'
  return `${vars}${props.customStyle || ''}`
})

function click() {
  emit('click')
  emit('tap')
  if (props.url) {
    uni[props.linkType]({ url: props.url })
  }
}
</script>

<template>
  <view :class="rootClass" :style="rootStyle" @tap="click">
    <view class="wd-grid-item__content">
      <slot>
        <view v-if="hasIcon || $slots.icon" class="wd-grid-item__wrapper">
          <wd-badge v-bind="customBadgeProps" custom-class="wd-grid-item__badge">
            <slot name="icon">
              <wd-icon
                :name="icon"
                :size="iconSize"
                :color="iconColor"
                :class-prefix="iconPrefix"
                :css-icon="cssIcon"
                :custom-class="`wd-grid-item__icon ${customIcon}`"
              />
            </slot>
          </wd-badge>
        </view>
        <slot name="text">
          <view v-if="text" :class="`wd-grid-item__text ${ellipsis ? 'is-ellipsis' : ''} ${customText}`">
            <text>{{ text }}</text>
          </view>
        </slot>
      </slot>
    </view>
  </view>
</template>
