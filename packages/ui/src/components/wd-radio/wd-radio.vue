/*
 * wd-radio — 单选框
 *
 * Lynx 实现说明：
 * - 经 useRadioGroup 从 wd-radio-group 继承配置（组件 props 优先）；
 * - 选中态图标用 wd-icon 渲染（success-filling 等内置图标，取自内置
 *   iconfont 集 180 个）；未选中态为空心圆/方，内置集无对应字形，
 *   经 CSS 边框绘制（border-color 取 currentColor，跟随 color）；
 * - 禁用态经 useFormDisabled 贯通 form；@tap 通知 group 更新。
 */
<script lang="ts" setup>
import './index.css'

import { computed } from 'vue-lynx'
import WdIcon from '../wd-icon/wd-icon.vue'
import { radioProps } from './types'
import { RADIO_GROUP_KEY, useRadioGroup, type RadioType } from '../../composables/useRadioGroup'
import { useFormDisabled } from '../../composables/useFormDisabled'
import { isDef, parseStyle } from '../../common/util'

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
  <view :class="rootClass" :style="parseStyle(customStyle)" @tap="handleClick">
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
        <wd-icon v-if="iconValue" custom-class="wd-radio__icon" :custom-style="iconStyle" :name="iconValue" />
        <view v-else-if="isChecked" class="wd-radio__icon wd-radio__icon--dot" :style="parseStyle(iconStyle)">
          <view class="wd-radio__icon--dot-inner" />
        </view>
        <view
          v-else
          class="wd-radio__icon wd-radio__icon--empty"
          :class="typeValue === 'square' ? 'wd-radio__icon--square' : 'wd-radio__icon--circle'"
          :style="parseStyle(iconStyle)"
        />
      </slot>
    </view>
  </view>
</template>
