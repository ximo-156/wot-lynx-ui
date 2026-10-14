/*
 * wd-input — 输入框
 *
 * Lynx 实现说明：
 * - 基于 Lynx 原生 input 元素（value/type/password/focus/confirm-type 等
 *   原生属性透传），经 :value + @input 双向同步（避免运行时 vModel 指令）；
 * - readonly 经遮罩 view 拦截交互（Lynx input 无可靠 readonly 属性）；
 * - 清空 / 密码可见 / 前后置图标均为 wd-icon + @tap；
 * - blur 时经 FORM_ITEM_VALIDATE_KEY 通知 form-item 校验。
 */
<script lang="ts" setup>
import './index.css'

import { computed, ref, watch } from 'vue-lynx'
import WdIcon from '../wd-icon/wd-icon.vue'
import { inputProps } from './types'
import { isDef, isEqual, pause } from '../../common/util'
import { useParent } from '../../composables/useParent'
import { useTranslate } from '../../composables/useTranslate'
import { useFormDisabled } from '../../composables/useFormDisabled'
import { FORM_ITEM_VALIDATE_KEY } from '../../composables/useFormItemValidate'

const props = defineProps(inputProps)
const emit = defineEmits([
  'update:modelValue',
  'clear',
  'blur',
  'focus',
  'input',
  'keyboardheightchange',
  'confirm',
  'clicksuffixicon',
  'clickprefixicon',
  'click'
])

const { translate } = useTranslate('input')
const { parent: formItemValidate } = useParent(FORM_ITEM_VALIDATE_KEY)
const isDisabled = useFormDisabled(props)

const isPwdVisible = ref<boolean>(false)
const clearing = ref<boolean>(false)
const focused = ref<boolean>(false)
const focusing = ref<boolean>(false)
const inputValue = ref<string | number>(getInitValue())

watch(
  () => props.focus,
  (newValue) => {
    focused.value = newValue
  },
  { immediate: true, deep: true }
)

watch(
  () => props.modelValue,
  (newValue) => {
    inputValue.value = isDef(newValue) ? String(newValue) : ''
  }
)

const placeholderValue = computed(() => {
  return isDef(props.placeholder) ? props.placeholder : translate('placeholder')
})

const showClear = computed(() => {
  const { readonly, clearable, clearTrigger } = props
  return Boolean(
    clearable &&
      !readonly &&
      !isDisabled.value &&
      inputValue.value &&
      (clearTrigger === 'always' || (clearTrigger === 'focus' && focusing.value))
  )
})

const showWordCount = computed(() => {
  const { readonly, maxlength, showWordLimit } = props
  return Boolean(!isDisabled.value && !readonly && isDef(maxlength) && Number(maxlength) > -1 && showWordLimit)
})

/** 当前输入框文字长度（Array.from 正确处理多码元字符） */
const currentLength = computed(() => {
  return Array.from(String(formatValue(props.modelValue))).length
})

const rootClass = computed(() => {
  const classes = ['wd-input']
  if (props.error) classes.push('is-error')
  if (isDisabled.value) classes.push('is-disabled')
  if (isCompact.value) classes.push('is-compact')
  if (props.customClass) classes.push(props.customClass)
  return classes.join(' ')
})

const inputPlaceholderClass = computed(() => {
  return `wd-input__placeholder ${props.placeholderClass}`
})

const isCompact = computed(() => {
  return isDef(props.compact) ? props.compact : isDef(formItemValidate.value)
})

function getInitValue() {
  const formatted = formatValue(props.modelValue)
  if (!isValueEqual(formatted, props.modelValue)) {
    emit('update:modelValue', formatted)
  }
  return formatted
}

function formatValue(value: string | number) {
  const { maxlength } = props
  if (isDef(maxlength) && Number(maxlength) !== -1 && String(value).length > Number(maxlength)) {
    return value.toString().slice(0, Number(maxlength))
  }
  return value
}

function isValueEqual(value1: number | string, value2: number | string) {
  return isEqual(String(value1), String(value2))
}

