/*
 * wd-radio — 单选框
 *
 * Lynx 实现说明：
 * - 经 useRadioGroup 从 wd-radio-group 继承配置（组件 props 优先）；
 * - 图标用 wd-icon 渲染（check-circle-fill 等内置 SVG）；
 * - 禁用态经 useFormDisabled 贯通 form；@tap 通知 group 更新。
 */
<script lang="ts" setup>
import './index.css'

import { computed } from 'vue-lynx'
import WdIcon from '../wd-icon/wd-icon.vue'
import { radioProps } from './types'
import { RADIO_GROUP_KEY, useRadioGroup, type RadioType } from '../../composables/useRadioGroup'
import { useFormDisabled } from '../../composables/useFormDisabled'
import { isDef, objToStyle } from '../../common/util'

const props = defineProps(radioProps)
const emit = defineEmits(['tap'])

const { radioGroup } = useRadioGroup()
const formDisabled = useFormDisabled(props)

const isChecked = computed(() => {
  if (radioGroup.value) {
    return props.value === radioGroup.value.props.modelValue
  }
  return false
})

const typeValue = computed<RadioType>(() => {
  return (isDef(props.type) ? props.type : radioGroup.value?.props.type) || 'circle'
})

const iconValue = computed(() => {
  let icon = ''
  switch (typeValue.value) {
    case 'circle':
      icon = isChecked.value ? 'check-circle-fill' : 'uncheck-circle'
      break
    case 'square':
      icon = isChecked.value ? 'check-square-fill' : 'uncheck-square'
      break
    case 'dot':
      icon = isChecked.value ? 'check-circle-radio-fill' : 'uncheck-circle'
      break
    case 'button':
      icon = isChecked.value ? 'check' : ''
      break
    default:
      break
  }
  return icon
})

const checkedColorValue = computed(() => {
  return isDef(props.checkedColor) ? props.checkedColor : radioGroup.value?.props.checkedColor
})

const uncheckedColorValue = computed(() => {
  return isDef(props.uncheckedColor) ? props.uncheckedColor : radioGroup.value?.props.uncheckedColor
})

const disabledValue = computed(() => {
  if (formDisabled.value) return true
  if (isDef(props.disabled)) return props.disabled
  return radioGroup.value?.props.disabled
})

const readonlyValue = computed(() => {
  if (isDef(props.readonly)) return props.readonly
  return radioGroup.value?.props.readonly
})

const directionValue = computed(() => {
  return (isDef(props.direction) ? props.direction : radioGroup.value?.props.direction) || 'vertical'
})

const placementValue = computed(() => {
  return (isDef(props.placement) ? props.placement : radioGroup.value?.props.placement) || 'left'
})

const isButton = computed(() => typeValue.value === 'button')

const iconStyle = computed(() => {
  if (isButton.value) return ''
  if (isChecked.value && checkedColorValue.value) {
    return `color: ${checkedColorValue.value}`
  }
  if (!isChecked.value && uncheckedColorValue.value) {
    return `color: ${uncheckedColorValue.value}`
  }
  return ''
})

const rootClass = computed(() => {
  const classes = ['wd-radio', `wd-radio--${placementValue.value}`]
  classes.push(isButton.value ? 'is-button' : `wd-radio--${directionValue.value}`)
  if (isChecked.value) classes.push('is-checked')
  if (disabledValue.value) classes.push('is-disabled')
  if (props.customClass) classes.push(props.customClass)
  return classes.join(' ')
})

function handleClick() {
  const { value } = props
  if (!disabledValue.value && !readonlyValue.value && radioGroup.value && isDef(value)) {
    const allowUncheck = radioGroup.value.props.allowUncheck
    if (allowUncheck && isChecked.value) {
      radioGroup.value.updateValue(null)
    } else {
      radioGroup.value.updateValue(value)
    }
    emit('tap')
  }
}
</script>

<template>
  <view :class="rootClass" :style="customStyle" @tap="handleClick">
    <view v-if="$slots.default" :class="['wd-radio__label', customLabelClass]">
      <slot />
    </view>
    <template v-if="isButton">
      <slot name="icon" :is-checked="isChecked">
        <view v-if="isChecked" class="wd-radio__shape">
          <wd-icon custom-class="wd-radio__icon" :custom-style="iconStyle" :name="iconValue" />
        </view>
      </slot>
    </template>
    <view v-else class="wd-radio__shape">
      <slot name="icon" :is-checked="isChecked">
        <wd-icon custom-class="wd-radio__icon" :custom-style="iconStyle" :name="iconValue" />
      </slot>
    </view>
  </view>
</template>
