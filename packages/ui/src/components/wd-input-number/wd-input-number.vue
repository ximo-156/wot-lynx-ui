/*
 * wd-input-number — 步进器
 *
 * 与 wot-ui 2.3.2 对齐；Lynx 适配点（相对参考源的差异）：
 * - 根节点三件套（NATIVE-REWRITE §3.1）：index.scss 显式声明
 *   display:flex + flex-direction:row + align-items:center，「减号 /
 *   输入框 / 加号」横向排列且交叉轴居中；加减按钮为显式 flex row +
 *   justify-content:center 容器；
 * - 加减按钮 + 原生 input 元素；:value 受控绑定 + @input 回写（vue-lynx
 *   运行时对原生元素不挂 vModel 指令），语义与参考源 v-model 一致；
 * - @click → @tap（CONVENTIONS §6：Lynx view 只派发 tap）；
 * - 参考源减号/加号字形经 ::before / ::after 伪元素绘制（currentColor），
 *   Lynx 无伪元素，改为模板真实元素 wd-input-number__action-icon（横条）
 *   与 --vertical（竖条），背景取 currentColor，视觉与参考源一致；
 * - 长按连续步进经 touchstart/touchend + 定时器实现（不用 Main Thread
 *   Script，CONVENTIONS §10）；touchmove.stop.prevent 阻止长按拖动期间
 *   页面滚动；touchcancel 与 onUnmounted 兜底清理定时器（参考源仅依赖
 *   touchend，丢失时会无限步进——Lynx 上手势被系统接管时 touchend 可能
 *   丢失，故补兜底）；
 * - 长按已步进时 tap 去重（部分平台长按抬起后仍补发 tap，否则每次长按
 *   结束都会额外步进一次）；去重标志为 setup 作用域 ref，每实例一份
 *   （模块级变量会跨实例串染）；
 * - inputWidth 内联宽度经 Style Funnel（defineStyleKeys + resolveStyle）
 *   每帧输出完整键集（CONVENTIONS §20）：中性值取组件令牌
 *   var(--wot-input-number-input-width, …)，与类声明宽度同值——无值时
 *   视觉等同不设置，由有值转无值时旧宽度不残留；
 * - customStyle 经 parseStyle() 归一为对象后下发（CONVENTIONS §19）；
 * - blur 时经 FORM_ITEM_VALIDATE_KEY 通知 form-item 校验；
 * - 平台 options 块（virtualHost / styleIsolation / addGlobalClass）为
 *   小程序专有能力，Lynx 不需要，未声明。
 */
<script lang="ts" setup>
import './index.css'

import { computed, nextTick, onUnmounted, ref, watch } from 'vue-lynx'
import { inputNumberProps, type OperationType } from './types'
import { addUnit, isDef, isEqual, parseStyle } from '../../common/util'
import { defineStyleKeys, resolveStyle } from '../../common/style'
import { useParent } from '../../composables/useParent'
import { useFormDisabled } from '../../composables/useFormDisabled'
import { callInterceptor } from '../../common/interceptor'
import { useAlive } from '../../composables/useAlive'
import { FORM_ITEM_VALIDATE_KEY } from '../../composables/useFormItemValidate'

const props = defineProps(inputNumberProps)
const { parent: formItemValidate } = useParent(FORM_ITEM_VALIDATE_KEY)
const isDisabled = useFormDisabled(props)
const isAlive = useAlive()
let changeRequest = 0
let inputRequest = 0
watch([() => props.modelValue, isDisabled, () => props.disableInput, () => props.min, () => props.max, () => props.step, () => props.precision, () => props.stepStrictly, () => props.allowNull, () => props.disableMinus, () => props.disablePlus], () => { changeRequest++; inputRequest++ }, { flush: 'sync' })

/**
 * 输入框可切换样式键 + 中性值（CONVENTIONS §20 Style Funnel）。
 *
 * 中性值与 index.scss 中 `.wd-input-number__input` 的类声明宽度同源
 * （同一令牌链），保证任何一帧都输出完整键集：inputWidth 由有值转为
 * 无值时回落令牌宽度，不会残留上次的 inline 宽度。
 */
const INPUT_WIDTH_STYLE = defineStyleKeys({ width: 'var(--wot-input-number-input-width, var(--wot-n-36, 36px))' })

/** 输入框宽度（完整键集输出；有值语义与参考源 inputWidth 三元一致） */
const inputStyle = computed(() => resolveStyle(INPUT_WIDTH_STYLE, { width: props.inputWidth ? addUnit(props.inputWidth) : '' }))

