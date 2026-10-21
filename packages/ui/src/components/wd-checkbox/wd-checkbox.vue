/*
 * wd-checkbox — 多选框
 *
 * Lynx 实现说明（相对 wot-ui 2.3.2 的适配点）：
 * - 根元素为 view，`@click` → `@tap`，并在 emits 声明 'tap' 转发原生事件
 *   （CONVENTIONS §6 事件映射 / §14 同名事件）；
 * - 未选中态空心圆/方（wot-ui 的 uncheck-circle / uncheck-square 字体图标）
 *   与 dot 选中态圆心点：内置 iconfont 集无对应字形，按 CONVENTIONS §8 以
 *   真实元素 + border / currentColor 绘制；
 * - size / maxWidth 在 wot-ui 2.3.2 参考实现的模板与样式中均未消费，
 *   此处保持一致：props 保留声明（API 对齐）但不产生副作用；
 * - customStyle 为字符串，经 parseStyle 归一为对象后下发（CONVENTIONS §19）。
 */
<script lang="ts" setup>
import './index.css'

import { computed, getCurrentInstance, onBeforeMount, watch } from 'vue-lynx'
import WdIcon from '../wd-icon/wd-icon.vue'
import { checkboxProps, type CheckboxDirection, type CheckboxExpose, type CheckboxPlacement, type CheckboxType } from './types'
import { useCheckboxGroup } from '../../composables/useCheckboxGroup'
import { useFormDisabled } from '../../composables/useFormDisabled'
import { getPropByPath, isDef, parseStyle } from '../../common/util'

const props = defineProps(checkboxProps)
const emit = defineEmits(['change', 'update:modelValue', 'tap'])

defineExpose<CheckboxExpose>({
  toggle
})

const { checkboxGroup } = useCheckboxGroup()
const formDisabled = useFormDisabled(props)
const { proxy } = getCurrentInstance() as any

const isChecked = computed(() => {
  if (checkboxGroup.value) {
    // 共享层 CheckboxGroupProvide 将 modelValue 声明为可选，group 实际恒为数组，
    // 此处做空值兜底（不修改共享层）
    const groupValue = checkboxGroup.value.props.modelValue || []
    return groupValue.indexOf(props.name) > -1
  }
  return props.modelValue === props.trueValue
})

const typeValue = computed(() => {
  return (props.type || getPropByPath(checkboxGroup.value, 'props.type') || 'circle') as CheckboxType
})

const isButton = computed(() => {
  return typeValue.value === 'button'
})

const iconValue = computed(() => {
  // indeterminate 状态下，且非 button 类型，使用 minus-circle-fill
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
  }
  return icon
})

const checkedColorValue = computed(() => {
  return props.checkedColor || getPropByPath(checkboxGroup.value, 'props.checkedColor')
})

const uncheckedColorValue = computed(() => {
  return props.uncheckedColor || getPropByPath(checkboxGroup.value, 'props.uncheckedColor')
})

const disabledValue = computed(() => {
  if (formDisabled.value) {
    return true
  }
  if (isDef(props.disabled)) {
    return props.disabled
  }
  if (checkboxGroup.value) {
    const { max, min, disabled } = checkboxGroup.value.props
    const groupValue = checkboxGroup.value.props.modelValue || []
    if ((max && groupValue.length >= max && !isChecked.value) || (min && groupValue.length <= min && isChecked.value) || disabled) {
      return true
    }
  }
  return false
})

const readonlyValue = computed(() => {
  if (isDef(props.readonly)) {
    return props.readonly
  }
  return getPropByPath(checkboxGroup.value, 'props.readonly') || false
})

const directionValue = computed(() => {
  if (isDef(props.direction)) {
    return props.direction
  }
  return (getPropByPath(checkboxGroup.value, 'props.direction') as CheckboxDirection) || 'vertical'
})

const placementValue = computed<CheckboxPlacement>(() => {
  if (isDef(props.placement)) {
    return props.placement
  }
  return getPropByPath(checkboxGroup.value, 'props.placement') || 'left'
})

const iconStyle = computed(() => {
  if (isButton.value) return ''
  if ((isChecked.value || props.indeterminate) && checkedColorValue.value) {
    return `color: ${checkedColorValue.value}`
  }
  if (!isChecked.value && uncheckedColorValue.value) {
    return `color: ${uncheckedColorValue.value}`
  }
  return ''
})

const rootClass = computed(() => {
  const classes = ['wd-checkbox', `wd-checkbox--${placementValue.value}`]
  classes.push(isButton.value ? 'is-button' : `wd-checkbox--${directionValue.value}`)
  if (isChecked.value) classes.push('is-checked')
  if (props.indeterminate) classes.push('is-indeterminate')
  if (disabledValue.value) classes.push('is-disabled')
  if (props.customClass) classes.push(props.customClass)
  return classes.join(' ')
})

/** 根节点样式：customStyle 经 parseStyle 归一为对象（CONVENTIONS §19） */
const rootStyle = computed(() => parseStyle(props.customStyle))

watch(
  () => props.name,
  () => {
    // 组合使用走这个逻辑
    if (checkboxGroup.value) {
      checkName()
    }
  }
)

watch(
  () => props.type,
  (newValue) => {
    const type = ['circle', 'square', 'button', 'dot']
    if (isDef(newValue) && type.indexOf(newValue) === -1) console.error(`type must be one of ${type.toString()}`)
  }
)

onBeforeMount(() => {
  if (props.modelValue === null && !checkboxGroup.value) console.warn("checkbox's value must be set")
  if (checkboxGroup.value && !props.name) {
    console.warn("checkbox's name must be set when used in checkbox-group")
  }
})

/**
 * 检测checkbox绑定的value是否和其它checkbox的value冲突
 */
function checkName() {
  checkboxGroup.value &&
    checkboxGroup.value.children &&
    checkboxGroup.value.children.forEach((child: any) => {
      if (child.$.uid !== proxy.$.uid && child.name === props.name) {
        console.error(`The checkbox's bound value: ${props.name} has been used`)
      }
    })
}

/**
 * 点击checkbox的Event handle
 */
function toggle() {
  if (disabledValue.value || readonlyValue.value) return
  // 复选框单独使用时点击反选，并且在checkbox上触发change事件
  if (checkboxGroup.value) {
    checkboxGroup.value.changeSelectState(props.name)
  } else {
    const newVal = props.modelValue === props.trueValue ? props.falseValue : props.trueValue
    emit('update:modelValue', newVal)
    emit('change', {
      value: newVal
    })
  }
  // Lynx 适配：根 view 的 @tap 需在 emits 声明并转发（CONVENTIONS §14）
  emit('tap')
}
</script>

<template>
  <view :class="rootClass" :style="rootStyle" @tap="toggle">
    <view v-if="$slots.default" :class="['wd-checkbox__label', customLabelClass]">
      <slot />
    </view>

    <template v-if="isButton">
      <slot name="icon" :is-checked="isChecked">
        <view v-if="isChecked" class="wd-checkbox__shape">
          <WdIcon custom-class="wd-checkbox__icon" :custom-style="iconStyle" :name="iconValue" />
        </view>
      </slot>
    </template>
    <view v-else class="wd-checkbox__shape">
      <slot name="icon" :is-checked="isChecked">
        <WdIcon v-if="iconValue" custom-class="wd-checkbox__icon" :custom-style="iconStyle" :name="iconValue" />
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
