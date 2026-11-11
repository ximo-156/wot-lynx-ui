/*
 * wd-search — 搜索框
 *
 * 与 wot-ui 2.3.2 对齐；Lynx 适配点（相对参考源的差异）：
 * - 根节点三件套（NATIVE-REWRITE §3.1）：index.scss 显式声明
 *   display:flex + flex-direction:row + align-items:center，「输入块」与
 *   「取消按钮」横向排列且交叉轴居中；
 * - 未聚焦时显示「封面」占位（点击封面后才渲染 input 并聚焦，避免键盘
 *   抢焦）；封面与 input 的显隐由单一状态 showInput 互斥驱动，经 v-if
 *   结构级挂载（真机 2026-10-26 巡检：内联 display 切换在真机静默失效，
 *   且 showPlaceHolder / showInput 双状态在中间态可同时为真 → 封面残留
 *   与原生 input 并存，双占位文字 + 图标叠印）；
 * - @click → @tap（CONVENTIONS §6：Lynx view/图标只派发 tap）；
 * - 原生 input 用 :value 受控绑定 + @input 回写，语义与参考源 v-model
 *   一致；程序化改写另经 useNativeInputValue 走原生 setValue 通道（真机上
 *   :value 属性通道刷新不了用户已输入过的输入框，见该 composable 注释）；
 * - customStyle 经 parseStyle() 归一为对象后下发；
 * - 使用官方 search-line / close-circle-fill 图标，保留原始图形与尺寸；
 * - pause() 续写前经 useAlive() 判存活，避免卸载后晚到 patch（真机 9902）；
 * - 平台 options 块（virtualHost / styleIsolation / addGlobalClass）为
 *   小程序专有能力，Lynx 不需要，未声明。
 */
<script lang="ts" setup>
import './index.css'

import { computed, nextTick, onMounted, ref, watch } from 'vue-lynx'
import WdIcon from '../wd-icon/wd-icon.vue'
import { searchProps } from './types'
import { parseStyle } from '@wot-lynx/core/common/util'
import { useTranslate } from '@wot-lynx/core/composables/useTranslate'
import { useAlive } from '@wot-lynx/core/composables/useAlive'
import { useNativeInputValue } from '@wot-lynx/core/composables/useNativeInputValue'

const props = defineProps(searchProps)
const emit = defineEmits(['update:modelValue', 'change', 'clear', 'search', 'focus', 'blur', 'cancel', 'click'])
const isAlive = useAlive()

const { translate } = useTranslate('search')

const isFocused = ref<boolean>(false) // 是否聚焦中
const showInput = ref<boolean>(false) // 是否显示输入框 用于实现聚焦的hack
const inputValue = ref<string>('') // 输入框的值
/**
 * 原生输入框受控值同步（真机 setValue 通道）。
 *
 * 程序化改写 inputValue（清除 / 外部受控）必须经该通道推送，否则真机上
 * 输入框文本不刷新——清除图标就是因此「点了没反应」。Web 预览的属性
 * 通道全绿，该类缺陷只在真机暴露。
 */
const nativeInputVisible = computed(() => props.placeholderLeft || showInput.value || !!inputValue.value)
const { inputId, markNativeValue, setNativeFocus } = useNativeInputValue(inputValue, 'wd-search', () => nativeInputVisible.value)
const clearing = ref<boolean>(false)
let inputRequest = 0
let focusRequest = 0
let blurRequest = 0
watch(() => props.modelValue, (value) => {
  // Do not cancel a clear's intended refocus on its own v-model acknowledgement.
  if (value !== inputValue.value) { inputRequest++; focusRequest++ }
}, { flush: 'sync' })
watch(() => props.disabled, () => {
  inputRequest++; focusRequest++; blurRequest++; clearing.value = false
  if (props.disabled) {
    setNativeFocus(false)
    isFocused.value = false
  }
}, { flush: 'sync' })

watch(
  () => props.modelValue,
  (newValue) => {
    inputValue.value = newValue
    if (newValue) {
      showInput.value = true
    } else if (!isFocused.value && !clearing.value) {
      // 外部清空（如消费方复用同一 ref 的其它输入框写入空串）时复位输入框
      // 显隐：showInput 残留 true 会让封面占位与原生 input 同时在场——
      // 双份占位文字 + 图标叠印 + 输入块被撑高（真机 2026-10-25 巡检缺陷）。
      // 组件自身聚焦中或清空重聚焦流程不动（handleBlur / handleClear 各自管理）。
      showInput.value = false
    }
  },
  { immediate: true }
)

watch(
  () => props.focus,
  (newValue) => {
    if (newValue) {
      if (props.disabled) return
      closeCover()
    } else {
      hackFocus(false)
    }
  }
)

onMounted(() => {
  if (props.focus) {
    closeCover()
  }
})

const rootClass = computed(() => {
  const isLight = props.variant === 'light'
  const isPlain = props.variant === 'plain'
  return `wd-search ${isLight ? 'is-light' : ''} ${isPlain ? 'is-plain' : ''} ${props.hideCancel ? 'is-without-cancel' : ''} ${props.customClass}`
})

