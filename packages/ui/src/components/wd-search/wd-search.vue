/*
 * wd-search — 搜索框
 *
 * 与 wot-ui 2.3.2 对齐；Lynx 适配点（相对参考源的差异）：
 * - 根节点三件套（NATIVE-REWRITE §3.1）：index.scss 显式声明
 *   display:flex + flex-direction:row + align-items:center，「输入块」与
 *   「取消按钮」横向排列且交叉轴居中；
 * - 未聚焦时显示「封面」占位（点击封面后才渲染 input 并聚焦，避免键盘
 *   抢焦）；聚焦/失焦/清空驱动封面显隐（showPlaceHolder + showInput）；
 * - @click → @tap（CONVENTIONS §6：Lynx view/图标只派发 tap）；
 * - coverStyle 参考源经 objToStyle 拼字符串，改为对象语法直接下发
 *   （CONVENTIONS §19：字符串 :style 会被静默丢弃）；display 键每帧都
 *   输出（'flex' / 'none'），无条件省略（CONVENTIONS §20 Style Funnel）；
 * - 原生 input 用 :value 受控绑定 + @input 回写（vue-lynx 运行时对原生
 *   元素不挂 vModel 指令），语义与参考源 v-model 一致；
 * - customStyle 经 parseStyle() 归一为对象后下发；
 * - 使用官方 search-line / close-circle-fill 图标，保留原始图形与尺寸；
 * - pause() 续写前经 useAlive() 判存活，避免卸载后晚到 patch（真机 9902）；
 * - 平台 options 块（virtualHost / styleIsolation / addGlobalClass）为
 *   小程序专有能力，Lynx 不需要，未声明。
 */
<script lang="ts" setup>
import './index.css'

import { computed, onMounted, ref, watch } from 'vue-lynx'
import WdIcon from '../wd-icon/wd-icon.vue'
import { searchProps } from './types'
import { pause, parseStyle } from '../../common/util'
import { useTranslate } from '../../composables/useTranslate'
import { useAlive } from '../../composables/useAlive'

const props = defineProps(searchProps)
const emit = defineEmits(['update:modelValue', 'change', 'clear', 'search', 'focus', 'blur', 'cancel', 'click'])
const isAlive = useAlive()

const { translate } = useTranslate('search')

const isFocused = ref<boolean>(false) // 是否聚焦中
const showInput = ref<boolean>(false) // 是否显示输入框 用于实现聚焦的hack
const inputValue = ref<string>('') // 输入框的值
const showPlaceHolder = ref<boolean>(true)
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
  if (props.disabled) isFocused.value = false
}, { flush: 'sync' })

watch(
  () => props.modelValue,
  (newValue) => {
    inputValue.value = newValue
    if (newValue) {
      showInput.value = true
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

// Lynx 适配：参考源经 objToStyle 拼字符串后绑 :style（字符串样式在
// vue-lynx 会被静默丢弃），改为对象语法；display 恒输出，避免残留
const coverStyle = computed<Record<string, string>>(() => {
  const coverStyle: Record<string, string> = {
    display: inputValue.value === '' && showPlaceHolder.value ? 'flex' : 'none'
  }

  return coverStyle
})

async function hackFocus(focus: boolean) {
  const request = ++focusRequest
  showInput.value = focus
  await pause()
  if (!isAlive() || request !== focusRequest || (focus && props.disabled)) return
  isFocused.value = focus
}

async function closeCover() {
  if (props.disabled) return
  const request = ++focusRequest
  await pause(100)
  if (!isAlive() || request !== focusRequest || props.disabled) return
  showPlaceHolder.value = false
  hackFocus(true)
}

function handleInput(event: any) {
  if (props.disabled) return
  inputRequest++
  // Lynx 适配：:value 受控绑定下用 detail.value 回写 inputValue
  //（参考源经 v-model 由运行时回写）
  inputValue.value = event.detail.value
  emit('update:modelValue', inputValue.value)
  emit('change', {
    value: inputValue.value
  })
}

async function handleClear() {
  if (props.disabled) return
  const request = ++inputRequest
  focusRequest++
  inputValue.value = ''
  if (props.focusWhenClear) {
    clearing.value = true
    isFocused.value = false
  }
  await pause()
  if (!isAlive()) return
  if (request !== inputRequest || props.disabled) { clearing.value = false; return }
  if (props.focusWhenClear) {
    showPlaceHolder.value = false
    hackFocus(true)
  } else {
    showPlaceHolder.value = true
    hackFocus(false)
  }
  emit('change', { value: '' })
  emit('update:modelValue', '')
  emit('clear')
}

function handleConfirm({ detail: { value } }: any) {
  if (props.disabled) return
  // 组件触发search事件
  emit('search', {
    value
  })
}

function handleFocus() {
  if (props.disabled) return
  blurRequest++
  showPlaceHolder.value = false
  emit('focus', {
    value: inputValue.value
  })
}

async function handleBlur() {
  const request = ++blurRequest
  focusRequest++
  // 等待150毫秒，clear执行完毕
  await pause(150)
  if (!isAlive() || request !== blurRequest) return
  if (clearing.value) {
    clearing.value = false
    return
  }
  // 组件触发blur事件
  showPlaceHolder.value = !inputValue.value
  showInput.value = !showPlaceHolder.value
  isFocused.value = false
  emit('blur', {
    value: inputValue.value
  })
}

function handleCancel() {
  focusRequest++
  emit('cancel', {
    value: inputValue.value
  })
}

function handleClick() {
  if (props.disabled) {
    emit('click')
  }
}
</script>

<template>
  <view :class="rootClass" :style="parseStyle(customStyle)">
    <view class="wd-search__block" @tap="handleClick">
      <slot name="prefix"></slot>
      <view class="wd-search__field">
        <view v-if="!placeholderLeft" :style="coverStyle" class="wd-search__cover" @tap="closeCover">
          <WdIcon name="search-line" custom-class="wd-search__search-icon"></WdIcon>
          <text :class="`wd-search__placeholder-txt ${placeholderClass}`">{{ placeholder || translate('search') }}</text>
        </view>
        <WdIcon v-if="showInput || inputValue || placeholderLeft" name="search-line" custom-class="wd-search__search-left-icon"></WdIcon>
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
        <WdIcon v-if="inputValue" custom-class="wd-search__clear-icon" name="close-circle-fill" @tap="handleClear" />
        <slot name="input-suffix"></slot>
      </view>
    </view>

    <slot v-if="!hideCancel" name="suffix">
      <view class="wd-search__cancel" @tap="handleCancel">
        <text>{{ cancelTxt || translate('cancel') }}</text>
      </view>
    </slot>
  </view>
</template>
