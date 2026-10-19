/*
 * wd-radio — 单选框
 *
 * Lynx 实现说明（相对 wot-ui 2.3.2 的适配点）：
 * - 根元素为 view（Lynx 无 button 元素），`@click` → `@tap`，并在 emits
 *   声明 'tap' 转发原生事件（CONVENTIONS §6 事件映射 / §14 同名事件）；
 * - wot-ui 的 `wd-radio--horizontal` 用 inline-flex + `:not(:last-child)`
 *   控制横向间距：Lynx 不识别 inline-flex（改为 display: flex + row），
 *   兄弟选择器改由 wd-radio-group 的 `--horizontal` 容器 gap 承担；
 * - 未选中态空心圆/方（wot-ui 的 uncheck-circle / uncheck-square 字体图标）
 *   与 dot 选中态圆心点：内置 iconfont 集无对应字形，按 CONVENTIONS §8 以
 *   真实元素 + border / currentColor 绘制；
 * - customStyle 为字符串，经 parseStyle 归一为对象后下发（CONVENTIONS §19）。
 */
<script lang="ts" setup>
import './index.css'

import { computed, watch } from 'vue-lynx'
import WdIcon from '../wd-icon/wd-icon.vue'
import { radioProps, type RadioType } from './types'
import { RADIO_GROUP_KEY, useRadioGroup } from '../../composables/useRadioGroup'
import { useFormDisabled } from '../../composables/useFormDisabled'
import { getPropByPath, isDef, parseStyle } from '../../common/util'

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
  return (props.type || getPropByPath(radioGroup.value, 'props.type') || 'circle') as RadioType
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
  return props.checkedColor || getPropByPath(radioGroup.value, 'props.checkedColor')
})

const uncheckedColorValue = computed(() => {
  return props.uncheckedColor || getPropByPath(radioGroup.value, 'props.uncheckedColor')
})

const readonlyValue = computed(() => {
  if (isDef(props.readonly)) {
    return props.readonly
  }
  return getPropByPath(radioGroup.value, 'props.readonly')
})

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

const isButton = computed(() => {
  return typeValue.value === 'button'
})

const disabledValue = computed(() => {
  if (formDisabled.value) {
    return true
  }
  if (isDef(props.disabled)) {
    return props.disabled
  }
  return getPropByPath(radioGroup.value, 'props.disabled')
})

const directionValue = computed(() => {
  if (isDef(props.direction)) {
    return props.direction
  }
  return getPropByPath(radioGroup.value, 'props.direction')
})

const placementValue = computed(() => {
  if (isDef(props.placement)) {
    return props.placement
  }
  return getPropByPath(radioGroup.value, 'props.placement') || 'left'
})

const rootClass = computed(() => {
  const classes = ['wd-radio', `wd-radio--${placementValue.value}`]
  classes.push(isButton.value ? 'is-button' : `wd-radio--${directionValue.value}`)
  if (isChecked.value) classes.push('is-checked')
  if (disabledValue.value) classes.push('is-disabled')
  if (props.customClass) classes.push(props.customClass)
  return classes.join(' ')
})

watch(
  () => props.type,
  (newValue) => {
    const type = ['circle', 'dot', 'button', 'square']
    if (newValue && type.indexOf(newValue) === -1) console.error(`type must be one of ${type.toString()}`)
  }
)

/**
 * 点击子元素，通知父元素触发change事件
 */
function handleClick(event: any) {
  const { value } = props
  if (!disabledValue.value && !readonlyValue.value && radioGroup.value && isDef(value)) {
    const allowUncheck = radioGroup.value.props.allowUncheck
    if (allowUncheck && isChecked.value) {
      radioGroup.value.updateValue(null)
    } else {
      radioGroup.value.updateValue(value)
    }
  }
  emit('tap', event)
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
