<template>
  <view
    @tap="handleClick"
    :class="`wd-sidebar-item ${active ? 'wd-sidebar-item--active' : ''} ${prefix ? 'wd-sidebar-item--prefix' : ''}  ${
      suffix ? 'wd-sidebar-item--suffix' : ''
    } ${disabled ? 'wd-sidebar-item--disabled' : ''} ${customClass}`"
    :style="styleToObject(customStyle)"
  >
    <!-- Lynx 适配：wot-ui 用 ::before 绘制激活项左侧指示条，Lynx 无伪元素，
         改为模板中的真实元素（样式见 index.scss 的 .wd-sidebar-item__indicator）。 -->
    <view v-if="active" class="wd-sidebar-item__indicator" />
    <slot name="icon"></slot>
    <template v-if="!$slots.icon && hasIcon">
      <WdIcon custom-class="wd-sidebar-item__icon" :name="icon" :class-prefix="iconPrefix" :css-icon="cssIcon"></WdIcon>
    </template>
    <WdBadge v-bind="customBadgeProps" custom-class="wd-sidebar-item__badge">
      <text>{{ label }}</text>
    </WdBadge>
  </view>
</template>

<script setup lang="ts">
import './index.css'
import WdIcon from '../wd-icon/wd-icon.vue'
import WdBadge from '../wd-badge/wd-badge.vue'
import { computed } from 'vue-lynx'
import { useParent } from '../../composables/useParent'
import { SIDEBAR_KEY } from '../wd-sidebar/types'
import { sidebarItemProps } from './types'
import type { BadgeProps } from '../wd-badge/types'
import { styleToObject, deepAssign, isDef, isString, isUndefined, omitBy } from '../../common/util'

const props = defineProps(sidebarItemProps)

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

function handleClick() {
  if (props.disabled) {
    return
  }
  sidebar.value && sidebar.value.setChange(props.value, props.label)
}
</script>

