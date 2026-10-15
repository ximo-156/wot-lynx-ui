/*
 * wd-search — 搜索框
 *
 * Lynx 实现说明：
 * - 未聚焦时显示「封面」占位（点击后聚焦才渲染 input，避免键盘抢焦）；
 * - 清空按钮经 wd-icon + @tap；聚焦/失焦驱动封面显隐；
 * - placeholderLeft 为 true 时始终展示 input。
 */
<script lang="ts" setup>
import './index.css'
import { parseStyle } from '../../common/util'

import { computed, ref } from 'vue-lynx'
import WdIcon from '../wd-icon/wd-icon.vue'
import { searchProps } from './types'
import { useTranslate } from '../../composables/useTranslate'

const props = defineProps(searchProps)
const emit = defineEmits(['update:modelValue', 'focus', 'blur', 'confirm', 'clear', 'cancel', 'click'])

const { translate } = useTranslate('search')

const inputValue = computed(() => props.modelValue)

const isFocused = ref<boolean>(false)
const showInput = ref<boolean>(false)

const coverStyle = computed<Record<string, string>>(() => {
  return props.placeholderLeft ? ({ display: 'none' } as Record<string, string>) : ({} as Record<string, string>)
})

function closeCover() {
  showInput.value = true
}

function handleClick() {
  emit('click')
  if (!props.disabled) {
    showInput.value = true
    isFocused.value = true
  }
}

function handleFocus({ detail }: any) {
  isFocused.value = true
  emit('focus', detail)
}

function handleBlur({ detail }: any) {
  isFocused.value = false
  emit('blur', detail)
}

function handleInput() {
  // :value 已绑定 inputValue；此处保留扩展位（如需原生 detail 可在此 emit）
}

function handleConfirm({ detail }: any) {
  emit('confirm', detail)
}

function handleClear() {
  emit('update:modelValue', '')
  emit('clear')
  if (props.focusWhenClear) {
    isFocused.value = true
  }
}

function handleCancel() {
  emit('update:modelValue', '')
  emit('cancel')
  isFocused.value = false
}

const rootClass = computed(() => {
  const classes = ['wd-search']
  if (props.variant) classes.push(`wd-search--${props.variant}`)
  if (props.customClass) classes.push(props.customClass)
  return classes.join(' ')
})
</script>

<template>
  <view :class="rootClass" :style="parseStyle(customStyle)">
    <view class="wd-search__block" @tap="handleClick">
      <slot name="prefix" />
      <view class="wd-search__field">
        <view v-if="!placeholderLeft" :style="coverStyle" class="wd-search__cover" @tap="closeCover">
          <wd-icon name="search-line" custom-class="wd-search__search-icon" />
          <text :class="`wd-search__placeholder-txt ${placeholderClass}`">{{ placeholder || translate('search') }}</text>
        </view>
        <wd-icon
          v-if="showInput || inputValue || placeholderLeft"
          name="search-line"
          custom-class="wd-search__search-left-icon"
        />
        <input
          v-if="showInput || inputValue || placeholderLeft"
          :placeholder="placeholder || translate('search')"
          :placeholder-class="`wd-search__placeholder-txt ${placeholderClass}`"
          :placeholder-style="placeholderStyle"
          confirm-type="search"
          :value="inputValue"
          :class="['wd-search__input', customInputClass]"
          @focus="handleFocus"
          @input="handleInput"
          @blur="handleBlur"
          @confirm="handleConfirm"
          :disabled="disabled"
          :maxlength="maxlength"
          :focus="isFocused"
        />
        <wd-icon v-if="inputValue" custom-class="wd-search__clear-icon" name="close-circle-fill" @tap="handleClear" />
        <slot name="input-suffix" />
      </view>
    </view>
    <slot v-if="!hideCancel" name="suffix">
      <view class="wd-search__cancel" @tap="handleCancel">
        <text>{{ cancelTxt || translate('cancel') }}</text>
      </view>
    </slot>
  </view>
</template>
