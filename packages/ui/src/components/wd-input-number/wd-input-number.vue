/*
 * wd-input-number — 步进器
 *
 * Lynx 实现说明：
 * - 加减按钮 + 原生 input 元素；长按连续步进经 touchstart/touchend +
 *   定时器实现（不用 Main Thread Script，CONVENTIONS §10）；
 * - 数值经 normalizeValue 统一走步进/边界/精度规则；
 * - beforeChange 拦截器经 common/interceptor 下发。
 */
<script lang="ts" setup>
import './index.css'

import { computed, ref, watch } from 'vue-lynx'
import { inputNumberProps, type OperationType } from './types'
import { addUnit, isDef, isEqual, parseStyle } from '../../common/util'
import { useFormDisabled } from '../../composables/useFormDisabled'
import { useParent } from '../../composables/useParent'
import { callInterceptor } from '../../common/interceptor'
import { FORM_ITEM_VALIDATE_KEY } from '../../composables/useFormItemValidate'

const props = defineProps(inputNumberProps)
const { parent: formItemValidate } = useParent(FORM_ITEM_VALIDATE_KEY)
const isDisabled = useFormDisabled(props)

const emit = defineEmits<{
  (e: 'change', value: { value: number | string }): void
  (e: 'focus', detail: any): void
  (e: 'blur', value: { value: string | number }): void
  (e: 'update:modelValue', value: number | string): void
}>()

const inputValue = ref<string | number>(getInitValue())
let longPressTimer: ReturnType<typeof setTimeout> | null = null
let longPressInterval: ReturnType<typeof setInterval> | null = null

const minDisabled = computed(() => {
  const val = toNumber(inputValue.value)
  return isDisabled.value || val <= props.min || addStep(val, -props.step) < props.min
})

const maxDisabled = computed(() => {
  const val = toNumber(inputValue.value)
  return isDisabled.value || val >= props.max || addStep(val, props.step) > props.max
})

watch(
  () => props.modelValue,
  (val) => {
    inputValue.value = formatValue(val)
  }
)

watch([() => props.max, () => props.min, () => props.precision], () => {
  const val = toNumber(inputValue.value)
  inputValue.value = formatValue(val)
})

function getInitValue() {
  if (!props.updateOnInit) {
    return formatDisplay(props.modelValue)
  }
  const formatted = formatValue(props.modelValue)
  if (!isEqual(String(formatted), String(props.modelValue))) {
    emit('update:modelValue', formatted)
  }
  return formatted
}

function getPrecision(val?: number): number {
  if (!isDef(val)) return 0
  const str = val.toString()
  const dotIndex = str.indexOf('.')
  return dotIndex === -1 ? 0 : str.length - dotIndex - 1
}

function toPrecision(val: number): number {
  const precision = Number(props.precision)
  return Math.round(val * Math.pow(10, precision)) / Math.pow(10, precision)
}

function toNumber(val: string | number): number {
  if (props.allowNull && (!isDef(val) || val === '')) {
    return NaN
  }
  if (!isDef(val) || val === '') {
    return props.min
  }
  let str = String(val)
  if (str.endsWith('.')) str = str.slice(0, -1)
  if (str.startsWith('.')) str = '0' + str
  if (str.startsWith('-.')) str = '-0' + str.substring(1)
  if (str === '-' || str === '') return props.min

  let num = Number(str)
  if (isNaN(num)) num = props.min
  return normalizeValue(num)
}

function normalizeValue(val: number): number {
  let result = val
  if (props.stepStrictly) {
    const stepPrecision = getPrecision(props.step)
    const factor = Math.pow(10, stepPrecision)
    result = (Math.round(result / props.step) * factor * props.step) / factor
    result = applyStrictBounds(result, props.min, props.max)
  } else {
    result = Math.min(Math.max(result, props.min), props.max)
  }
  if (isDef(props.precision)) {
    result = toPrecision(result)
  }
  return result
}

function applyStrictBounds(val: number, min: number, max: number): number {
  if (val >= min && val <= max) return val
  const stepPrecision = getPrecision(props.step)
  const factor = Math.pow(10, stepPrecision)
  if (val < min) {
    const minSteps = Math.ceil((min * factor) / (props.step * factor))
    const candidate = toPrecision((minSteps * props.step * factor) / factor)
    if (candidate > max) {
      const maxSteps = Math.floor((max * factor) / (props.step * factor))
      return toPrecision((maxSteps * props.step * factor) / factor)
    }
    return candidate
  }
  const maxSteps = Math.floor((max * factor) / (props.step * factor))
  return toPrecision((maxSteps * props.step * factor) / factor)
}

function formatValue(val: string | number): string | number {
  if (props.allowNull && (!isDef(val) || val === '')) {
    return ''
  }
  return formatDisplay(normalizeValue(toNumber(val)))
}