function togglePwdVisible() {
  isPwdVisible.value = !isPwdVisible.value
}

async function handleClear() {
  focusing.value = false
  inputValue.value = ''
  if (props.focusWhenClear) {
    clearing.value = true
    focused.value = false
  }
  await pause()
  if (props.focusWhenClear) {
    focused.value = true
    focusing.value = true
  }
  emit('update:modelValue', inputValue.value)
  emit('clear')
}

async function handleBlur() {
  // 等待 150ms，确保 clear 执行完毕
  await pause(150)
  if (clearing.value) {
    clearing.value = false
    return
  }
  focusing.value = false
  emit('blur', { value: inputValue.value })
  await formItemValidate.value?.validateByTrigger('blur')
}

function handleFocus({ detail }: any) {
  focusing.value = true
  emit('focus', detail)
}

function handleInput({ detail }: any) {
  emit('update:modelValue', inputValue.value)
  emit('input', detail)
}

function handleKeyboardheightchange({ detail }: any) {
  emit('keyboardheightchange', detail)
}

function handleConfirm({ detail }: any) {
  emit('confirm', detail)
}

function onClickSuffixIcon() {
  emit('clicksuffixicon')
}

function onClickPrefixIcon() {
  emit('clickprefixicon')
}

function handleClick(event: any) {
  emit('click', event)
}
</script>

<template>
  <view :class="rootClass" :style="customStyle" @tap="handleClick">
    <view v-if="prefixIcon || $slots.prefix" class="wd-input__prefix">
      <wd-icon
        v-if="prefixIcon && !$slots.prefix"
        custom-class="wd-input__icon"
        :name="prefixIcon"
        :class-prefix="iconPrefix"
        :css-icon="cssIcon"
        @tap="onClickPrefixIcon"
      />
      <slot v-else name="prefix" />
    </view>
    <input
      :class="[
        'wd-input__inner',
        prefixIcon ? 'wd-input__inner--prefix' : '',
        showWordCount ? 'wd-input__inner--count' : '',
        alignRight ? 'is-align-right' : '',
        customInputClass
      ]"
      :type="type"
      :password="showPassword && !isPwdVisible"
      :value="String(inputValue)"
      :placeholder="placeholderValue"
      :disabled="isDisabled || readonly"
      :maxlength="maxlength"
      :focus="focused"
      :confirm-type="confirmType"
      :confirm-hold="confirmHold"
      :cursor="cursor"
      :cursor-spacing="cursorSpacing"
      :placeholder-style="placeholderStyle"
      :selection-start="selectionStart"
      :selection-end="selectionEnd"
      :adjust-position="adjustPosition"
      :hold-keyboard="holdKeyboard"
      :always-embed="alwaysEmbed"
      :placeholder-class="inputPlaceholderClass"
      :ignoreCompositionEvent="ignoreCompositionEvent"
      :inputmode="inputmode"
      :enable-native="enableNative"
      @input="handleInput"
      @focus="handleFocus"
      @blur="handleBlur"
      @confirm="handleConfirm"
      @keyboardheightchange="handleKeyboardheightchange"
    />
    <view v-if="readonly" class="wd-input__readonly-mask" />
    <view v-if="showClear || showPassword || suffixIcon || showWordCount || $slots.suffix" class="wd-input__suffix">
      <wd-icon v-if="showClear" custom-class="wd-input__clear" name="close-circle" @tap="handleClear" />
      <wd-icon
        v-if="showPassword"
        custom-class="wd-input__icon"
        :name="isPwdVisible ? 'eye' : 'eye-invisible'"
        @tap="togglePwdVisible"
      />
      <view v-if="showWordCount" class="wd-input__count">
        <text>{{ currentLength }}/{{ maxlength }}</text>
      </view>
      <wd-icon
        v-if="suffixIcon && !$slots.suffix"
        custom-class="wd-input__icon"
        :name="suffixIcon"
        :class-prefix="iconPrefix"
        :css-icon="cssIcon"
        @tap="onClickSuffixIcon"
      />
      <slot v-else name="suffix" />
    </view>
  </view>
</template>
