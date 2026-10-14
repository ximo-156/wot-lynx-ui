<template>
  <view :class="rootClass" :style="styleToObject(rootStyle)" @tap="handleClick">
    <input
      v-if="dynamicInput && dynamic"
      class="wd-tag__input"
      :placeholder="translate('placeholder')"
      placeholder-class="wd-tag__placeholder"
      type="text"
      :focus="true"
      v-model="dynamicValue"
      @blur="handleBlur"
      @confirm="handleConfirm"
    />
    <view v-else-if="dynamic" class="wd-tag__text" :style="styleToObject(textStyle)" @tap.stop="handleAdd">
      <slot name="add">
        <WdIcon name="plus" custom-class="wd-tag__add" :color="iconColor" />
        <text>{{ translate('add') }}</text>
      </slot>
    </view>

    <template v-else>
      <slot name="icon" v-if="$slots.icon || hasIcon">
        <WdIcon :name="icon" :class-prefix="iconPrefix" :css-icon="cssIcon" custom-class="wd-tag__icon" :color="iconColor" />
      </slot>
      <view class="wd-tag__text" :style="styleToObject(textStyle)" v-if="$slots.default">
        <slot />
      </view>
      <view class="wd-tag__close" v-if="closable" @tap.stop="handleClose">
        <WdIcon name="close" custom-class="wd-tag__close-icon" :color="iconColor"></WdIcon>
      </view>
    </template>
  </view>
</template>

<script setup lang="ts">
import './index.css'
import WdIcon from '../wd-icon/wd-icon.vue'
import { BLUE, GREEN, RED, ORANGE, WHITE, COOLGREY } from '../../common/theme'

/** 标签图标色：Lynx 的 wd-icon SVG 不吃 CSS currentColor，按变体与类型显式解析
 *  （dark 变体为白字白图标，light 变体为类型色，与 index.scss 文字色一致） */
const iconColor = computed(() => {
  if (effectiveVariant.value !== 'dark') {
    switch (props.type) {
      case 'success':
        return GREEN[6]
      case 'danger':
        return RED[6]
      case 'warning':
        return ORANGE[6]
      case 'default':
        return COOLGREY[8]
      default:
        return BLUE[6]
    }
  }
  return WHITE
})
import { styleToObject, objToStyle, isString, isUndefined } from '../../common/util'
import { computed, ref } from 'vue-lynx'
import { useTranslate } from '../../composables/useTranslate'
import { tagProps } from './types'
import { useGlobalConfig } from '../../composables/useGlobalConfig'

const props = defineProps(tagProps)
const emit = defineEmits(['click', 'close', 'confirm'])

const { translate } = useTranslate('tag')
const globalConfig = useGlobalConfig()

const hasIcon = computed(() => Boolean(props.icon || (isString(props.cssIcon) && props.cssIcon)))

const effectiveSize = computed(() => {
  return props.size || globalConfig.value.tag?.size || 'default'
})

const effectiveVariant = computed(() => {
  return props.variant || globalConfig.value.tag?.variant || 'dark'
})

const effectiveRound = computed(() => {
  if (isUndefined(props.round)) {
    return isUndefined(globalConfig.value.tag?.round) ? false : globalConfig.value.tag?.round
  }
  return props.round
})

const dynamicValue = ref<string>('')
const dynamicInput = ref<boolean>(false)

/**
 * 根节点类名
 */
const rootClass = computed<string>(() => {
  const { type, mark, customClass } = props
  const classList: string[] = []
  type && classList.push(`is-${type}`)
  effectiveVariant.value && classList.push(`is-${effectiveVariant.value}`)
  effectiveSize.value && classList.push(`is-${effectiveSize.value}`)
  effectiveRound.value && classList.push('is-round')
  mark && classList.push('is-mark')
  return `wd-tag ${customClass} ${classList.join(' ')}`
})

/**
 * 根节点样式
 */
const rootStyle = computed<string>(() => {
  const rootStyle: Record<string, any> = {}
  if (effectiveVariant.value !== 'plain' && effectiveVariant.value !== 'dashed' && effectiveVariant.value !== 'text' && props.bgColor) {
    rootStyle['background'] = props.bgColor
  }
  if (props.bgColor) {
    rootStyle['border-color'] = props.bgColor
  }
  return `${objToStyle(rootStyle)}${props.customStyle}`
})

/**
 * 文本样式
 */
const textStyle = computed<string>(() => {
  const textStyle: Record<string, any> = {}
  if (props.color) {
    textStyle['color'] = props.color
  }
  return objToStyle(textStyle)
})

/**
 * 处理点击事件
 * @param {MouseEvent} event 鼠标事件对象
 * @returns {void}
 */
function handleClick(event: MouseEvent) {
  emit('click', event)
}

/**
 * 处理关闭事件
 * @param {MouseEvent} event 鼠标事件对象
 * @returns {void}
 */
function handleClose(event: MouseEvent): void {
  emit('close', event)
}

/**
 * 处理添加事件
 * @returns {void}
 */
function handleAdd(): void {
  dynamicInput.value = true
  dynamicValue.value = ''
}

/**
 * 处理输入框失焦事件
 * @returns {void}
 */
function handleBlur(): void {
  setDynamicInput()
}

/**
 * 处理输入完成事件
 * @param {any} event 回车或完成事件对象
 * @returns {void}
 */
function handleConfirm(event: any): void {
  setDynamicInput()
  emit('confirm', {
    value: event.detail.value
  })
}

/**
 * 重置动态输入框状态
 * @returns {void}
 */
function setDynamicInput() {
  dynamicInput.value = false
}
</script>
