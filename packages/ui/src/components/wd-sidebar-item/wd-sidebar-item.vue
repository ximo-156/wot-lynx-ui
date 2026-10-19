/*
 * wd-sidebar-item — 侧边导航项
 *
 * Lynx 实现说明（相对 wot-ui 的适配点）：
 * - 参考源根 view 绑 @click，Lynx view 不存在 click 事件（只派发 tap，
 *   CONVENTIONS §14 订正），改绑 @tap；同时按 §14 在 emits 声明 'tap' 并在
 *   处理器里转发，消费方在组件上绑 @tap 才不会落入 mergeProps 合并崩溃；
 * - 参考源根 view 直接绑定 customStyle 字符串，改为 parseStyle(customStyle)
 *   归一的对象语法（CONVENTIONS §19）；
 * - wd-badge 默认插槽内的 label 为裸文本，Lynx 要求所有文本包在 text 元素
 *   中（PORTING §3.2），改写为 text 包裹；
 * - prefix / suffix 与参考源一致：按 children 顺序判定当前项是否为激活项的
 *   前一项/后一项（控制圆角缺口），读子组件 props 为原始值不触发响应式陷阱
 *   （CONVENTIONS §13）；
 * - 激活态左侧指示条：参考源为 m(active) 内的 ::before 伪元素，Lynx 无伪
 *   元素（PORTING §4.4），改为模板中的真实元素 wd-sidebar-item__indicator
 *   （仅激活时渲染）+ 对应类名样式；
 * - 禁用态：参考源的 cursor: not-allowed 为 Web 专有属性，删除；按压反馈
 *   由 disabled 早退（handleClick 守卫）承担。
 */
<script lang="ts" setup>
import './index.css'

import { computed } from 'vue-lynx'
import WdIcon from '../wd-icon/wd-icon.vue'
import WdBadge from '../wd-badge/wd-badge.vue'
import { sidebarItemProps } from './types'
import { useParent } from '../../composables/useParent'
import { SIDEBAR_KEY } from '../wd-sidebar/types'
import { deepAssign, isDef, isString, isUndefined, omitBy, parseStyle } from '../../common/util'
import type { BadgeProps } from '../wd-badge/types'

const props = defineProps(sidebarItemProps)

// CONVENTIONS §14：根 view 绑 @tap 的交互组件必须转发原生 tap 事件
const emit = defineEmits(['tap'])

const { parent: sidebar } = useParent(SIDEBAR_KEY)

const hasIcon = computed(() => Boolean(props.icon || (isString(props.cssIcon) && props.cssIcon)))

const customBadgeProps = computed(() => {
  const badgeProps: Partial<BadgeProps> = deepAssign(
    isDef(props.badgeProps) ? omitBy(props.badgeProps, isUndefined) : {},
    omitBy(
      {
        max: props.max,
        isDot: props.isDot,
        value: props.badge
      },
      isUndefined
    )
  )
  if (!isDef(badgeProps.max)) {
    badgeProps.max = 99
  }
  return badgeProps
})

const active = computed(() => {
  let active: boolean = false
  if (sidebar.value && sidebar.value.props.modelValue === props.value) {
    active = true
  }
  return active
})

const prefix = computed(() => {
  let prefix: boolean = false
  if (sidebar.value) {
    let activeIndex: number = sidebar.value.children.findIndex((c: any) => {
      return c.value === sidebar.value!.props.modelValue
    })

    let currentIndex: number = sidebar.value.children.findIndex((c: any) => {
      return c.value === props.value
    })

    if (currentIndex === activeIndex - 1) {
      prefix = true
    }
  }
  return prefix
})

const suffix = computed(() => {
  let suffix: boolean = false
  if (sidebar.value) {
    let activeIndex: number = sidebar.value.children.findIndex((c: any) => {
      return c.value === sidebar.value!.props.modelValue
    })

    let currentIndex: number = sidebar.value.children.findIndex((c: any) => {
      return c.value === props.value
    })

    if (currentIndex === activeIndex + 1) {
      suffix = true
    }
  }
  return suffix
})

function handleClick(event: any) {
  if (props.disabled) {
    return
  }
  sidebar.value && sidebar.value.setChange(props.value, props.label)
  emit('tap', event)
}
</script>

<template>
  <view
    @tap="handleClick"
    :class="`wd-sidebar-item ${active ? 'wd-sidebar-item--active' : ''} ${prefix ? 'wd-sidebar-item--prefix' : ''}  ${
      suffix ? 'wd-sidebar-item--suffix' : ''
    } ${disabled ? 'wd-sidebar-item--disabled' : ''} ${customClass}`"
    :style="parseStyle(customStyle)"
  >
    <slot name="icon"></slot>
    <template v-if="!$slots.icon && hasIcon">
      <WdIcon custom-class="wd-sidebar-item__icon" :name="icon" :class-prefix="iconPrefix" :css-icon="cssIcon"></WdIcon>
    </template>
    <WdBadge v-bind="customBadgeProps" custom-class="wd-sidebar-item__badge">
      <text>{{ label }}</text>
    </WdBadge>
    <!-- Lynx 适配：参考源激活态指示条为 ::before 伪元素，改为真实元素 -->
    <view v-if="active" class="wd-sidebar-item__indicator"></view>
  </view>
</template>
