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

import { computed, ref, watch } from 'vue-lynx'
import WdIcon from '../wd-icon/wd-icon.vue'
import { searchProps } from './types'
import { useTranslate } from '../../composables/useTranslate'

const props = defineProps(searchProps)
const emit = defineEmits(['update:modelValue', 'focus', 'blur', 'confirm', 'clear', 'cancel', 'click'])

const { translate } = useTranslate('search')

const inputValue = computed(() => props.modelValue)

const isFocused = ref<boolean>(false)
const showInput = ref<boolean>(false)

// focus prop 驱动 input 显隐与聚焦（进入页面即聚焦弹键盘的用法）。
// 此前模板只绑内部 isFocused、props.focus 从未被读取：传 focus=true 时
// 连 input 元素都不渲染（showInput 初始 false），prop 完全死亡。
watch(
  () => props.focus,
  (newValue) => {
    if (newValue) {
      // 禁用态不抢焦（与 wot-ui 一致）：保持封面占位
      if (props.disabled) return
      showInput.value = true
      isFocused.value = true
    } else {
      isFocused.value = false
    }
  },
  { immediate: true }
)

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
          <wd-icon name="search" custom-class="wd-search__search-icon" />
          <text :class="`wd-search__placeholder-txt ${placeholderClass}`">{{ placeholder || translate('search') }}</text>
        </view>
        <wd-icon
          v-if="showInput || inputValue || placeholderLeft"
          name="search"
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
        <wd-icon v-if="inputValue" custom-class="wd-search__clear-icon" name="close-bold" @tap="handleClear" />
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
