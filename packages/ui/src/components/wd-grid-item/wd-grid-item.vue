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

import { computed, inject, onMounted, ref, useSlots } from 'vue-lynx'
import WdBadge from '../wd-badge/wd-badge.vue'
import WdIcon from '../wd-icon/wd-icon.vue'
import { gridItemProps } from './types'
import { uni } from '../../common/uni'
import { GRID_CONFIG_KEY } from '../wd-grid/types'
import { useAlive } from '../../composables/useAlive'
import { filterStyle, getRect, parseStyle, uuid } from '../../common/util'

const props = defineProps(gridItemProps)
const slots = useSlots()
const emit = defineEmits(['click', 'tap'])
const isAlive = useAlive()

/** 父级 grid 下发的 square/border/clickable 配置（无父级 grid 时全 false） */
const gridConfig = inject(
  GRID_CONFIG_KEY,
  computed(() => ({ square: false, border: false, clickable: false }))
)

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

/** 实例唯一类名（square 模式度量用） */
const instanceId = `wd-grid-item-${uuid()}`

/** 正方形格子的实测高度（0 表示未度量/非正方形模式） */
const squareHeight = ref(0)

onMounted(() => {
  if (!gridConfig.value.square) return
  getRect(`.${instanceId}`)
    .then((rect) => {
      // 度量回调晚于卸载落地时丢弃（真机 9902 晚到 patch 家族）
      if (!isAlive()) return
      if (rect && rect.width) squareHeight.value = rect.width
    })
    .catch(() => {})
})

const rootClass = computed(() => {
  const classes = ['wd-grid-item']
  if (gridConfig.value.square) {
    classes.push('is-square')
    // 实例唯一类名：getRect 的静态类名选择器只会命中页面第一个节点，
    // 同页多个 grid-item 需要实例级选择器才能度量到自身（同 usePopover 方案）
    classes.push(instanceId)
  }
  if (gridConfig.value.border) classes.push('is-border')
  if (props.customClass) classes.push(props.customClass)
  return classes.join(' ')
})

// 对象语法：字符串 :style 会被 vue-lynx patchProp 静默丢弃（CONVENTIONS §19）
const rootStyle = computed(() => {
  return filterStyle({
    '--wd-grid-item-column': 'var(--wd-grid-column, 4)',
    // 正方形格子：Lynx 无 aspect-ratio，挂载后度量宽度写入高度（一次性，CONVENTIONS §16）
    ...(squareHeight.value ? { height: `${squareHeight.value}px` } : {}),
    ...parseStyle(props.customStyle)
  })
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
