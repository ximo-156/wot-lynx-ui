/*
 * wd-switch — 开关
 *
 * Lynx 实现说明：
 * - 尺寸用 JS 换算成显式 px（Lynx 对 em 单位支持不稳定），节点位移用
 *   transform: translateX + transition（不用 left 动画）；
 * - 禁用态经 useFormDisabled 贯通 form / form-item；
 * - beforeChange 拦截器经 common/interceptor 下发。
 */
<script lang="ts" setup>
import './index.css'

import { computed } from 'vue-lynx'
import WdIcon from '../wd-icon/wd-icon.vue'
import WdLoading from '../wd-loading/wd-loading.vue'
import { switchProps } from './types'
import { callInterceptor } from '../../common/interceptor'
import { isDef, isUndefined, omitBy, objToStyle } from '../../common/util'
import { WHITE } from '../../common/theme'
import { useFormDisabled } from '../../composables/useFormDisabled'
import type { LoadingProps } from '../wd-loading/types'

const props = defineProps(switchProps)
const emit = defineEmits(['change', 'update:modelValue', 'tap'])
const isDisabled = useFormDisabled(props)

const DEFAULT_SIZE = 26
const PADDING = 3

const isActive = computed(() => {
  return props.modelValue === props.activeValue
})

/** 轨道与节点尺寸（px） */
const metrics = computed(() => {
  const size = isDef(props.size) ? Number(props.size) : DEFAULT_SIZE
  const height = size
  const width = Math.round(size * 1.9)
  const node = size - PADDING * 2
  const travel = width - node - PADDING * 2
  return { height, width, node, travel }
})

const rootClass = computed(() => {
  const classes = ['wd-switch', `wd-switch--${props.shape}`]
  classes.push(isActive.value ? 'is-active' : 'is-inactive')
  if (isDisabled.value) classes.push('is-disabled')
  if (props.loading) classes.push('is-loading')
  if (props.customClass) classes.push(props.customClass)
  return classes.join(' ')
})

const rootStyle = computed(() => {
  return `${objToStyle({ height: `${metrics.value.height}px`, width: `${metrics.value.width}px` })}${props.customStyle}`
})

const innerStyle = computed(() => {
  const background = isActive.value ? props.activeColor : props.inactiveColor
  return objToStyle(background ? { background } : {})
})

const actionStyle = computed(() => {
  return objToStyle({
    width: `${metrics.value.node}px`,
    height: `${metrics.value.node}px`,
    transform: `translateX(${isActive.value ? metrics.value.travel : 0}px)`
  })
})

const innerIcon = computed(() => {
  return isActive.value ? props.activeIcon : props.inactiveIcon
})

const innerCssIcon = computed(() => {
  return isActive.value ? props.activeCssIcon : props.inactiveCssIcon
})

const actionIcon = computed(() => {
  return isActive.value ? props.activeActionIcon : props.inactiveActionIcon
})

const actionCssIcon = computed(() => {
  return isActive.value ? props.activeActionCssIcon : props.inactiveActionCssIcon
})

const customLoadingProps = computed<Partial<LoadingProps>>(() => {
  const overrides: Partial<LoadingProps> = isDef(props.loadingProps) ? omitBy(props.loadingProps!, isUndefined) : {}
  const customSpinnerClass = [isDef(overrides.customSpinnerClass) ? overrides.customSpinnerClass : '', 'wd-switch__action-loading']
    .filter(Boolean)
    .join(' ')
  const type = isDef(overrides.type) ? overrides.type : 'spinner'
  return { ...overrides, customSpinnerClass, type }
})

function switchValue() {
  if (isDisabled.value || props.loading) return
  const newVal = isActive.value ? props.inactiveValue : props.activeValue
  const doSwitch = () => {
    emit('update:modelValue', newVal)
    emit('change', { value: newVal })
    emit('tap')
  }
  callInterceptor(props.beforeChange, { args: [newVal], done: doSwitch })
}
</script>

<template>
  <view :class="rootClass" :style="rootStyle" @tap="switchValue">
    <view class="wd-switch__inner" :style="innerStyle">
      <wd-icon
        v-if="innerIcon || innerCssIcon"
        custom-class="wd-switch__inner-icon"
        :name="innerIcon"
        :class-prefix="classPrefix"
        :css-icon="innerCssIcon"
        :color="WHITE"
      />
      <text v-else-if="isActive ? activeText : inactiveText" class="wd-switch__inner-text">
        {{ isActive ? activeText : inactiveText }}
      </text>
    </view>
    <view class="wd-switch__action" :style="actionStyle">
      <wd-loading v-if="loading" v-bind="customLoadingProps" />
      <wd-icon
        v-else-if="actionIcon || actionCssIcon"
        custom-class="wd-switch__action-icon"
        :name="actionIcon"
        :class-prefix="classPrefix"
        :css-icon="actionCssIcon"
      />
    </view>
  </view>
</template>
