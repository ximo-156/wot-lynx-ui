/*
 * wd-form-item — 表单项
 *
 * Lynx 实现说明：
 * - 结构基于 wd-cell（标题/标签/右侧内容/箭头），错误信息内联展示；
 * - 经 FORM_KEY 读取 form 配置与校验入口；向下提供禁用态
 *   （FORM_ITEM_DISABLED_KEY）与校验触发（FORM_ITEM_VALIDATE_KEY）；
 * - 字段值变化时按 validateTrigger 自动校验。
 */
<script lang="ts" setup>
import './index.css'

import { computed, provide, watch } from 'vue-lynx'
import { useChildren } from '../../composables/useChildren'
import { useParent } from '../../composables/useParent'
import WdCell from '../wd-cell/wd-cell.vue'
import { FORM_KEY } from '../../composables/useFormDisabled'
import { FORM_ITEM_DISABLED_KEY } from '../../composables/useFormDisabled'
import { FORM_ITEM_VALIDATE_KEY, type FormItemValidateProvide } from '../../composables/useFormItemValidate'
import { FORM_VALIDATE_EVENTS, type FormValidateEvent, type FormValidateTrigger } from '../wd-form/types'
import type { CellAsteriskPosition, CellLayout, CellSize, CellValueAlign } from '../wd-cell/types'
import { formItemProps } from './types'
import { getPropByPath, isDef } from '../../common/util'

const props = defineProps(formItemProps)

const { parent: form, index } = useParent(FORM_KEY)
const { linkChildren } = useChildren(FORM_ITEM_VALIDATE_KEY)

const emit = defineEmits(['click'])

const isDisabled = computed<boolean | undefined>(() => {
  const disabled = isDef(props.disabled) ? props.disabled : form.value?.props.disabled
  return disabled === null ? undefined : disabled
})

provide(FORM_ITEM_DISABLED_KEY, {
  disabled: isDisabled
})

function handleClick() {
  if (isDisabled.value) return
  emit('click')
}

function normalizeValidateTrigger(trigger?: FormValidateTrigger | FormValidateTrigger[]): FormValidateEvent[] {
  const triggerList = Array.isArray(trigger) ? trigger : trigger ? [trigger] : []
  return triggerList.filter((item): item is FormValidateEvent => FORM_VALIDATE_EVENTS.includes(item as FormValidateEvent))
}

const validateTriggerSet = computed(() => {
  const formTrigger = form.value?.props.validateTrigger
  const currentTrigger = isDef(props.validateTrigger) ? props.validateTrigger : formTrigger
  return new Set(normalizeValidateTrigger(currentTrigger as FormValidateTrigger | FormValidateTrigger[] | undefined))
})

function shouldTrigger(event: FormValidateEvent): boolean {
  return validateTriggerSet.value.has(event)
}

async function validateByTrigger(event: FormValidateEvent): Promise<void> {
  if (!props.prop || !shouldTrigger(event)) return
  // schema.validate 由消费方提供，可能同步抛错或返回被拒绝的 Promise。
  // 本函数在下方 watch 的 async 回调中被 await（回调本身没有 catch），异常
  // 会漂成未处理的 Promise 拒绝 → 真机 Sentry USER_RUNTIME_ERROR。
  // 校验失败属可预期输入问题，兜底告警即可，不应打断渲染路径。
  try {
    await form.value?.validate?.(props.prop)
  } catch (error) {
    console.error('[wot-lynx-ui] wd-form-item 校验执行失败（已兜底，未向上抛出）', error)
  }
}

const propValue = computed(() => {
  if (!props.prop) return undefined
  return getPropByPath(form.value?.props.model || {}, props.prop)
})

watch(
  () => propValue.value,
  async () => {
    // try/catch：schema.validate 抛错或拒绝时不得冒泡成未处理的 Promise 拒绝
    // （真机 Sentry USER_RUNTIME_ERROR，见 CONVENTIONS 的崩溃防护约定）
    try {
      await validateByTrigger('change')
    } catch (error) {
      console.error('[wd-form-item] change 校验失败:', error)
    }
  },
  { deep: true }
)