const emit = defineEmits<{
  /**
   * 数值变化事件
   */
  (e: 'change', value: { value: number | string }): void
  /**
   * 输入框聚焦事件
   */
  (e: 'focus', detail: any): void
  /**
   * 输入框失焦事件
   */
  (e: 'blur', value: { value: string | number }): void
  /**
   * v-model 更新事件
   */
  (e: 'update:modelValue', value: number | string): void
}>()

const inputValue = ref<string | number>(getInitValue())
let longPressTimer: ReturnType<typeof setTimeout> | null = null

/**
 * 长按连续步进是否已执行过步进（tap 去重标志）。
 *
 * 部分平台在长按抬起后仍会补发一次 tap：@tap 与长按定时器叠加无去重时，
 * 每次长按结束都会额外步进一次。touchstart 重置标志，长按定时器首个步进
 * 置位，tap 消费后跳过当次。
 *
 * 标志置于 setup 作用域（每实例一份）：此前为模块级变量，同屏多个步进器
 * 时长按其一会吞掉另一个的 tap（跨实例状态串染）。
 */
const longPressStepped = ref<boolean>(false)

onUnmounted(() => {
  clearLongPressTimer()
})

/**
 * 判断数字是否达到最小值限制
 */
const minDisabled = computed(() => {
  const val = toNumber(inputValue.value)
  return isDisabled.value || val <= props.min || addStep(val, -props.step) < props.min
})

/**
 * 判断数字是否达到最大值限制
 */
const maxDisabled = computed(() => {
  const val = toNumber(inputValue.value)
  return isDisabled.value || val >= props.max || addStep(val, props.step) > props.max
})

// 监听 modelValue 变化
watch(
  () => props.modelValue,
  (val) => {
    inputValue.value = formatValue(val)
  }
)

// 监听 max, min, precision 变化时重新格式化当前值
watch([() => props.max, () => props.min, () => props.precision], () => {
  const val = toNumber(inputValue.value)
  inputValue.value = formatValue(val)
})

/**
 * 获取初始值
 */
function getInitValue() {
  if (!props.updateOnInit) {
    // 不自动修正时，仅做显示格式化，不修正值
    return formatDisplay(props.modelValue)
  }

  const formatted = formatValue(props.modelValue)

  // 如果格式化后的值与原始值不同，同步到外部
  if (!isEqual(String(formatted), String(props.modelValue))) {
    emit('update:modelValue', formatted)
  }
  return formatted
}

/**
 * 获取数字的小数位数
 */
function getPrecision(val?: number) {
  if (!isDef(val)) return 0
  const str = val.toString()
  const dotIndex = str.indexOf('.')
  return dotIndex === -1 ? 0 : str.length - dotIndex - 1
}

/**
 * 按指定精度处理数值
 */
function toPrecision(val: number) {
  const precision = Number(props.precision)
  return Math.round(val * Math.pow(10, precision)) / Math.pow(10, precision)
}

/**
 * 将字符串或数字转换为标准数值
 */
function toNumber(val: string | number): number {
  // 空值处理
  if (props.allowNull && (!isDef(val) || val === '')) {
    return NaN
  }

  if (!isDef(val) || val === '') {
    return props.min
  }

  let str = String(val)

  // 处理中间输入状态
  if (str.endsWith('.')) str = str.slice(0, -1)
  if (str.startsWith('.')) str = '0' + str
  if (str.startsWith('-.')) str = '-0' + str.substring(1)
  if (str === '-' || str === '') return props.min

  let num = Number(str)
  if (isNaN(num)) num = props.min

  return normalizeValue(num)
}

/**
 * 标准化数值（应用步进、边界、精度规则）
 */
function normalizeValue(val: number): number {
  let result = val

  // 严格步进
  if (props.stepStrictly) {
    const stepPrecision = getPrecision(props.step)
    const factor = Math.pow(10, stepPrecision)
    result = (Math.round(result / props.step) * factor * props.step) / factor
  }

  // 边界限制
  if (props.stepStrictly) {
    result = applyStrictBounds(result, props.min, props.max)
  } else {
    result = Math.min(Math.max(result, props.min), props.max)
  }

  // 精度处理
  if (isDef(props.precision)) {
    result = toPrecision(result)
  }

  return result
}

