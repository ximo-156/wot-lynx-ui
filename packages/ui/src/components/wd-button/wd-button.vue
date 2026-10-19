/*
 * wd-button — 按钮
 *
 * Lynx 实现说明（相对 wot-ui 的适配点）：
 * - 根元素为 view（Lynx 无 button 元素），点击经 @tap 捕获后向用户
 *   emit 'click' / 'tap'（CONVENTIONS §6 事件映射、§14 同名事件转发）；
 * - hover-class 按压态改用 CSS :active 伪类（渲染器原生处理，零 JS 开销）；
 * - disabled / loading 时不响应点击；loading 时内置 wd-loading，
 *   颜色经 loadingColor 显式下发（svg content 不继承 currentColor）；
 * - wot-ui 的 ::after 边框技巧（plain/dashed/hairline 描边）在 Lynx 无伪元素，
 *   改为根节点真实 border，见 index.scss；
 * - uni-app 开放能力 props（open-type / session-from 等）及其回调事件
 *   （getuserinfo / contact 等）在 Lynx 无对应能力：props 保留声明仅为
 *   API 对齐（传入不生效），事件不声明（无原生事件可转发）。
 */
<script lang="ts" setup>
import './index.css'

import { computed, useSlots } from 'vue-lynx'
import WdIcon from '../wd-icon/wd-icon.vue'
import WdLoading from '../wd-loading/wd-loading.vue'
import { buttonProps } from './types'
import { isDef, isUndefined, omitBy, parseStyle } from '../../common/util'
import { useGlobalConfig } from '../../composables/useGlobalConfig'
import type { LoadingProps } from '../wd-loading/types'

const props = defineProps(buttonProps)
const slots = useSlots()

const globalConfig = useGlobalConfig()

const effectiveSize = computed(() => {
  return props.size || globalConfig.value.button?.size || 'medium'
})

const effectiveVariant = computed(() => {
  return props.variant || globalConfig.value.button?.variant || 'base'
})

const effectiveType = computed(() => {
  return props.type || globalConfig.value.button?.type || 'primary'
})

const effectiveRound = computed(() => {
  if (isUndefined(props.round)) {
    return isUndefined(globalConfig.value.button?.round) ? false : globalConfig.value.button?.round
  }
  return props.round
})

const emit = defineEmits<{
  (e: 'click', event: any): void
  (e: 'tap', event: any): void
}>()

/** 加载配置：默认继承按钮文字色 */
const customLoadingProps = computed(() => {
  const loading: Partial<LoadingProps> = isDef(props.loadingProps) ? omitBy(props.loadingProps!, isUndefined) : {}
  loading.customSpinnerClass = `${isDef(loading.customSpinnerClass) ? loading.customSpinnerClass : ''} wd-button__loading`
  loading.inheritColor = isDef(loading.inheritColor) ? loading.inheritColor : true
  if (isDef(props.loadingColor)) {
    loading.color = props.loadingColor
  }
  return loading
})

/** 是否仅展示图标 */
const isIcon = computed(() => {
  return !slots.default && !props.text && !!(props.icon || props.cssIcon)
})

const rootClass = computed(() => {
  const classes: string[] = ['wd-button', `is-${effectiveType.value}`, `is-${effectiveSize.value}`]
  if (isIcon.value) classes.push('is-icon')
  if (effectiveRound.value) classes.push('is-round')
  if (props.hairline) classes.push('is-hairline')
  if (effectiveVariant.value !== 'base') classes.push(`is-${effectiveVariant.value}`)
  if (props.disabled) classes.push('is-disabled')
  if (props.block) classes.push('is-block')
  if (props.loading) classes.push('is-loading')
  if (props.customClass) classes.push(props.customClass)
  return classes.join(' ')
})

function handleClick(event: any) {
  if (!props.disabled && !props.loading) {
    emit('click', event)
    emit('tap', event)
  }
}
</script>

<template>
  <!-- customStyle 为字符串，需 parseStyle 归一为对象（CONVENTIONS §19：
       vue-lynx 的 patchProp 对字符串 style 会静默替换为 {}） -->
  <view :id="buttonId" :class="rootClass" :style="parseStyle(customStyle)" @tap="handleClick">
    <view class="wd-button__content">
      <wd-loading v-if="loading" v-bind="customLoadingProps" />
      <wd-icon
        v-else-if="icon || cssIcon"
        class="wd-button__icon"
        :name="icon"
        :class-prefix="classPrefix"
        :css-icon="cssIcon"
      />
      <text v-if="$slots.default || text" class="wd-button__text">
        <slot>{{ text }}</slot>
      </text>
    </view>
  </view>
</template>
