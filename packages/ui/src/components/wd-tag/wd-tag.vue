/*
 * wd-tag — 标签
 *
 * Lynx 实现说明：
 * - 类型色经组件私有令牌（--wd-tag-*）映射，扩展色（volcano/cyan 等）
 *   在样式中定义；
 * - dynamic 模式经原生 input 新增（:value + @input，避免运行时 vModel 指令）；
 * - 关闭经 @tap + stop。
 */
<script lang="ts" setup>
import './index.css'
import { filterStyle, parseStyle } from '../../common/util'

import { computed, ref } from 'vue-lynx'
import WdIcon from '../wd-icon/wd-icon.vue'
import { tagProps, type TagSize, type TagType, type TagVariant } from './types'
import { useTranslate } from '../../composables/useTranslate'

const props = defineProps(tagProps)
const emit = defineEmits(['click', 'close', 'confirm', 'add', 'tap'])

const { translate } = useTranslate('tag')

const dynamicValue = ref<string>('')
const adding = ref<boolean>(false)
const hasIcon = computed(() => Boolean(props.icon || props.cssIcon))

const rootClass = computed(() => {
  const classes = ['wd-tag', `is-${props.type}`, `is-${props.variant}`]
  if (props.round) classes.push('is-round')
  if (props.disabled) classes.push('is-disabled')
  if (props.size) classes.push(`is-${props.size}`)
  if (props.customClass) classes.push(props.customClass)
  return classes.join(' ')
})

const rootStyle = computed(() => {
  const style: Record<string, string> = {}
  if (props.color) style.color = props.color
  if (props.bgColor) style['background-color'] = props.bgColor
  return { ...filterStyle(style), ...parseStyle(props.customStyle) }
})

const textStyle = computed(() => {
  const style: Record<string, string> = {}
  if (props.color) style.color = props.color
  return filterStyle(style)
})

function handleClick() {
  if (props.disabled) return
  emit('click')
  emit('tap')
}

function handleClose() {
  emit('close')
}

function handleAdd() {
  // 禁用态守卫：禁用时点击"+"不弹出输入框、不 emit（与根节点 handleClick 一致）
  if (props.disabled) return
  adding.value = true
  emit('add')
}

function handleBlur() {
  submit()
}

function handleConfirm() {
  submit()
}

function submit() {
  const value = dynamicValue.value.trim()
  if (value) {
    // confirm 载荷与 wot-ui 一致：{ value } 对象而非裸字符串
    emit('confirm', { value })
  }
  dynamicValue.value = ''
  adding.value = false
}
</script>

<template>
  <view :class="rootClass" :style="rootStyle" @tap="handleClick">
    <input
      v-if="dynamic && adding"
      class="wd-tag__input"
      :value="dynamicValue"
      :placeholder="translate('placeholder')"
      placeholder-class="wd-tag__placeholder"
      type="text"
      :focus="true"
      @input="(e: any) => (dynamicValue = e.detail.value)"
      @blur="handleBlur"
      @confirm="handleConfirm"
    />
    <view v-else-if="dynamic" class="wd-tag__text" :style="textStyle" @tap.stop="handleAdd">
      <slot name="add">
        <wd-icon name="add" custom-class="wd-tag__add" />
        <text>{{ translate('add') }}</text>
      </slot>
    </view>
    <template v-else>
      <slot name="icon" v-if="$slots.icon || hasIcon">
        <wd-icon :name="icon" :class-prefix="iconPrefix" :css-icon="cssIcon" custom-class="wd-tag__icon" />
      </slot>
      <view v-if="$slots.default" class="wd-tag__text" :style="textStyle">
        <slot />
      </view>
      <view v-if="closable" class="wd-tag__close" @tap.stop="handleClose">
        <wd-icon name="close" custom-class="wd-tag__close-icon" />
      </view>
    </template>
  </view>
</template>