/**
 * 严格步进模式下的边界处理
 */
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

  if (val > max) {
    const maxSteps = Math.floor((max * factor) / (props.step * factor))
    const candidate = toPrecision((maxSteps * props.step * factor) / factor)
    if (candidate < min) {
      const minSteps = Math.ceil((min * factor) / (props.step * factor))
      return toPrecision((minSteps * props.step * factor) / factor)
    }
    return candidate
  }

  return val
}

/**
 * 格式化值用于显示（包含修正逻辑）
 */
function formatValue(val: string | number): string | number {
  if (props.allowNull && (!isDef(val) || val === '')) {
    return ''
  }

  const num = toNumber(val)
  const precision = Number(props.precision)
  if (!isDef(props.precision)) {
    return num
  }
  return precision === 0 ? Number(num.toFixed(0)) : num.toFixed(precision)
}

/**
 * 仅做显示格式化，不包含值修正逻辑
 */
function formatDisplay(val: string | number): string | number {
  if (props.allowNull && (!isDef(val) || val === '')) {
    return ''
  }

  if (!isDef(val) || val === '') {
    return props.min
  }

  let num = Number(val)
  if (isNaN(num)) {
    return props.min
  }

  const precision = Number(props.precision)
  if (!isDef(props.precision)) {
    return num
  }
  return precision === 0 ? Number(num.toFixed(0)) : num.toFixed(precision)
}

/**
 * 检查是否为中间输入状态
 */
function isIntermediate(val: string): boolean {
  if (!val) return false
  const str = String(val)
  return str.endsWith('.') || str.startsWith('.') || str.startsWith('-.') || str === '-' || (Number(props.precision) > 0 && str.indexOf('.') === -1)
}

/**
 * 清理输入值
 */
function cleanInput(val: string): string {
  if (!val) return ''

  // 清理非数字、小数点、负号
  let cleaned = val.replace(/[^\d.-]/g, '')

  // 处理负号，保证负号只出现在最前面
  const hasNegative = cleaned.startsWith('-')
  cleaned = cleaned.replace(/-/g, '')
  if (hasNegative) cleaned = '-' + cleaned

  // 处理小数点
  const precision = Number(props.precision)
  if (precision > 0) {
    const parts = cleaned.split('.')
    if (parts.length > 2) {
      cleaned = parts[0] + '.' + parts.slice(1).join('')
    }
  } else {
    cleaned = cleaned.split('.')[0]
  }

  // 处理以点开头的情况
  if (cleaned.startsWith('.')) return '0' + cleaned
  if (cleaned.startsWith('-.')) return '-0' + cleaned.substring(1)

  return cleaned
}

/**
 * 更新值并触发事件
 */
function updateValue(val: string | number) {
  if (!isAlive() || isDisabled.value) return
  const request = ++changeRequest
  const oldValue = props.modelValue
  const canCommit = () => isAlive() && request === changeRequest && props.modelValue === oldValue && !isDisabled.value
  // 空值处理
  if (props.allowNull && (!isDef(val) || val === '')) {
    if (isEqual('', String(props.modelValue))) {
      inputValue.value = ''
      return
    }

    const doUpdate = () => {
      if (!canCommit()) return
      inputValue.value = ''
      emit('update:modelValue', '')
      emit('change', { value: '' })
    }

    callInterceptor(props.beforeChange, { args: [''], done: doUpdate })
    return
  }

  const num = toNumber(val)
  const display = formatValue(val)

  if (isEqual(String(num), String(props.modelValue))) {
    inputValue.value = display
    return
  }

  const doUpdate = () => {
    if (!canCommit()) return
    inputValue.value = display
    emit('update:modelValue', num)
    emit('change', { value: num })
  }

  callInterceptor(props.beforeChange, { args: [num], done: doUpdate })
}

/**
 * 按步进值增减
 */
function addStep(val: string | number, step: number) {
  const num = Number(val)
  if (isNaN(num)) return normalizeValue(props.min)

  const precision = Math.max(getPrecision(num), getPrecision(step))
  const factor = Math.pow(10, precision)
  const result = (num * factor + step * factor) / factor
  return normalizeValue(result)
}

/**
 * 处理按钮点击
 */
function handleClick(type: OperationType) {
  const step = type === 'add' ? props.step : -props.step
  if ((step < 0 && (minDisabled.value || props.disableMinus)) || (step > 0 && (maxDisabled.value || props.disablePlus))) return

  const newVal = addStep(inputValue.value, step)
  updateValue(newVal)
}

/**
 * 处理输入事件
 */