/** 显示格式化：空值 / 精度 */
function formatDisplay(val: string | number): string {
  if (props.allowNull && (!isDef(val) || val === '')) return ''
  const num = toNumber(val)
  if (isNaN(num)) return ''
  if (isDef(props.precision) && Number(props.precision) > 0) {
    return num.toFixed(Number(props.precision))
  }
  return String(num)
}

function addStep(val: number, step: number): number {
  return toPrecision(val + step)
}

/** 更新值（拦截 + 边界 + 事件） */
function updateValue(newValue: string | number, event: 'input' | 'blur' = 'input') {
  const doUpdate = () => {
    inputValue.value = formatDisplay(newValue)
    emit('update:modelValue', inputValue.value)
    emit('change', { value: inputValue.value })
    if (event === 'blur') {
      formItemValidate.value?.validateByTrigger('blur')
    }
  }
  if (isDef(props.beforeChange)) {
    callInterceptor(props.beforeChange, { args: [newValue], done: doUpdate })
  } else {
    doUpdate()
  }
}

function handleClick(type: OperationType) {
  if (isDisabled.value) return
  if (type === 'sub' && (disableMinus.value || minDisabled.value)) return
  if (type === 'add' && (disablePlus.value || maxDisabled.value)) return
  const val = toNumber(inputValue.value)
  const newValue = type === 'sub' ? addStep(val, -props.step) : addStep(val, props.step)
  updateValue(newValue)
}

const disableMinus = computed(() => props.disableMinus)
const disablePlus = computed(() => props.disablePlus)

/** 长按连续步进 */
function handleTouchStart(type: OperationType) {
  if (!props.longPress || isDisabled.value) return
  longPressTimer = setTimeout(() => {
    handleClick(type)
    longPressInterval = setInterval(() => handleClick(type), 100)
  }, 400)
}

function handleTouchEnd() {
  if (longPressTimer) {
    clearTimeout(longPressTimer)
    longPressTimer = null
  }
  if (longPressInterval) {
    clearInterval(longPressInterval)
    longPressInterval = null
  }
}

function handleInput({ detail }: any) {
  const raw = detail.value !== undefined ? detail.value : inputValue.value
  if (props.allowNull && (raw === '' || raw === null)) {
    inputValue.value = ''
    emit('update:modelValue', '')
    emit('change', { value: '' })
    return
  }
  const val = toNumber(raw)
  inputValue.value = String(raw)
  if (props.immediateChange) {
    emit('update:modelValue', formatDisplay(val))
    emit('change', { value: formatDisplay(val) })
  }
}

function handleFocus({ detail }: any) {
  emit('focus', detail)
}

function handleBlur() {
  const val = toNumber(inputValue.value)
  updateValue(val, 'blur')
  emit('blur', { value: inputValue.value })
}

const rootClass = computed(() => {
  const classes = ['wd-input-number', `wd-input-number--${props.theme}`]
  if (isDisabled.value) classes.push('is-disabled')
  if (props.withoutInput) classes.push('is-without-input')
  if (props.round) classes.push('is-round')
  if (props.customClass) classes.push(props.customClass)
  return classes.join(' ')
})
</script>

<template>
  <view :class="rootClass" :style="parseStyle(customStyle)">
    <!-- 减号按钮 -->
    <view
      :class="['wd-input-number__action', 'wd-input-number__action--sub', minDisabled || disableMinus ? 'is-disabled' : '']"
      @tap.stop="handleClick('sub')"
      @touchstart="handleTouchStart('sub')"
      @touchend.stop="handleTouchEnd"
    >
      <view class="wd-input-number__action-divider" />
    </view>
    <!-- 输入框 -->
    <view v-if="!withoutInput" class="wd-input-number__inner" @tap.stop="">
      <input
        class="wd-input-number__input"
        :style="inputWidth ? { width: addUnit(inputWidth) } : {}"
        :type="inputType"
        :input-mode="precision ? 'decimal' : 'numeric'"
        :disabled="isDisabled || disableInput"
        :value="String(inputValue)"
        :placeholder="placeholder"
        :adjust-position="adjustPosition"
        @input="handleInput"
        @focus="handleFocus"
        @blur="handleBlur"
      />
    </view>
    <!-- 加号按钮 -->
    <view
      :class="['wd-input-number__action', 'wd-input-number__action--add', maxDisabled || disablePlus ? 'is-disabled' : '']"
      @tap.stop="handleClick('add')"
      @touchstart="handleTouchStart('add')"
      @touchend.stop="handleTouchEnd"
    >
      <view class="wd-input-number__action-divider" />
      <view class="wd-input-number__action-divider wd-input-number__action-divider--vertical" />
    </view>
  </view>
</template>
