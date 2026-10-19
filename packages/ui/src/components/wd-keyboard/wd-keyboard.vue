/*
 * wd-keyboard — 键盘
 *
 * Lynx 实现说明（相对 wot-ui 的适配点）：
 * - 基于 wd-popup（bottom）；default / custom / car 三种模式；
 * - car 模式支持中英切换（省份简称键盘 / 数字字母键盘），
 *   autoSwitchLang 时输入首位后自动切英文；
 * - 交互为按键点击（touchstart/touchend 判定 press），无拖动/滑动/缩放
 *   跟手手势，不涉及 MTS（NATIVE-REWRITE §2 仅约束跟手交互类组件）；
 *   按键按压态由 touch 事件驱动的 wd-key--active 类切换（滑动可取消，
 *   CSS :active 无法表达「滑出按键即取消」，与 wot-ui 语义一致）；
 * - 布局居中（NATIVE-REWRITE §3）：根节点显式 display: flex +
 *   flex-direction: column（纵向「头部 + 键区」）；__header 为
 *   justify-content + align-items 成对的居中行；__body / __keys /
 *   __car-keys 为 flex-direction: row 的按键行（wrap 网格基准见
 *   test/keyboard-layout.test.ts 锁定的 CSS 契约）；__sidebar 为
 *   flex-direction: column 的侧栏列；
 * - wot-ui 的 hover-class="wd-keyboard__close--hover" 按压态改用 CSS
 *   :active 伪类（CONVENTIONS §17）；
 * - wot-ui 用相邻兄弟选择器 `.wd-keyboard__header + .wd-keyboard__body`
 *   取消有头部时的上内边距，Lynx 不支持，改为模板按 showHeader 下发的
 *   is-with-header 类名（见 index.scss）；
 * - customStyle 为字符串，经 parseStyle 归一为对象后绑定（CONVENTIONS §19）。
 */
<script lang="ts" setup>
import './index.css'

import { computed, ref, watch, useSlots } from 'vue-lynx'
import WdPopup from '../wd-popup/wd-popup.vue'
import WdKey from './key/index.vue'
import { keyboardProps, type CarKeyboardLang, type Key } from './types'
import type { NumberKeyType } from './key/types'
import { parseStyle } from '../../common/util'
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
  return props.closeText && (props.mode === 'default' || props.mode === 'car')
})

const showTitle = computed(() => {
  return !!props.title || !!slots.title
})

const showHeader = computed(() => {
  return showTitle.value || showClose.value
})

/**
 * 随机打乱数组的顺序
 * @param {T[]} arr 要打乱顺序的数组
 * @returns {T[]} 打乱顺序后的数组
 */
function shuffleArray<T>(arr: T[]): T[] {
  const newArr = [...arr]
  for (let i = newArr.length - 1; i > 0; i--) {
    // 生成一个随机索引 j，范围是 [0, i]
    const j = Math.floor(Math.random() * (i + 1))

    // 交换索引 i 和 j 处的元素
    ;[newArr[i], newArr[j]] = [newArr[j], newArr[i]]
  }
  return newArr
}

/**
 * 生成基础按键（1-9）
 * @returns {Key[]} 基础按键数组
 */
function genBasicKeys(): Key[] {
  const keys = Array.from({ length: 9 }, (_, i) => ({ text: i + 1 }))

  // 如果需要随机顺序，则调用 shuffleArray 方法打乱数组顺序
  return props.randomKeyOrder ? shuffleArray(keys) : keys
}

/**
 * 生成默认键盘按键
 * @returns {Key[]} 默认键盘按键数组
 */
function genDefaultKeys(): Key[] {
  return [
    ...genBasicKeys(),
    { text: props.extraKey as string, type: 'extra' },
    { text: 0 },
    {
      // 根据条件是否显示删除键的文本和类型
      text: props.showDeleteKey ? props.deleteText : '',
      type: props.showDeleteKey ? 'delete' : ''
    }
  ]
}

