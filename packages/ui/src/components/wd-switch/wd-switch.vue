<template>
  <view :class="rootClass" :style="styleToObject(rootStyle)" @tap="switchValue">
    <view class="wd-switch__inner" :style="styleToObject(innerStyle)">
      <WdIcon
        v-if="innerIcon || innerCssIcon"
        custom-class="wd-switch__inner-icon"
        :name="innerIcon"
        :color="ICON_COLOR"
        :class-prefix="classPrefix"
        :css-icon="innerCssIcon"
      ></WdIcon>
      <text v-else class="wd-switch__inner-text"><text>{{ isActive ? activeText : inactiveText }}</text></text>
    </view>
    <view class="wd-switch__action">
      <WdLoading v-if="loading" v-bind="customLoadingProps"></WdLoading>
      <WdIcon
        v-else-if="actionIcon || actionCssIcon"
        custom-class="wd-switch__action-icon"
        :name="actionIcon"
        :color="ICON_COLOR"
        :class-prefix="classPrefix"
        :css-icon="actionCssIcon"
      ></WdIcon>
    </view>
  </view>
</template>
<script setup lang="ts">
import './index.css'
import WdIcon from '../wd-icon/wd-icon.vue'
import { WHITE } from '../../common/theme'

/** 开关内嵌图标色：Lynx 的 wd-icon SVG 不吃 CSS color，显式下发白色（选中态蓝底） */
const ICON_COLOR = WHITE
import WdLoading from '../wd-loading/wd-loading.vue'
import {computed, onBeforeMount} from 'vue-lynx'
import { callInterceptor } from '../../common/interceptor'
import { styleToObject, type CSSProperties, addUnit, isDef, isUndefined, objToStyle, omitBy } from '../../common/util'
import { useFormDisabled } from '../../composables/useFormDisabled'
import { switchProps } from './types'
import { type LoadingProps } from '../wd-loading/types'

const props = defineProps(switchProps)
const emit = defineEmits(['change', 'update:modelValue'])
const isDisabled = useFormDisabled(props)

const isActive = computed(() => {
  return props.modelValue === props.activeValue
})

const rootClass = computed(() => {
  return `wd-switch ${props.customClass} ${isDisabled.value ? 'is-disabled' : ''} ${props.loading ? 'is-loading' : ''} wd-switch--${props.shape} is-${
    isActive.value ? 'active' : 'inactive'
  }`
})

const rootStyle = computed(() => {
  const style: CSSProperties = {}
  if (props.size) {
    style['font-size'] = addUnit(props.size)
  }
  return `${objToStyle(style)}${props.customStyle}`
})

const innerStyle = computed(() => {
  const style: CSSProperties = {
    background: isActive.value ? props.activeColor : props.inactiveColor
  }
  return `${objToStyle(style)}$`
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
  const overrides: Partial<LoadingProps> = isDef(props.loadingProps) ? omitBy(props.loadingProps, isUndefined) : {}
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
    emit('change', {
      value: newVal
    })
  }

  callInterceptor(props.beforeChange, {
    args: [newVal],
    done: doSwitch
  })
}

onBeforeMount(() => {
  if ([props.activeValue, props.inactiveValue].indexOf(props.modelValue) === -1) {
    emit('update:modelValue', props.inactiveValue)
    emit('change', {
      value: props.inactiveValue
    })
  }
})
</script>