function handleInput(event: any) {
  if (isDisabled.value || props.disableInput) return
  const request = ++inputRequest
  const rawVal = String(event.detail?.value ?? '')

  // 立即更新显示
  inputValue.value = rawVal

  nextTick(() => {
    if (!isAlive() || request !== inputRequest || isDisabled.value || props.disableInput) return
    // 空值处理
    if (rawVal === '') {
      inputValue.value = ''
      if (props.immediateChange && props.allowNull) {
        updateValue('')
      }
      return
    }

    // 清理输入
    const cleaned = cleanInput(rawVal)

    // 中间状态处理
    if (Number(props.precision) > 0 && isIntermediate(cleaned)) {
      inputValue.value = cleaned
      return
    }

    // 正常输入处理
    inputValue.value = cleaned
    if (props.immediateChange) {
      updateValue(cleaned)
    }
  })
}

/**
 * 处理失焦事件
 */
function handleBlur(event: any) {
  const val = event.detail.value || ''
  updateValue(val)
  emit('blur', { value: val })
  formItemValidate.value?.validateByTrigger('blur')
}

/**
 * 处理聚焦事件
 */
function handleFocus(event: any) {
  emit('focus', event.detail)
}

/**
 * 长按连续步进是否已执行过步进（tap 去重标志）。
 *
 * 部分平台在长按抬起后仍会补发一次 tap：@tap 与长按定时器叠加无去重时，
 * 每次长按结束都会额外步进一次。touchstart 重置标志，长按定时器首个步进
 * 置位，tap 消费后跳过当次。标志为 setup 作用域的 ref（每实例一份），
 * 定义见文件头附近。
 */

/** 加减按钮 tap：长按已步进过时跳过当次，避免重复步进 */
function handleActionTap(type: OperationType) {
  if (longPressStepped.value) {
    longPressStepped.value = false
    return
  }
  handleClick(type)
}

/** 长按拖动期间阻止页面滚动（模板层 @touchmove.stop.prevent 承担） */
function preventTouchMove() {}

/** 长按连续步进 */
function handleTouchStart(type: OperationType) {
  longPressStepped.value = false
  if (!props.longPress) return
  clearLongPressTimer()
  longPressTimer = setTimeout(() => {
    longPressStepped.value = true
    handleClick(type)
    longPressStep(type)
  }, 600)
}

function longPressStep(type: OperationType) {
  clearLongPressTimer()
  longPressTimer = setTimeout(() => {
    handleClick(type)
    longPressStep(type)
  }, 250)
}

function handleTouchEnd() {
  clearLongPressTimer()
}

function clearLongPressTimer() {
  if (longPressTimer) {
    clearTimeout(longPressTimer)
    longPressTimer = null
  }
}
</script>

<template>
  <view
    :class="`wd-input-number wd-input-number--${theme} ${customClass} ${isDisabled ? 'is-disabled' : ''} ${withoutInput ? 'is-without-input' : ''} ${
      round ? 'is-round' : ''
    }`"
    :style="parseStyle(customStyle)"
  >
    <!-- 减号按钮 -->
    <view
      :class="`wd-input-number__action wd-input-number__sub ${minDisabled || disableMinus ? 'is-disabled' : ''}`"
      @tap="handleActionTap('sub')"
      @touchstart="handleTouchStart('sub')"
      @touchmove.stop.prevent="preventTouchMove"
      @touchend.stop="handleTouchEnd"
      @touchcancel.stop="handleTouchEnd"
    >
      <view class="wd-input-number__action-divider" />
      <!-- 减号字形（横条）：参考源为 ::before 伪元素，Lynx 无伪元素改真实元素 -->
      <view class="wd-input-number__action-icon" />
    </view>
    <!-- 输入框 -->
    <view v-if="!withoutInput" class="wd-input-number__inner" @tap.stop="">
      <input
        class="wd-input-number__input"
        :style="inputStyle"
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
      :class="`wd-input-number__action wd-input-number__add ${maxDisabled || disablePlus ? 'is-disabled' : ''}`"
      @tap="handleActionTap('add')"
      @touchstart="handleTouchStart('add')"
      @touchmove.stop.prevent="preventTouchMove"
      @touchend.stop="handleTouchEnd"
      @touchcancel.stop="handleTouchEnd"
    >
      <view class="wd-input-number__action-divider" />
      <!-- 加号字形（横条 + 竖条）：参考源为 ::before / ::after 伪元素，Lynx 无伪元素改真实元素 -->
      <view class="wd-input-number__action-icon" />
      <view class="wd-input-number__action-icon wd-input-number__action-icon--vertical" />
    </view>
  </view>
</template>