async function hackFocus(focus: boolean) {
  const request = ++focusRequest
  if (!focus) {
    // 原生 blur 必须在空值 input 卸载前发出；focus 属性并非原生契约。
    setNativeFocus(false)
    isFocused.value = false
    showInput.value = !!inputValue.value
    return
  }
  blurRequest++
  showInput.value = true
  // 只等节点真实挂载，不再人为等待 100ms + 一帧。
  await nextTick()
  if (!isAlive() || request !== focusRequest || props.disabled) return
  isFocused.value = true
  setNativeFocus(true)
}

function closeCover() {
  if (props.disabled) return
  clearing.value = false
  void hackFocus(true)
}

function handleInput(event: any) {
  if (props.disabled) return
  const value = String(event?.detail?.value ?? '')
  // Android setValue 会再发 input；同值回声不能取消 clear 或重复发 change。
  if (value === inputValue.value) {
    markNativeValue(value)
    return
  }
  inputRequest++
  inputValue.value = value
  markNativeValue(value)
  emit('update:modelValue', inputValue.value)
  emit('change', {
    value: inputValue.value
  })
}

async function handleClear() {
  if (props.disabled) return
  const request = ++inputRequest
  focusRequest++
  blurRequest++
  clearing.value = true
  inputValue.value = ''
  isFocused.value = false
  await nextTick()
  if (!isAlive()) return
  if (request !== inputRequest || props.disabled) { clearing.value = false; return }
  void hackFocus(props.focusWhenClear)
  emit('change', { value: '' })
  emit('update:modelValue', '')
  emit('clear')
  if (!props.focusWhenClear) clearing.value = false
}

function handleConfirm(event: any) {
  if (props.disabled) return
  emit('search', {
    value: event?.detail?.value ?? inputValue.value
  })
}

function handleFocus() {
  if (props.disabled) return
  blurRequest++
  clearing.value = false
  showInput.value = true
  isFocused.value = true
  emit('focus', {
    value: inputValue.value
  })
}

async function handleBlur() {
  const request = ++blurRequest
  // 延后一轮渲染让同次 clear / 新 focus 有机会取消旧 blur；不等待固定 150ms。
  await nextTick()
  if (!isAlive() || request !== blurRequest || clearing.value) return
  focusRequest++
  showInput.value = !!inputValue.value
  isFocused.value = false
  emit('blur', {
    value: inputValue.value
  })
}

function handleCancel() {
  // 取消必须同时失效待执行的 clear / focus，否则它们会在取消后重新弹键盘。
  inputRequest++
  focusRequest++
  blurRequest++
  setNativeFocus(false)
  clearing.value = false
  isFocused.value = false
  showInput.value = !!inputValue.value
  // API 仍只通知取消，不擅自清空 v-model；清空 / 退出搜索由消费方决定。
  emit('cancel', {
    value: inputValue.value
  })
}

function handleClick() {
  if (props.disabled) {
    emit('click')
  } else if (!clearing.value && !isFocused.value) {
    closeCover()
  }
}
</script>

<template>
  <view :class="rootClass" :style="parseStyle(customStyle)">
    <view class="wd-search__block" @tap="handleClick">
      <slot name="prefix"></slot>
      <view class="wd-search__field">
        <!-- 封面占位（真机 2026-10-26 R3 复测）：原条件依赖 showPlaceHolder，
             与 input 的 v-if 条件（showInput || inputValue）在状态切换的中间
             态下会同时为真 —— 真机上封面与原生 input 并存，出现双份占位文字
             + 图标叠印（图二缺陷）。改为与 input 严格互补的单一判据：
             showInput 为唯一显隐真源，两者永不同时挂载。 -->
        <view
          v-if="!placeholderLeft && !showInput && !inputValue"
          class="wd-search__cover"
          @tap="closeCover"
        >
          <WdIcon name="search-line" custom-class="wd-search__search-icon" :user-interaction-enabled="false"></WdIcon>
          <text :class="`wd-search__placeholder-txt ${placeholderClass}`" :user-interaction-enabled="false">{{ placeholder || translate('search') }}</text>
        </view>
        <WdIcon v-if="placeholderLeft || showInput || inputValue" name="search-line" custom-class="wd-search__search-left-icon"></WdIcon>
        <input
          v-if="placeholderLeft || showInput || inputValue"
          :id="inputId"
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
        <WdIcon v-if="inputValue" custom-class="wd-search__clear-icon" name="close-circle-fill" @tap="handleClear" />
        <slot name="input-suffix"></slot>
      </view>
    </view>

    <slot v-if="!hideCancel" name="suffix">
      <view class="wd-search__cancel" @tap="handleCancel">
        <text class="wd-search__cancel-text" :user-interaction-enabled="false">{{ cancelTxt || translate('cancel') }}</text>
      </view>
    </slot>
  </view>
</template>
