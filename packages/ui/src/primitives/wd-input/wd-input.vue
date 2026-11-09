/*
 * wd-input — 输入框
 *
 * 与 wot-ui 2.3.2 对齐；Lynx 适配点（相对参考源的差异）：
 * - 根节点三件套（NATIVE-REWRITE §3.1）：index.scss 显式声明
 *   display:flex + flex-direction:row + align-items:center，「前缀图标 /
 *   原生输入框 / 后缀区」横向排列且交叉轴居中；__prefix / __suffix 同为
 *   显式 flex row 容器；
 * - 基于 Lynx 原生 input 元素；参考源用 v-model 双向绑定，故改 :value
 *   受控绑定 + @input 回写 inputValue 后再向上同步（语义与 v-model 一致）；
 *   程序化改写另经 useNativeInputValue 走原生 setValue 通道（真机上
 *   :value 属性通道刷新不了用户已输入过的输入框，见该 composable 注释）；
 * - @click → @tap（CONVENTIONS §6：Lynx view/图标只派发 tap）；
 * - customStyle 经 parseStyle() 归一为对象后下发（CONVENTIONS §19）；
 * - 根 view 绑 @tap 并在 emits 声明 'tap' 转发（CONVENTIONS §14：消费方
 *   在组件上绑 @tap 才不会落入同名监听合并崩溃）；
 * - 内置图标集无 close-circle / eye / eye-invisible 字形，清空取
 *   close-bold、密码可见取 browse、不可见取 eye-close（图标注册表差异）；
 * - pause() 续写前经 useAlive() 判存活，避免卸载后晚到 patch（真机 9902）；
 * - always-embed / enable-native / ignore-composition-event / inputmode 为
 *   小程序 / H5 专有属性，保留透传、Lynx 侧不生效。
 */
<script lang="ts" setup>
import './index.css'

import { computed, ref, watch } from 'vue-lynx'
import WdIcon from '../wd-icon/wd-icon.vue'
import { inputProps } from './types'
import { isDef, isEqual, pause, parseStyle } from '../../common/util'
import { useParent } from '../../composables/useParent'
import { useTranslate } from '../../composables/useTranslate'
import { useFormDisabled } from '../../composables/useFormDisabled'
import { FORM_ITEM_VALIDATE_KEY } from '../../composables/useFormItemValidate'
import { useAlive } from '../../composables/useAlive'
import { useNativeInputValue } from '../../composables/useNativeInputValue'

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
  'click',
  'tap'
])

const { translate } = useTranslate('input')
const { parent: formItemValidate } = useParent(FORM_ITEM_VALIDATE_KEY)
const isDisabled = useFormDisabled(props)
// Lynx Android setMaxLength 直接构造 InputFilter.LengthFilter；-1 会拒绝
// 所有新增字符，不是“不限”。公开 API 保留 -1，原生通道用 Int.MAX_VALUE，
// 且必须显式下发，才能在有限长度 → 不限长度时清除旧过滤器。
// https://github.com/lynx-family/lynx/blob/4.0.0/platform/android/lynx_xelement/lynx_xelement_input/src/main/java/com/lynx/xelement/input/LynxUIBaseInput.kt
const nativeMaxlength = computed(() => {
  const length = props.maxlength
  return Number.isFinite(length) && length >= 0 ? Math.min(Math.floor(length), 2147483647) : 2147483647
})
const isAlive = useAlive()
let inputRequest = 0
let blurRequest = 0
watch([() => props.modelValue, isDisabled, () => props.readonly], () => { inputRequest++ }, { flush: 'sync' })

const isPwdVisible = ref<boolean>(false)
const clearing = ref<boolean>(false) // 是否正在清空操作，避免重复触发失焦
const focused = ref<boolean>(false) // 控制聚焦
const focusing = ref<boolean>(false) // 当前是否激活状态
const inputValue = ref<string | number>(getInitValue()) // 输入框的值
/**
 * 原生输入框受控值同步（真机 setValue 通道）。
 *
 * 程序化改写 inputValue（清除 / 外部受控 / maxlength 截断）必须经该通道
 * 推送，否则真机上输入框文本不刷新——clearable 的清除按钮就是因此「点了
 * 没反应」。Web 预览的属性通道全绿，该类缺陷只在真机暴露。
 */
