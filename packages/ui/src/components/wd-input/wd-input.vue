<template>
  <view :class="rootClass" :style="styleToObject(customStyle)" @tap="handleClick">
    <view v-if="prefixIcon || $slots.prefix" class="wd-input__prefix">
      <WdIcon
        v-if="prefixIcon && !$slots.prefix"
        custom-class="wd-input__icon"
        :name="prefixIcon"
        :color="ICON_COLOR"
        :class-prefix="iconPrefix"
        :css-icon="cssIcon"
        @click="onClickPrefixIcon"
      />
      <slot v-else name="prefix"></slot>
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
      :value="inputValue"
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
    <view v-if="props.readonly" class="wd-input__readonly-mask" />
    <view v-if="showClear || showPassword || suffixIcon || showWordCount || $slots.suffix" class="wd-input__suffix">
      <WdIcon v-if="showClear" custom-class="wd-input__clear" name="close-circle" :color="ICON_COLOR" @click="handleClear" />
      <WdIcon v-if="showPassword" custom-class="wd-input__icon" :name="isPwdVisible ? 'eye' : 'eye-invisible'" :color="ICON_COLOR" @click="togglePwdVisible" />
      <view v-if="showWordCount" class="wd-input__count"><text>{{ currentLength }}/{{ maxlength }}</text></view>
      <WdIcon
        v-if="suffixIcon && !$slots.suffix"
        custom-class="wd-input__icon"
        :name="suffixIcon"
        :color="ICON_COLOR"
        :class-prefix="iconPrefix"
        :css-icon="cssIcon"
        @click="onClickSuffixIcon"
      />
      <slot v-else name="suffix"></slot>
    </view>
  </view>
</template>

<script setup lang="ts">
import './index.css'
import { computed, ref, watch } from 'vue-lynx'
import WdIcon from '../wd-icon/wd-icon.vue'
import { COOLGREY } from '../../common/theme'

/** 输入框图标色：Lynx 的 wd-icon SVG 不吃 CSS color，显式下发辅助灰 */
const ICON_COLOR = COOLGREY[6]
import { styleToObject, isDef, pause, isEqual } from '../../common/util'
import { useParent } from '../../composables/useParent'
import { useTranslate } from '../../composables/useTranslate'
import { useFormDisabled } from '../../composables/useFormDisabled'
import { inputProps } from './types'
import { FORM_ITEM_VALIDATE_KEY } from '../wd-form-item/types'

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
const clearing = ref<boolean>(false) // 是否正在清空操作，避免重复触发失焦
const focused = ref<boolean>(false) // 控制聚焦
const focusing = ref<boolean>(false) // 当前是否激活状态
const inputValue = ref<string | number>(getInitValue()) // 输入框的值

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

/**
 * 展示清空按钮
 */
const showClear = computed(() => {
  const { readonly, clearable, clearTrigger } = props
  if (
    clearable &&
    !readonly &&
    !isDisabled.value &&
    inputValue.value &&
    (clearTrigger === 'always' || (props.clearTrigger === 'focus' && focusing.value))
  ) {
    return true
  } else {
    return false
  }
})

/**
 * 展示字数统计
 */
const showWordCount = computed(() => {
  const { readonly, maxlength, showWordLimit } = props
  return Boolean(!isDisabled.value && !readonly && isDef(maxlength) && maxlength > -1 && showWordLimit)
})

// 当前输入框文字长度
const currentLength = computed(() => {
  /**
   * 使用Array.from处理多码元字符以获取正确的长度
   * @link https://github.com/Moonofweisheng/wot-design-uni/issues/933
   */
  return Array.from(String(formatValue(props.modelValue))).length
})

const rootClass = computed(() => {
  return `wd-input ${props.error ? 'is-error' : ''} ${isDisabled.value ? 'is-disabled' : ''}  ${isCompact.value ? 'is-compact' : ''} ${
    props.customClass
  }`
})

const inputPlaceholderClass = computed(() => {
  return `wd-input__placeholder  ${props.placeholderClass}`
})

const isCompact = computed(() => {
  return isDef(props.compact) ? props.compact : isDef(formItemValidate.value)
})

// 状态初始化
function getInitValue() {
  const formatted = formatValue(props.modelValue)
  if (!isValueEqual(formatted, props.modelValue)) {
    emit('update:modelValue', formatted)
  }
  return formatted
}

function formatValue(value: string | number) {
  const { maxlength } = props
  if (isDef(maxlength) && maxlength !== -1 && String(value).length > maxlength) {
    return value.toString().slice(0, maxlength)
  }
  return value
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
  // 等待150毫秒，clear执行完毕
  await pause(150)
  if (clearing.value) {
    clearing.value = false
    return
  }
  focusing.value = false
  emit('blur', {
    value: inputValue.value
  })
  try {
    // validateByTrigger 内部已兜底，这里再包一层：handleBlur 是 async 且由
    // @blur 直接调用，任何漏网拒绝都会崩卡片
    await formItemValidate.value?.validateByTrigger('blur')
  } catch (error) {
    console.warn('[wot-lynx-ui] wd-input: blur 校验失败，已忽略', error)
  }
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
function handleClick(event: MouseEvent) {
  emit('click', event)
}
function isValueEqual(value1: number | string, value2: number | string) {
  return isEqual(String(value1), String(value2))
}
</script>

