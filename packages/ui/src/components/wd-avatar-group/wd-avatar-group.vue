/*
 * wd-avatar-group — 头像组
 *
 * Lynx 实现说明：
 * - 层叠展示（overlap）：子头像负外边距叠加；
 * - maxCount 限制展示个数：子头像经 useParent 注册到 group 的 children
 *   （useChildren 的 reactive 数组，link 发生在子组件 setup，首帧后才有值，
 *   故渲染依赖保持响应式）；
 * - slot 渲染时按 maxCount 截断（只渲染前 maxCount 个子节点，经
 *   slots.default() 拿 vnode 后 slice，再用 component :is 渲染——Vue 3
 *   对 vnode 的克隆渲染）；
 * - 总数口径：children 只含**已渲染**（截断后）的实例，恒 ≤ maxCount，
 *   不能反映插槽全量；故子头像总数取 max(children.length, 插槽节点数)，
 *   折叠判定与 "+N" 文案均基于该总数。
 */
<script lang="ts" setup>
import './index.css'

import { computed, useSlots } from 'vue-lynx'
import WdAvatar from '../wd-avatar/wd-avatar.vue'
import { avatarGroupProps, AVATAR_GROUP_KEY } from './types'
import { useChildren } from '../../composables/useChildren'
import { filterStyle, parseStyle } from '../../common/util'

const props = defineProps(avatarGroupProps)
const slots = useSlots()

const { children, linkChildren } = useChildren(AVATAR_GROUP_KEY)

linkChildren({ props: props as any })

/** maxCount 归一化：非正数 / 非法值视为不限制 */
const maxCountValue = computed(() => {
  const count = Number(props.maxCount)
  return Number.isFinite(count) && count > 0 ? Math.floor(count) : 0
})

/**
 * 渲染期缓存：本次渲染的插槽全量节点。
 *
 * slots.default() 只能在渲染上下文调用（子组件 setup 依赖当前渲染实例），
 * 故在模板 v-for 中经 renderNodes() 调用并写入缓存，showCollapse /
 * collapseText 同在这一帧内读取（参照 wd-tabs 的 navCache 模式）。
 */
let slotCache: any[] = []

/** 按 maxCount 截断后渲染的节点 */
function renderNodes(): any[] {
  slotCache = slots.default ? (slots.default() as any[]) : []
  const max = maxCountValue.value
  return max > 0 && slotCache.length > max ? slotCache.slice(0, max) : slotCache
}

/**
 * 子头像总数：children（useChildren 注册，仅已渲染实例）与插槽全量节点数
 * 取较大者。截断后 children.length ≤ maxCount，插槽节点数才是全量口径；
 * children 保留响应式读取——异步注册完成时触发父级重渲染。
 */
function totalCount(): number {
  return Math.max(children.length, slotCache.length)
}

/** 是否展示折叠头像 */
function showCollapse(): boolean {
  const max = maxCountValue.value
  return max > 0 && totalCount() > max
}

/** 折叠头像文本：优先用户传入，否则自动计算 "+N" */
function collapseText(): string {
  const max = maxCountValue.value
  return props.collapseText || `+${Math.max(0, totalCount() - max)}`
}

const collapseStyle = computed(() => {
  const style: Record<string, string> = {}
  if (props.overlap) {
    style['margin-left'] = '-8px'
  }
  return filterStyle(style)
})

const rootClass = computed(() => {
  const classes = ['wd-avatar-group', `wd-avatar-group--${props.direction}`]
  if (props.overlap) classes.push('is-overlap')
  if (props.customClass) classes.push(props.customClass)
  return classes.join(' ')
})
</script>

<template>
  <view :class="rootClass" :style="parseStyle(customStyle)">
    <template v-for="(node, index) in renderNodes()" :key="index">
      <component :is="node" />
    </template>
    <wd-avatar
      v-if="showCollapse()"
      :custom-style="collapseStyle"
      :text="collapseText()"
      :shape="shape"
      :size="size"
      bg-color="#D3D7E0"
      color="#FFFFFF"
    />
  </view>
</template>
