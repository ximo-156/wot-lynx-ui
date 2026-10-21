/*
 * wd-avatar-group — 头像组
 *
 * Lynx 实现说明（相对 wot-ui 2.3.2 的适配点）：
 * - 子头像注册 / 层叠顺序与参考源一致：子头像经 useParent 注册到 group 的
 *   children（useChildren 的 reactive 数组），maxCount 折叠判定、"+N" 文案、
 *   right-up 的 z-index 均基于 children.length；
 * - 超出 maxCount 的子头像由各头像自身经 index < maxCount 隐藏（参考源行为），
 *   group 只负责渲染折叠头像；
 * - 折叠头像以 _internal 标记创建，跳过父级上下文注册，避免计入 children；
 * - 根节点 :style 参考源为 customStyle 字符串拼接，Lynx 的字符串 style 会被
 *   静默丢弃（CONVENTIONS §19），改为 parseStyle(customStyle) 对象语法；
 * - 折叠头像的 custom-style 参考源为 objToStyle 字符串，改为样式对象下发
 *   （avatar 的 customStyle 经 parseStyle 归一，对象原样透传）；
 * - 层叠间距 --wot-avatar-overlap 由头像侧消费（见 wd-avatar 的 is-first
 *   索引类名适配），group 自身不产生结构伪类 / 兄弟选择器。
 */
<script lang="ts" setup>
import './index.css'

import { computed, useSlots } from 'vue-lynx'
import WdAvatar from '../wd-avatar/wd-avatar.vue'
import { avatarGroupProps, AVATAR_GROUP_KEY } from './types'
import { useChildren } from '../../composables/useChildren'
import { addUnit, isString, parseStyle } from '../../common/util'
import { defineStyleKeys, resolveStyle } from '../../common/style'

const props = defineProps(avatarGroupProps)
const slots = useSlots()

const { children, linkChildren } = useChildren(AVATAR_GROUP_KEY)

linkChildren({ props } as any)

/**
 * 根节点类名
 */
const rootClass = computed(() => {
  return `wd-avatar-group wd-avatar-group--${props.cascading} ${props.customClass} ${props.vertical ? 'is-vertical' : ''}`
})

const maxCountValue = computed(() => {
  if (!props.maxCount) {
    return 0
  }
  const count = typeof props.maxCount === 'number' ? props.maxCount : parseInt(props.maxCount, 10)
  return isNaN(count) || count <= 0 ? 0 : count
})

/**
 * 是否显示折叠头像
 */
const showCollapse = computed(() => {
  return maxCountValue.value > 0 && children.length > maxCountValue.value
})

/**
 * 剩余未显示的数量
 */
const restCount = computed(() => {
  if (maxCountValue.value <= 0) {
    return 0
  }
  return Math.max(0, children.length - maxCountValue.value)
})

/**
 * 折叠头像文本
 */
const collapseText = computed(() => {
  return props.collapseAvatar || `+${restCount.value}`
})

/**
 * 是否有默认插槽
 */
const hasDefaultSlot = computed(() => !!slots.default)

/**
 * 折叠头像样式
 */
const COLLAPSE_STYLE = defineStyleKeys({ 'margin-top': '', 'margin-left': '', 'z-index': '0' })
const collapseStyle = computed(() => {
  const isBuiltIn = isString(props.size) && ['large', 'medium', 'normal', 'small'].includes(props.size)
  const overlap = isBuiltIn ? 'var(--wot-avatar-overlap)' : `calc(${addUnit(props.size)} * -0.25)`
  const margin = hasDefaultSlot.value ? overlap : ''
  const count = maxCountValue.value > 0 ? maxCountValue.value : children.length
  return resolveStyle(COLLAPSE_STYLE, {
    'z-index': props.cascading === 'left-up' ? String(count + 1) : '0',
    'margin-top': props.vertical ? margin : '',
    'margin-left': props.vertical ? '' : margin
  })
})
</script>

<template>
  <view :class="rootClass" :style="parseStyle(customStyle)">
    <slot></slot>
    <!-- 折叠头像 -->
    <WdAvatar
      v-if="showCollapse"
      :custom-style="collapseStyle"
      _internal
      :text="collapseText"
      :shape="shape"
      :size="size"
      bg-color="#ebedf0ff"
      color="#969799ff"
    />
  </view>
</template>
