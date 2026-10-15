/*
 * wd-keyboard — 键盘
 *
 * Lynx 实现说明：
 * - 基于 wd-popup（bottom）；default / custom / car 三种模式；
 * - car 模式支持中英切换（省份简称键盘 / 数字字母键盘），
 *   autoSwitchLang 时输入首位后自动切英文；
 * - randomKeyOrder 打乱数字键序（安全键盘场景）。
 */
<script lang="ts" setup>
import './index.css'
import { parseStyle } from '../../common/util'

import { computed, ref, watch, useSlots } from 'vue-lynx'
import WdPopup from '../wd-popup/wd-popup.vue'
import WdKey from './key/index.vue'
import { keyboardProps, type CarKeyboardLang, type Key } from './types'
import type { NumberKeyType } from './key/types'
import { CAR_KEYBOARD_AREAS, CAR_KEYBOARD_KEYS } from './constants'

const props = defineProps(keyboardProps)
const emit = defineEmits(['update:visible', 'input', 'close', 'delete', 'update:modelValue', 'update:carLang'])
const slots = useSlots()

const show = ref(props.visible)
watch(
  () => props.visible,
  (newValue) => {
    show.value = newValue
  }
)

const carLang = ref<CarKeyboardLang>('zh')
const carKeyboardLang = computed({
  get: () => (props.carLang ? props.carLang : carLang.value),
  set: (value: CarKeyboardLang) => {
    carLang.value = value
  }
})

const keys = computed(() => (props.mode !== 'car' ? (props.mode === 'custom' ? genCustomKeys() : genDefaultKeys()) : genCarKeys()))

const showClose = computed(() => {
  return Boolean(props.closeText && (props.mode === 'default' || props.mode === 'car'))
})

const showTitle = computed(() => {
  return Boolean(props.title || slots.title)
})

const showHeader = computed(() => {
  return showTitle.value || showClose.value
})

function shuffleArray<T>(arr: T[]): T[] {
  const newArr = [...arr]
  for (let i = newArr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[newArr[i], newArr[j]] = [newArr[j], newArr[i]]
  }
  return newArr
}

function genBasicKeys(): Key[] {
  const keys = Array.from({ length: 9 }, (_, i) => ({ text: i + 1 }))
  return props.randomKeyOrder ? shuffleArray(keys) : keys
}

function genDefaultKeys(): Key[] {
  return [
    ...genBasicKeys(),
    { text: (props.extraKey as string) || '', type: 'extra' },
    { text: 0 },
    {
      text: props.showDeleteKey ? props.deleteText || '' : '',
      type: props.showDeleteKey ? 'delete' : ''
    }
  ]
}

function genCustomKeys(): Key[] {
  const keys = genBasicKeys()
  const extraKeys = (Array.isArray(props.extraKey) ? props.extraKey : [props.extraKey]).map((k) => k || '')
  if (extraKeys.length === 1) {
    keys.push({ text: 0, wider: true }, { text: extraKeys[0], type: 'extra' })
  } else if (extraKeys.length === 2) {
    keys.push({ text: extraKeys[0], type: 'extra' }, { text: 0 }, { text: extraKeys[1], type: 'extra' })
  }
  return keys
}

function genCarKeys(): Key[] {
  const [keys, remainKeys] = splitCarKeys()
  return [
    ...keys,
    { text: carKeyboardLang.value === 'zh' ? 'ABC' : '省份', type: 'extra', wider: true },
    ...remainKeys,
    { text: props.deleteText || '', type: 'delete', wider: true }
  ]
}

function splitCarKeys(): Array<Key[]> {
  const keys =
    carKeyboardLang.value === 'zh' ? CAR_KEYBOARD_AREAS.map((key) => ({ text: key })) : CAR_KEYBOARD_KEYS.map((key) => ({ text: key }))
  return [keys.slice(0, 30), keys.slice(30)]
}

function handleClose() {
  emit('close')
  emit('update:visible', false)
}

function handlePress(text: string, type: NumberKeyType) {
  if (type === 'extra') {
    if (text === '') {
      return handleClose()
    } else if (text === 'ABC' || text === '省份') {
      const newLang = carKeyboardLang.value === 'zh' ? 'en' : 'zh'
      if (props.carLang) {
        emit('update:carLang', newLang)
      } else {
        carKeyboardLang.value = newLang
      }
      return
    }
  }

  const value = props.modelValue
  if (type === 'delete') {
    emit('delete')
    const newValue = value.slice(0, value.length - 1)
    emit('update:modelValue', newValue)
    if (props.mode === 'car' && newValue.length === 0 && props.autoSwitchLang) {
      carKeyboardLang.value = 'zh'
    }
  } else if (type === 'close') {
    handleClose()
  } else if (value.length < Number(props.maxlength)) {
    emit('input', text)
    const newValue = value + text
    emit('update:modelValue', newValue)
    if (props.mode === 'car' && newValue.length === 1 && props.autoSwitchLang) {
      carKeyboardLang.value = 'en'
    }
  }
}
</script>

<template>
  <wd-popup
    v-model="show"
    position="bottom"
    :z-index="zIndex"
    :safe-area-inset-bottom="safeAreaInsetBottom"
    :modal-style="modal ? '' : 'opacity: 0;'"
    :modal="hideOnClickOutside"
    :lock-scroll="lockScroll"
    :root-portal="rootPortal"
    @click-modal="handleClose"
  >
    <view :class="`wd-keyboard ${customClass}`" :style="parseStyle(customStyle)">
      <view v-if="showHeader" class="wd-keyboard__header">
        <slot v-if="showTitle" name="title">
          <text class="wd-keyboard__title">{{ title }}</text>
        </slot>
        <view v-if="showClose" class="wd-keyboard__close" @tap="handleClose">
          <text>{{ closeText }}</text>
        </view>
      </view>
      <template v-if="mode !== 'car'">
        <view class="wd-keyboard__body">
          <view class="wd-keyboard__keys">
            <wd-key v-for="(key, keyIndex) in keys" :key="`${key.type}-${key.text}-${keyIndex}`" :text="key.text" :type="key.type" :wider="key.wider" @press="handlePress" />
          </view>
          <view v-if="mode === 'custom'" class="wd-keyboard__sidebar">
            <wd-key v-if="showDeleteKey" large :text="deleteText" type="delete" @press="handlePress" />
            <wd-key large :text="closeText" type="close" :loading="closeButtonLoading" @press="handlePress" />
          </view>
        </view>
      </template>
      <template v-else>
        <view class="wd-keyboard__body">
          <view class="wd-keyboard__keys">
            <wd-key v-for="(key, keyIndex) in keys" :key="`${key.type}-${key.text}-${keyIndex}`" :text="key.text" :type="key.type" :wider="key.wider" is-car @press="handlePress" />
          </view>
        </view>
      </template>
    </view>
  </wd-popup>
</template>