/**
 * 生成自定义键盘按键
 * @returns {Key[]} 自定义键盘按键数组
 */
function genCustomKeys(): Key[] {
  const keys = genBasicKeys()
  const extraKeys = Array.isArray(props.extraKey) ? props.extraKey : [props.extraKey]
  if (extraKeys.length === 1) {
    // 如果只有一个额外按键，则添加一个宽度较大的数字0和一个额外按键
    keys.push({ text: 0, wider: true }, { text: extraKeys[0], type: 'extra' })
  } else if (extraKeys.length === 2) {
    // 如果有两个额外按键，则添加两个额外按键和一个数字0
    keys.push({ text: extraKeys[0], type: 'extra' }, { text: 0 }, { text: extraKeys[1], type: 'extra' })
  }

  return keys
}

/**
 * 生成车牌键盘按键
 * @returns {Array<Key>} 车牌键盘按键数组
 */
function genCarKeys(): Array<Key> {
  const [keys, remainKeys] = splitCarKeys()
  return [
    ...keys,
    { text: carKeyboardLang.value === 'zh' ? 'ABC' : '省份', type: 'extra', wider: true },
    ...remainKeys,
    { text: props.deleteText, type: 'delete', wider: true }
  ]
}

/**
 * 分割车牌键盘按键
 * @returns {Array<Array<Key>>} 分割后的按键数组
 */
function splitCarKeys(): Array<Array<Key>> {
  const keys = carKeyboardLang.value === 'zh' ? CAR_KEYBOARD_AREAS.map((key) => ({ text: key })) : CAR_KEYBOARD_KEYS.map((key) => ({ text: key }))
  return [keys.slice(0, 30), keys.slice(30)]
}

/**
 * 处理关闭事件
 */
const handleClose = () => {
  emit('close')
  emit('update:visible', false)
}

/**
 * 处理按键点击事件
 * @param {string} text 按键文本
 * @param {NumberKeyType} type 按键类型
 */
const handlePress = (text: string, type: NumberKeyType) => {
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

  // Vue 只对 undefined 应用 prop 默认值，显式传入的 null 不套用：
  // 直接对 null 调用 slice/length 会抛未捕获 TypeError，故入口统一归一。
  const value = String(props.modelValue ?? '')
  if (type === 'delete') {
    emit('delete')
    const newValue = value.slice(0, value.length - 1)
    emit('update:modelValue', newValue)
    if (props.mode === 'car' && newValue.length === 0 && props.autoSwitchLang) {
      carKeyboardLang.value = 'zh'
    }
  } else if (type === 'close') {
    handleClose()
  } else if (value.length < +props.maxlength) {
    emit('input', text)
    const newValue = value + text
    emit('update:modelValue', newValue)
    if (props.mode === 'car' && newValue.length === 1 && props.autoSwitchLang) {
      // 输入第一位（省份）后，自动切换到英文
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
        <view :class="`wd-keyboard__body ${showHeader ? 'is-with-header' : ''}`">
          <view class="wd-keyboard__keys">
            <wd-key v-for="key in keys" :key="key.text" :text="key.text" :type="key.type" :wider="key.wider" @press="handlePress" />
          </view>
          <view v-if="mode === 'custom'" class="wd-keyboard__sidebar">
            <wd-key v-if="showDeleteKey" large :text="deleteText" type="delete" @press="handlePress" />
            <wd-key large :text="closeText" type="close" :loading="closeButtonLoading" @press="handlePress" />
          </view>
        </view>
      </template>
      <template v-else>
        <view :class="`wd-keyboard__body ${showHeader ? 'is-with-header' : ''}`">
          <view class="wd-keyboard__car-keys">
            <wd-key v-for="key in keys" :key="key.text" :text="key.text" :type="key.type" :wider="key.wider" is-car @press="handlePress" />
          </view>
        </view>
      </template>
    </view>
  </wd-popup>
</template>
