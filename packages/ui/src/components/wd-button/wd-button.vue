/*
 * wd-button — 按钮
 *
 * Lynx 实现说明：
 * - 根元素为 view（Lynx 无 button 元素），点击经 @tap 捕获后向用户
 *   emit 'click'（CONVENTIONS §6 事件映射）；
 * - 按压缩态用 :active 伪类（渲染器原生处理，零 JS 开销）；
 * - disabled / loading 时不响应点击；loading 时内置 wd-loading，
 *   颜色经 loadingColor 显式下发（svg content 不继承 currentColor）；
 * - uni-app 开放能力 props（open-type / session-from 等）在 Lynx 无
 *   对应能力，已在重写中移除（见文档「与 wot-ui 的差异」）。
 */
<script lang="ts" setup>
import './index.css'

import { computed, useSlots } from 'vue-lynx'
import WdIcon from '../wd-icon/wd-icon.vue'
import WdLoading from '../wd-loading/wd-loading.vue'
import { buttonProps } from './types'
import { isDef, isUndefined, omitBy } from '../../common/util'
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
  }
}
</script>

<template>
  <view :class="rootClass" :style="customStyle" @tap="handleClick">
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
