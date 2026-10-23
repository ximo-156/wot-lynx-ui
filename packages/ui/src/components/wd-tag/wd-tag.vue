/*
 * wd-tag — 标签
 * 保留官方类型、变体、尺寸、插槽与事件契约，Lynx tap 映射 click。
 * 动态输入显式回写 value；plain/dashed 描边使用不参与排版的真实覆盖层。
 */
<script lang="ts" setup>
import './index.css'

import { computed, ref } from 'vue-lynx'
import WdIcon from '../../primitives/wd-icon/wd-icon.vue'
import { isString, isUndefined, parseStyle } from '../../common/util'
import { defineStyleKeys, resolveStyle } from '../../common/style'
import { tagProps } from './types'
import { useTranslate } from '../../composables/useTranslate'
import { useGlobalConfig } from '../../composables/useGlobalConfig'

const props = defineProps(tagProps)
const emit = defineEmits(['click', 'close', 'confirm', 'tap'])
const { translate } = useTranslate('tag')
const globalConfig = useGlobalConfig()
const hasIcon = computed(() => Boolean(props.icon || (isString(props.cssIcon) && props.cssIcon)))
const effectiveSize = computed(() => props.size || globalConfig.value.tag?.size || 'default')
const effectiveVariant = computed(() => props.variant || globalConfig.value.tag?.variant || 'dark')
const effectiveRound = computed(() => isUndefined(props.round) ? (globalConfig.value.tag?.round ?? false) : props.round)
const dynamicValue = ref('')
const dynamicInput = ref(false)
const outlined = computed(() => effectiveVariant.value === 'plain' || effectiveVariant.value === 'dashed')
const rootClass = computed(() => ['wd-tag', props.customClass, `is-${props.type}`, `is-${effectiveVariant.value}`, `is-${effectiveSize.value}`, {
  'is-round': effectiveRound.value,
  'is-mark': props.mark
}])
const TAG_STYLE = defineStyleKeys({ background: '', 'border-color': '' })
const rootStyle = computed(() => resolveStyle(TAG_STYLE, {
  background: !outlined.value && effectiveVariant.value !== 'text' ? props.bgColor : '',
  'border-color': props.bgColor
}, parseStyle(props.customStyle)))
const textStyle = computed(() => ({ color: props.color || '' }))
const BORDER_STYLE = defineStyleKeys({ 'border-color': '' })
const borderStyle = computed(() => {
  const custom = parseStyle(props.customStyle)
  return resolveStyle(BORDER_STYLE, { 'border-color': custom.borderColor || custom['border-color'] || props.bgColor })
})
function handleClick(event: any) { emit('click', event); emit('tap', event) }
function handleClose(event: any) { emit('close', event) }
function handleAdd() { dynamicInput.value = true; dynamicValue.value = '' }
function handleBlur() { dynamicInput.value = false }
function handleInput(event: any) { dynamicValue.value = event.detail?.value ?? '' }
function handleConfirm(event: any) {
  dynamicInput.value = false
  emit('confirm', { value: event.detail?.value ?? dynamicValue.value })
}
</script>

<template>
  <view :class="rootClass" :style="rootStyle" @tap="handleClick">
    <input
      v-if="dynamicInput && dynamic"
      class="wd-tag__input"
      :value="dynamicValue"
      :placeholder="translate('placeholder')"
      placeholder-class="wd-tag__placeholder"
      type="text"
      :focus="true"
      @input="handleInput"
      @blur="handleBlur"
      @confirm="handleConfirm"
    />
    <view v-else-if="dynamic" class="wd-tag__text" :style="textStyle" @tap.stop="handleAdd">
      <slot name="add">
        <WdIcon name="plus" custom-class="wd-tag__add" />
        <text text-maxline="1">{{ translate('add') }}</text>
      </slot>
    </view>
    <template v-else>
      <slot name="icon" v-if="$slots.icon || hasIcon">
        <WdIcon :name="icon" :class-prefix="iconPrefix" :css-icon="cssIcon" custom-class="wd-tag__icon" />
      </slot>
      <view v-if="$slots.default" class="wd-tag__text" :style="textStyle"><slot /></view>
      <view v-if="closable" class="wd-tag__close" @tap.stop="handleClose">
        <WdIcon name="close" custom-class="wd-tag__close-icon" />
      </view>
    </template>
    <view v-if="outlined" class="wd-tag__border" :style="borderStyle" />
  </view>
</template>
