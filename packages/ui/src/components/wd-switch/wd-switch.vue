/*
 * wd-switch — 开关
 *
 * Lynx 实现说明（相对 wot-ui 2.3.2 的适配点）：
 * - 根元素为 view，`@click` → `@tap`，并在 emits 声明 'tap' 转发原生事件
 *   （CONVENTIONS §6 事件映射 / §14 同名事件）；
 * - wot-ui 的尺寸体系以根节点 font-size 为 em 基准（1em = 操作块边长）。
 *   Lynx 引擎对 em 的支持不稳定（无 --em-unit 之类的根单位变量），故派生
 *   尺寸一律改为以 `--wot-switch-size` 为基准的 calc() 表达式；`size` prop
 *   命中时经内联 `font-size` + `--wot-switch-size` 下发，未命中时内联
 *   font-size 取 `var(--wot-switch-size, 26px)`（与类声明等价，消费者仍可经
 *   CSS 变量覆盖），二者构成完整键集（CONVENTIONS §20）；
 * - 操作块位移沿用 wot-ui 的 `left: calc(100% - …)`（激活态贴右），不使用
 *   JS 度量，避免 touch 热路径与尺寸不同步；
 * - 禁用态经 useFormDisabled 贯通 form；beforeChange 拦截器经
 *   common/interceptor 下发；customStyle 经 parseStyle 归一为对象。
 */
<script lang="ts" setup>
import './index.css'

import { computed, onBeforeMount } from 'vue-lynx'
import WdIcon from '../wd-icon/wd-icon.vue'
import WdLoading from '../wd-loading/wd-loading.vue'
import { switchProps } from './types'
import { callInterceptor } from '../../common/interceptor'
import { addUnit, isDef, isUndefined, omitBy, parseStyle } from '../../common/util'
import { defineStyleKeys } from '../../common/style'
import { useFormDisabled } from '../../composables/useFormDisabled'
import type { LoadingProps } from '../wd-loading/types'

const props = defineProps(switchProps)
const emit = defineEmits(['change', 'update:modelValue', 'tap'])
const isDisabled = useFormDisabled(props)

const isActive = computed(() => {
  return props.modelValue === props.activeValue
})

const rootClass = computed(() => {
  return [
    'wd-switch',
    props.customClass,
    isDisabled.value ? 'is-disabled' : '',
    props.loading ? 'is-loading' : '',
    `wd-switch--${props.shape}`,
    isActive.value ? 'is-active' : 'is-inactive'
  ]
    .filter(Boolean)
    .join(' ')
})

/**
 * 根节点可切换样式键 + 中性值（CONVENTIONS §20）。
 * font-size 即 wot-ui 的 em 基准；中性值与 index.scss 中 `.wd-switch` 的
 * 类声明完全等价（同样经 var() 解析），因此「未传 size」与「不写该键」
 * 在视觉上不可区分，同时又保证键集完整、无脏值残留。
 */
const ROOT_STYLE = defineStyleKeys({
  'font-size': 'var(--wot-switch-size, 26px)'
})

const rootStyle = computed(() => {
  const size = isDef(props.size) ? addUnit(props.size) : ''
  const base: Record<string, string> = size
    ? // size prop 命中：同步改写 em 基准变量，派生尺寸随之一并缩放
      { 'font-size': size, '--wot-switch-size': size }
    : // 未命中：只写 font-size 且取值与类声明等价，`--wot-switch-size` 的
      // 令牌默认值（及消费者经 CSS 变量的覆盖）保持生效
      { 'font-size': ROOT_STYLE['font-size'] }
  return { ...base, ...parseStyle(props.customStyle) }
})

const innerStyle = computed(() => {
  const background = isActive.value ? props.activeColor : props.inactiveColor
  return background ? { background } : {}
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

function switchValue(event: any) {
  if (isDisabled.value || props.loading) return
  const newVal = isActive.value ? props.inactiveValue : props.activeValue
  const doSwitch = () => {
    emit('update:modelValue', newVal)
    emit('change', {
      value: newVal
    })
    emit('tap', event)
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

<template>
  <view :class="rootClass" :style="rootStyle" @tap="switchValue">
    <view class="wd-switch__inner" :style="innerStyle">
      <wd-icon
        v-if="innerIcon || innerCssIcon"
        custom-class="wd-switch__inner-icon"
        :name="innerIcon"
        :class-prefix="classPrefix"
        :css-icon="innerCssIcon"
      />
      <text v-else class="wd-switch__inner-text">{{ isActive ? activeText : inactiveText }}</text>
    </view>
    <view class="wd-switch__action">
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