const { inputId, markNativeValue } = useNativeInputValue(inputValue, 'wd-input')

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
  // null 与 undefined 一视同仁归一为 ''：Vue 只对 undefined 应用 prop 默认值，
  // 显式传入的 null 不套用，原样返回会在 :value="String(inputValue)" 渲染出
  // 字面量 "null"（maxlength 场景下 value.toString() 还会抛 TypeError）
  const normalized = isDef(value) ? value : ''
  const maxlength = nativeMaxlength.value
  if (String(normalized).length > maxlength) {
    return normalized.toString().slice(0, maxlength)
  }
  return normalized
}

function togglePwdVisible() {
  isPwdVisible.value = !isPwdVisible.value
}
async function handleClear() {
  if (isDisabled.value || props.readonly) return
  const request = ++inputRequest
  focusing.value = false
  inputValue.value = ''
  if (props.focusWhenClear) {
    clearing.value = true
    focused.value = false
  }
  await pause()
  if (!isAlive()) return
  if (request !== inputRequest || isDisabled.value || props.readonly) {
    clearing.value = false
    return
  }
  if (props.focusWhenClear) {
    focused.value = true
    focusing.value = true
  }
  emit('update:modelValue', '')
  emit('clear')
}
async function handleBlur() {
  const request = ++blurRequest
  // 等待150毫秒，clear执行完毕；重新聚焦后不再转发旧失焦。
  await pause(150)
  if (!isAlive() || request !== blurRequest) return
  if (clearing.value) {
    clearing.value = false
    return
  }
  focusing.value = false
  emit('blur', {
    value: inputValue.value
  })
  await formItemValidate.value?.validateByTrigger('blur')
}
function handleFocus({ detail }: any) {
  if (isDisabled.value || props.readonly) return
  blurRequest++
  focusing.value = true
  emit('focus', detail)
}
function handleInput({ detail }: any) {
  if (isDisabled.value || props.readonly) return
  // detail 容错：事件载荷缺失（宿主/测试环境直接派发）时按空串处理，
  // 不能让 TypeError 击穿事件注册表派发链
  const value = detail?.value ?? ''
  // 先记住原生已显示的值；setValue 的 TextWatcher 回声不是新的用户编辑，
  // 不能重复 emit，也不能递增 inputRequest 把正在进行的 clear 取消。
  markNativeValue(value)
  if (isValueEqual(value, inputValue.value)) return
  inputRequest++
  inputValue.value = value
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
  emit('tap', event)
}
function isValueEqual(value1: number | string, value2: number | string) {
  return isEqual(String(value1), String(value2))
}
</script>

<template>
  <view :class="rootClass" :style="parseStyle(customStyle)" @tap="handleClick">
    <view v-if="prefixIcon || $slots.prefix" class="wd-input__prefix">
      <WdIcon
        v-if="prefixIcon && !$slots.prefix"
        custom-class="wd-input__icon"
        :name="prefixIcon"
        :class-prefix="iconPrefix"
        :css-icon="cssIcon"
        @tap="onClickPrefixIcon"
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
      :id="inputId"
      :type="type"
      :password="showPassword && !isPwdVisible"
      :value="String(inputValue)"
      :placeholder="placeholderValue"
      :disabled="isDisabled || readonly"
      :maxlength="nativeMaxlength"
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
      <WdIcon v-if="showClear" custom-class="wd-input__clear" name="close-bold" @tap="handleClear" />
      <WdIcon v-if="showPassword" custom-class="wd-input__icon" :name="isPwdVisible ? 'browse' : 'eye-close'" @tap="togglePwdVisible" />
      <view v-if="showWordCount" class="wd-input__count"><text>{{ currentLength }}/{{ maxlength }}</text></view>
      <WdIcon
        v-if="suffixIcon && !$slots.suffix"
        custom-class="wd-input__icon"
        :name="suffixIcon"
        :class-prefix="iconPrefix"
        :css-icon="cssIcon"
        @tap="onClickSuffixIcon"
      />
      <slot v-else name="suffix"></slot>
    </view>
  </view>
</template>
