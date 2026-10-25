/*
 * wd-textarea — 文本域
 *
 * 与 wot-ui 2.3.2 对齐；Lynx 适配点（相对参考源的差异）：
 * - 根节点三件套（NATIVE-REWRITE §3.1）：index.scss 显式声明
 *   display:flex + flex-direction:column，「输入区 __body」与「字数统计
 *   __count」纵向堆叠（参考源根节点无 display 声明，依赖小程序 view 默认
 *   flex——Lynx 3.x 默认 linear，不写即静默丢弃 flex 属性）；
 * - 基于 Lynx 原生 textarea 元素；参考源用 v-model 双向绑定，vue-lynx
 *   运行时对原生元素不挂 vModel 指令，故改 :value 受控绑定 + @input 回写
 *   inputValue 后再向上同步（语义与 v-model 一致）；
 * - @click → @tap（CONVENTIONS §6：Lynx view/图标只派发 tap）；
 * - customStyle 经 parseStyle() 归一为对象后下发（CONVENTIONS §19）；
 * - readonly 经遮罩 view 拦截交互（Lynx textarea 无可靠 readonly 属性）；
 * - blur 时经 FORM_ITEM_VALIDATE_KEY 通知 form-item 校验；
 * - 内置图标集无 close-circle 字形，清空取 close-bold（图标注册表差异）；
 * - pause() 续写前经 useAlive() 判存活，避免卸载后晚到 patch（真机 9902）；
 * - customTextareaContainerClass 参考源已声明但未接线，此处按 JSDoc 语义
 *   接到 body 容器上（改进项，不影响参考行为）；
 * - enable-native 为支付宝小程序专有属性，保留透传、Lynx 侧不生效。
 */
<script lang="ts" setup>
import './index.css'

import { computed, onBeforeMount, ref, watch } from 'vue-lynx'
import WdIcon from '../wd-icon/wd-icon.vue'
import { textareaProps } from './types'
import { isDef, isString, pause, parseStyle } from '../../common/util'
import { useParent } from '../../composables/useParent'
import { useTranslate } from '../../composables/useTranslate'
import { useFormDisabled } from '../../composables/useFormDisabled'
import { FORM_ITEM_VALIDATE_KEY } from '../../composables/useFormItemValidate'
import { useAlive } from '../../composables/useAlive'

const props = defineProps(textareaProps)
const emit = defineEmits(['update:modelValue', 'clear', 'blur', 'focus', 'input', 'keyboardheightchange', 'confirm', 'linechange', 'click', 'tap'])

const { translate } = useTranslate('textarea')
const { parent: formItemValidate } = useParent(FORM_ITEM_VALIDATE_KEY)
const isDisabled = useFormDisabled(props)
const isAlive = useAlive()
let inputRequest = 0
let blurRequest = 0
watch([() => props.modelValue, isDisabled, () => props.readonly], () => { inputRequest++ }, { flush: 'sync' })

const hasPrefixIcon = computed(() => Boolean(props.prefixIcon || (isString(props.cssIcon) && props.cssIcon)))

const placeholderValue = computed(() => {
  return isDef(props.placeholder) ? props.placeholder : translate('placeholder')
})

const clearing = ref<boolean>(false)
const focused = ref<boolean>(false) // 控制聚焦
const focusing = ref<boolean>(false) // 当前是否激活状态
const inputValue = ref<string>('') // 输入框的值

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

// 当前文本域文字长度
const currentLength = computed(() => {
  /**
   * 使用Array.from处理多码元字符以获取正确的长度
   * @link https://github.com/Moonofweisheng/wot-design-uni/issues/933
   */
  return Array.from(String(formatValue(props.modelValue))).length
})

const rootClass = computed(() => {
  return `wd-textarea ${props.error ? 'is-error' : ''} ${isDisabled.value ? 'is-disabled' : ''} ${props.autoHeight ? 'is-auto-height' : ''} ${
    isCompact.value ? 'is-compact' : ''
  } ${props.customClass}`
})

const isCompact = computed(() => {
  return isDef(props.compact) ? props.compact : isDef(formItemValidate.value)
})

const inputPlaceholderClass = computed(() => {
  return `wd-textarea__placeholder  ${props.placeholderClass}`
})

onBeforeMount(() => {
  initState()
})

// 状态初始化
function initState() {
  inputValue.value = formatValue(inputValue.value)
  emit('update:modelValue', inputValue.value)
}

function formatValue(value: string | number) {
  if (value === null || value === undefined) return ''
  const { maxlength, showWordLimit } = props
  if (showWordLimit && maxlength !== -1 && String(value).length > maxlength) {
    return value.toString().substring(0, maxlength)
  }
  return `${value}`
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
async function handleBlur({ detail }: any) {
  const request = ++blurRequest
  await pause(150)
  if (!isAlive() || request !== blurRequest) return
  if (clearing.value) {
    clearing.value = false
    return
  }
  focusing.value = false
  emit('blur', {
    value: inputValue.value,
    cursor: detail?.cursor ? detail.cursor : null
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
  inputRequest++
  inputValue.value = formatValue(detail.value)
  emit('update:modelValue', inputValue.value)
  emit('input', detail)
}
function handleKeyboardheightchange({ detail }: any) {
  emit('keyboardheightchange', detail)
}
function handleConfirm({ detail }: any) {
  emit('confirm', detail)
}
function handleLineChange({ detail }: any) {
  emit('linechange', detail)
}
// 根 view 绑 @tap 并声明 'tap' 转发（CONVENTIONS §14）：消费方在组件上
// 绑 @tap/@click 时作为组件事件消费，不与内部绑定合并成数组。
function handleClick(event: any) {
  emit('click', event)
  emit('tap', event)
}
</script>

<template>
  <view :class="rootClass" :style="parseStyle(customStyle)" @tap="handleClick">
    <view :class="['wd-textarea__body', customTextareaContainerClass]">
      <WdIcon
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
      <WdIcon v-if="showClear" custom-class="wd-textarea__clear" name="close-bold" @tap="handleClear" />
    </view>
    <view v-if="showWordCount" class="wd-textarea__count"><text>{{ currentLength }}/{{ maxlength }}</text></view>
  </view>
</template>