linkChildren({
  prop: props.prop,
  shouldTrigger,
  validateByTrigger
})

const errorMessage = computed(() => {
  if (form.value && props.prop && form.value.errorMessages && form.value.errorMessages[props.prop]) {
    return form.value.errorMessages[props.prop]
  }
  return ''
})

const formItemBorder = computed(() => {
  if (isDef(props.border)) return props.border
  if (index.value > 0 && form.value && form.value.props.border) return true
  return false
})

const formItemCenter = computed(() => {
  return isDef(props.center) ? props.center : form.value?.props.center
})

const formItemSize = computed<CellSize | undefined>(() => {
  return isDef(props.size) ? props.size : (form.value?.props.size as CellSize | undefined)
})

const formItemTitleWidth = computed(() => {
  return isDef(props.titleWidth) ? props.titleWidth : form.value?.props.titleWidth || '98px'
})

const formItemLayout = computed<CellLayout>(() => {
  return (isDef(props.layout) ? props.layout : (form.value?.props.layout as CellLayout | undefined)) || 'horizontal'
})

const formItemValueAlign = computed<CellValueAlign>(() => {
  return (isDef(props.valueAlign) ? props.valueAlign : (form.value?.props.valueAlign as CellValueAlign | undefined)) || 'left'
})

const formItemEllipsis = computed(() => {
  return isDef(props.ellipsis) ? props.ellipsis : form.value?.props.ellipsis
})

const formItemAsteriskPosition = computed<CellAsteriskPosition | undefined>(() => {
  return isDef(props.asteriskPosition) ? props.asteriskPosition : (form.value?.props.asteriskPosition as CellAsteriskPosition | undefined)
})

const formItemHideAsterisk = computed(() => {
  return isDef(props.hideAsterisk) ? props.hideAsterisk : form.value?.props.hideAsterisk
})

// 必填星号仅由显式 required 决定：旧实现「传了 prop 就显示星号」会给所有
// 绑定字段错误地加星号（wot-ui 语义是由校验规则的 required 决定，本库的
// schema 为自定义 validate 函数、无规则元数据，故退化为显式 prop）
const isRequired = computed(() => {
  return isDef(props.required) ? props.required : false
})

const showPlaceholder = computed(() => {
  return isDef(props.placeholder) && !isDef(props.value) && !props.value
})
</script>

<template>
  <wd-cell
    :custom-class="`wd-form-item ${isDisabled ? 'is-disabled' : ''} ${customClass}`"
    :custom-style="customStyle"
    :use-title-slot="!!$slots.title"
    :title="title"
    :use-label-slot="!!$slots.label"
    :label="label"
    :title-width="formItemTitleWidth"
    :prefix-icon="prefixIcon"
    :icon-size="iconSize"
    :icon-prefix="iconPrefix"
    :css-icon="cssIcon"
    :required="isRequired"
    :size="formItemSize"
    :value-align="formItemValueAlign"
    :center="formItemCenter"
    :ellipsis="formItemEllipsis"
    :clickable="!isDisabled && clickable"
    :is-link="!isDisabled && isLink"
    :asterisk-position="formItemAsteriskPosition"
    :border="formItemBorder"
    :hide-asterisk="formItemHideAsterisk"
    :layout="formItemLayout"
    :custom-prefix-class="customPrefixClass"
    :custom-label-class="customLabelClass"
    :custom-title-class="customTitleClass"
    :custom-value-class="customValueClass"
    @click="handleClick"
  >
    <template #title v-if="$slots.title">
      <slot name="title" />
    </template>
    <template #label v-if="$slots.label">
      <slot name="label" />
    </template>
    <slot>
      <text v-if="showPlaceholder" class="wd-form-item__placeholder">{{ placeholder }}</text>
      <text v-else-if="isDef(value)">{{ value }}</text>
    </slot>
    <view v-if="errorMessage" class="wd-form-item__error-message">
      <text>{{ errorMessage }}</text>
    </view>
  </wd-cell>
</template>
