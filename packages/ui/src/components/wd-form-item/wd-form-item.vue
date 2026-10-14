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
  await form.value?.validate?.(props.prop)
}

const propValue = computed(() => {
  if (!props.prop) return undefined
  return getPropByPath(form.value?.props.model || {}, props.prop)
})

watch(
  () => propValue.value,
  async () => {
    await validateByTrigger('change')
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

const isRequired = computed(() => {
  return isDef(props.required) ? props.required : Boolean(props.prop)
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
