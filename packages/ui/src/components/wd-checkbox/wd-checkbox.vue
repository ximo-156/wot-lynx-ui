/*
 * wd-checkbox — 多选框
 *
 * Lynx 实现说明：
 * - 经 useCheckboxGroup 从 wd-checkbox-group 继承配置（组件 props 优先）；
 * - group 模式下点击通知 group 增删选中值；单独使用时在自身切换
 *   trueValue / falseValue；
 * - min/max 限量、禁用态在组件内联计算（含 form 禁用贯通）。
 */
<script lang="ts" setup>
import './index.css'

import { computed } from 'vue-lynx'
import WdIcon from '../wd-icon/wd-icon.vue'
import { checkboxProps, type CheckboxExpose } from './types'
import { useCheckboxGroup } from '../../composables/useCheckboxGroup'
import { useFormDisabled } from '../../composables/useFormDisabled'
import { isDef, parseStyle } from '../../common/util'

const props = defineProps(checkboxProps)
const emit = defineEmits(['change', 'update:modelValue', 'tap'])

defineExpose<CheckboxExpose>({
  toggle
})

const { checkboxGroup } = useCheckboxGroup()
const formDisabled = useFormDisabled(props)

const isChecked = computed(() => {
  if (checkboxGroup.value) {
    const groupValue = checkboxGroup.value.props.modelValue || []
    return groupValue.indexOf(props.name) > -1
  }
  return props.modelValue === props.trueValue
})

const typeValue = computed(() => {
  return (isDef(props.type) ? props.type : checkboxGroup.value?.props.type) || 'circle'
})

const isButton = computed(() => typeValue.value === 'button')

const iconValue = computed(() => {
  if (props.indeterminate && !isButton.value) {
    return 'minus-circle'
  }
  let icon = ''
  switch (typeValue.value) {
    case 'circle':
      icon = isChecked.value ? 'success-filling' : ''
      break
    case 'square':
      icon = isChecked.value ? 'check-item-filling' : ''
      break
    case 'dot':
      // dot 选中态（圆心实心点）与未选中态（空心圆）内置集均无对应字形，走 CSS 绘制
      icon = ''
      break
    case 'button':
      icon = isChecked.value ? 'select' : ''
      break
    default:
      break
  }
  return icon
})

const checkedColorValue = computed(() => {
  return isDef(props.checkedColor) ? props.checkedColor : checkboxGroup.value?.props.checkedColor
})

const uncheckedColorValue = computed(() => {
  return isDef(props.uncheckedColor) ? props.uncheckedColor : checkboxGroup.value?.props.uncheckedColor
})

const disabledValue = computed(() => {
  if (formDisabled.value) return true
  if (isDef(props.disabled)) return props.disabled
  if (checkboxGroup.value) {
    const { max, min, disabled } = checkboxGroup.value.props
    const modelValue = checkboxGroup.value.props.modelValue || []
    if (
      (max && modelValue.length >= max && !isChecked.value) ||
      (min && modelValue.length <= min && isChecked.value) ||
      disabled
    ) {
      return true
    }
  }
  return false
})

const readonlyValue = computed(() => {
  if (isDef(props.readonly)) return props.readonly
  return checkboxGroup.value?.props.readonly || false
})

const directionValue = computed(() => {
  return (isDef(props.direction) ? props.direction : checkboxGroup.value?.props.direction) || 'vertical'
})

const placementValue = computed(() => {
  return (isDef(props.placement) ? props.placement : checkboxGroup.value?.props.placement) || 'left'
})

const iconStyle = computed(() => {
  if (isButton.value) return ''
  if ((isChecked.value || props.indeterminate) && checkedColorValue.value) {
    return `color: ${checkedColorValue.value}`
  }
  if (!isChecked.value && !props.indeterminate && uncheckedColorValue.value) {
    return `color: ${uncheckedColorValue.value}`
  }
  return ''
})

const labelStyle = computed(() => {
  return props.maxWidth ? { 'max-width': props.maxWidth } : {}
})

const rootClass = computed(() => {
  const classes = ['wd-checkbox', `wd-checkbox--${placementValue.value}`]
  classes.push(isButton.value ? 'is-button' : `wd-checkbox--${directionValue.value}`)
  if (props.size) classes.push(`is-${props.size}`)
  if (isChecked.value) classes.push('is-checked')
  if (props.indeterminate) classes.push('is-indeterminate')
  if (disabledValue.value) classes.push('is-disabled')
  if (props.customClass) classes.push(props.customClass)
  return classes.join(' ')
})

function toggle() {
  if (disabledValue.value || readonlyValue.value) return
  if (checkboxGroup.value) {
    checkboxGroup.value.changeSelectState(props.name)
  } else {
    const newVal = props.modelValue === props.trueValue ? props.falseValue : props.trueValue
    emit('update:modelValue', newVal)
    emit('change', { value: newVal })
  }
  emit('tap')
}
</script>

<template>
  <view :class="rootClass" :style="parseStyle(customStyle)" @tap="toggle">
    <view v-if="$slots.default" :class="['wd-checkbox__label', customLabelClass]" :style="labelStyle">
      <slot />
    </view>
    <template v-if="isButton">
      <slot name="icon" :is-checked="isChecked">
        <view v-if="isChecked" class="wd-checkbox__shape">
          <wd-icon custom-class="wd-checkbox__icon" :custom-style="iconStyle" :name="iconValue" />
        </view>
      </slot>
    </template>
    <view v-else class="wd-checkbox__shape">
      <slot name="icon" :is-checked="isChecked">
        <wd-icon v-if="iconValue" custom-class="wd-checkbox__icon" :custom-style="iconStyle" :name="iconValue" />
        <view v-else-if="isChecked" class="wd-checkbox__icon wd-checkbox__icon--dot" :style="parseStyle(iconStyle)">
          <view class="wd-checkbox__icon--dot-inner" />
        </view>
        <view
          v-else
          class="wd-checkbox__icon wd-checkbox__icon--empty"
          :class="typeValue === 'square' ? 'wd-checkbox__icon--square' : 'wd-checkbox__icon--circle'"
          :style="parseStyle(iconStyle)"
        />
      </slot>
    </view>
  </view>
</template>
