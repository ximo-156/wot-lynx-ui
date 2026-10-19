/*
 * wd-tabbar-item — 标签栏项
 *
 * Lynx 实现说明（相对 wot-ui 的适配点）：
 * - 参考源根 view 绑 @click，Lynx view 不存在 click 事件（只派发 tap，
 *   CONVENTIONS §14 订正），改绑 @tap；同时按 §14 在 emits 声明 'tap' 并在
 *   处理器里转发，消费方在组件上绑 @tap 才不会落入 mergeProps 合并崩溃；
 * - textStyle：参考源以 objToStyle 输出字符串，Lynx 下 :style 字符串会被
 *   静默丢弃（CONVENTIONS §19），改为对象语法（wd-icon 的 customStyle 与
 *   text 元素均消费对象）；
 * - 参考源模板中的 template v-if 无渲染占位保留（非 block 元素）；
 * - 徽标经 wd-badge 透传，customBadgeProps 合并逻辑与参考源一致
 *   （deepAssign + omitBy 剔除 undefined，max 缺省 99）。
 */
<script lang="ts" setup>
import './index.css'

import { computed } from 'vue-lynx'
import WdBadge from '../wd-badge/wd-badge.vue'
import WdIcon from '../wd-icon/wd-icon.vue'
import { deepAssign, filterStyle, isDef, isString, isUndefined, omitBy, parseStyle } from '../../common/util'
import { useParent } from '../../composables/useParent'
import { TABBAR_KEY } from '../wd-tabbar/types'
import { tabbarItemProps } from './types'
import type { BadgeProps } from '../wd-badge/types'

const props = defineProps(tabbarItemProps)

// CONVENTIONS §14：根 view 绑 @tap 的交互组件必须转发原生 tap 事件
const emit = defineEmits(['tap'])

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

/**
 * 文字/图标颜色：激活取 tabbar 的 activeColor，未激活取 inactiveColor，
 * 均未设置时不产出 color 键（与参考源的 objToStyle 空串等价，
 * filterStyle 剔除空值）。
 */
const textStyle = computed(() => {
  const color = tabbar.value ? (active.value ? tabbar.value.props.activeColor : tabbar.value.props.inactiveColor) : ''
  return filterStyle({ color })
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
function handleClick(event: any) {
  const name: string | number = isDef(props.name) ? props.name : index.value
  tabbar.value && tabbar.value.setChange({ name })
  emit('tap', event)
}
</script>

<template>
  <view :class="`wd-tabbar-item ${customClass}`" :style="parseStyle(customStyle)" @tap="handleClick">
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
          <text v-if="title" :style="textStyle" :class="`wd-tabbar-item__body-title ${active ? 'is-active' : 'is-inactive'}`">
            {{ title }}
          </text>
        </view>
      </WdBadge>
    </slot>
  </view>
</template>
