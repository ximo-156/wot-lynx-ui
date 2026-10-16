/*
 * wd-textarea — 文本域
 *
 * Lynx 实现说明：
 * - 基于 Lynx 原生 textarea 元素（auto-height / show-confirm-bar /
 *   cursor-spacing 等原生属性透传），经 :value + @input 双向同步；
 * - readonly 经遮罩 view 拦截交互；blur 通知 form-item 校验。
 */
<script lang="ts" setup>
import './index.css'

import { computed, ref, watch } from 'vue-lynx'
import WdIcon from '../wd-icon/wd-icon.vue'
import { textareaProps } from './types'
import { isDef, isString, pause, parseStyle } from '../../common/util'
import { useParent } from '../../composables/useParent'
import { useTranslate } from '../../composables/useTranslate'
import { useFormDisabled } from '../../composables/useFormDisabled'
import { FORM_ITEM_VALIDATE_KEY } from '../../composables/useFormItemValidate'
import { useAlive } from '../../composables/useAlive'

const props = defineProps(textareaProps)
const emit = defineEmits(['update:modelValue', 'clear', 'blur', 'focus', 'input', 'keyboardheightchange', 'confirm', 'linechange', 'click'])

const { translate } = useTranslate('textarea')
const { parent: formItemValidate } = useParent(FORM_ITEM_VALIDATE_KEY)
const isDisabled = useFormDisabled(props)
const isAlive = useAlive()

const hasPrefixIcon = computed(() => Boolean(props.prefixIcon || (isString(props.cssIcon) && props.cssIcon)))

const placeholderValue = computed(() => {
  return isDef(props.placeholder) ? props.placeholder : translate('placeholder')
})

const clearing = ref<boolean>(false)
const focused = ref<boolean>(false)
const focusing = ref<boolean>(false)
const inputValue = ref<string>('')

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
  },
  { immediate: true, deep: true }
)

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

const currentLength = computed(() => {
  // 读本地 inputValue 而非 props.modelValue：modelValue 为 null 时
  // String(null)="null"（长度 4），字数统计会显示 "4/50"。inputValue
  // 已由 watch（immediate）把 null/undefined 归一为 ''。
  return Array.from(String(inputValue.value)).length
})

const rootClass = computed(() => {
  const classes = ['wd-textarea']
  if (props.error) classes.push('is-error')
  if (isDisabled.value) classes.push('is-disabled')
  if (props.customClass) classes.push(props.customClass)
  return classes.join(' ')
})

const inputPlaceholderClass = computed(() => {
  return `wd-textarea__placeholder ${props.placeholderClass}`
})

async function handleClear() {
  focusing.value = false
  inputValue.value = ''
  if (props.focusWhenClear) {
    clearing.value = true
    focused.value = false
  }
  await pause()
  // 暂停窗口内组件可能已卸载：续写在已销毁树上 patch 会产生晚到的
  // remove/insert（真机 9902 removeNode 家族）。
  if (!isAlive()) return
  if (props.focusWhenClear) {
    focused.value = true
    focusing.value = true
  }
  emit('update:modelValue', inputValue.value)
  emit('clear')
}

async function handleBlur() {
  await pause(150)
  if (!isAlive()) return
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

function handleConfirm({ detail }: any) {
  emit('confirm', detail)
}

function handleLineChange({ detail }: any) {
  emit('linechange', detail)
}

function handleKeyboardheightchange({ detail }: any) {
  emit('keyboardheightchange', detail)
}
</script>

<template>
  <view :class="rootClass" :style="parseStyle(customStyle)">
    <view :class="['wd-textarea__body', customTextareaContainerClass]">
      <wd-icon
        v-if="hasPrefixIcon"
        custom-class="wd-textarea__prefix"
        :name="prefixIcon"
        :class-prefix="iconPrefix"
        :css-icon="cssIcon"
      />
      <textarea
        :class="['wd-textarea__inner', customTextareaClass]"
        :value="inputValue"
        :show-count="false"
        :placeholder="placeholderValue"
        :disabled="isDisabled || readonly"
        :enable-native="enableNative"
        :maxlength="maxlength"
        :focus="focused"
        :auto-focus="autoFocus"
        :placeholder-style="placeholderStyle"
        :placeholder-class="inputPlaceholderClass"
        :auto-height="autoHeight"
        :cursor-spacing="cursorSpacing"
        :fixed="fixed"
        :cursor="cursor"
        :show-confirm-bar="showConfirmBar"
        :selection-start="selectionStart"
        :selection-end="selectionEnd"
        :adjust-position="adjustPosition"
        :hold-keyboard="holdKeyboard"
        :confirm-type="confirmType"
        :confirm-hold="confirmHold"
        :disable-default-padding="disableDefaultPadding"
        :ignoreCompositionEvent="ignoreCompositionEvent"
        :inputmode="inputmode"
        @input="handleInput"
        @focus="handleFocus"
        @blur="handleBlur"
        @confirm="handleConfirm"
        @linechange="handleLineChange"
        @keyboardheightchange="handleKeyboardheightchange"
      />
      <view v-if="readonly" class="wd-textarea__readonly-mask" />
      <wd-icon v-if="showClear" custom-class="wd-textarea__clear" name="close-bold" @tap="handleClear" />
    </view>
    <view v-if="showWordCount" class="wd-textarea__count">
      <text>{{ currentLength }}/{{ maxlength }}</text>
    </view>
  </view>
</template>
