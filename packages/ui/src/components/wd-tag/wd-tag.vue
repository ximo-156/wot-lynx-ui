/*
 * wd-tag — 标签
 *
 * Lynx 实现说明（相对 wot-ui 2.3.2 的适配点）：
 * - 尺寸 / 类型 / 变体 / 圆角 / 标记的类名体系与参考源一致（is- 前缀加
 *   size / type / variant 取值，另加 is-round、is-mark），均继承全局配置
 *   （useGlobalConfig 的 tag.size / tag.variant / tag.round）；
 * - 事件映射（CONVENTIONS §6）：根 view 与关闭 / 新增按钮的 @click 一律改
 *   为 @tap，@click.stop 改为 @tap.stop；根 view 同时在 emits 声明 'tap'
 *   并转发原生事件（CONVENTIONS §14：消费方在组件上绑 @tap 不会落入合并
 *   崩溃）；
 * - dynamic 新增标签：参考源经 v-model 双向绑定原生 input，vue-lynx 运行时
 *   对原生元素不挂 vModel 指令，改为 :value 受控绑定 + @input 回写
 *   （语义与 v-model 一致，参照 wd-input / wd-search 的既有适配）；
 * - 根节点 / 文本节点样式：参考源为 objToStyle 字符串拼接，Lynx 的字符串
 *   style 会被静默丢弃（CONVENTIONS §19），改为对象语法并经 parseStyle
 *   归一 customStyle；
 * - 参考源 view 内的裸文本（{{ translate('add') }}）包进 text 元素
 *   （CONVENTIONS §4）；
 * - 参考源 e(input) 的 outline: none 为 Web 专有属性，按 PORTING §4.5 删除；
 * - plain / dashed 变体的描边：参考源经 ::after 伪元素绘制（Lynx 无伪元素，
 *   PORTING §4.4），改为主元素真实 border + box-sizing: border-box
 *   （本地 pixelBorderSurround mixin 已适配为原生 border）。
 */
<script lang="ts" setup>
import './index.css'

import { computed, ref } from 'vue-lynx'
import WdIcon from '../wd-icon/wd-icon.vue'
import { filterStyle, isString, isUndefined, parseStyle } from '../../common/util'
import { tagProps } from './types'
import { useTranslate } from '../../composables/useTranslate'
import { useGlobalConfig } from '../../composables/useGlobalConfig'

const props = defineProps(tagProps)
const emit = defineEmits(['click', 'close', 'confirm', 'tap'])

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
const rootStyle = computed<Record<string, string>>(() => {
  const rootStyle: Record<string, any> = {}
  if (effectiveVariant.value !== 'plain' && effectiveVariant.value !== 'dashed' && effectiveVariant.value !== 'text' && props.bgColor) {
    rootStyle['background'] = props.bgColor
  }
  if (props.bgColor) {
    rootStyle['border-color'] = props.bgColor
  }
  return { ...filterStyle(rootStyle), ...parseStyle(props.customStyle) }
})

/**
 * 文本样式
 */
const textStyle = computed<Record<string, string>>(() => {
  const textStyle: Record<string, any> = {}
  if (props.color) {
    textStyle['color'] = props.color
  }
  return filterStyle(textStyle)
})

/**
 * 处理点击事件
 * @param {any} event 事件对象
 * @returns {void}
 */
function handleClick(event: any) {
  emit('click', event)
  emit('tap', event)
}

/**
 * 处理关闭事件
 * @param {any} event 事件对象
 * @returns {void}
 */
function handleClose(event: any): void {
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
      @input="(e: any) => (dynamicValue = e.detail.value)"
      @blur="handleBlur"
      @confirm="handleConfirm"
    />
    <view v-else-if="dynamic" class="wd-tag__text" :style="textStyle" @tap.stop="handleAdd">
      <slot name="add">
        <wd-icon name="plus" custom-class="wd-tag__add" />
        <text>{{ translate('add') }}</text>
      </slot>
    </view>

    <template v-else>
      <slot name="icon" v-if="$slots.icon || hasIcon">
        <wd-icon :name="icon" :class-prefix="iconPrefix" :css-icon="cssIcon" custom-class="wd-tag__icon" />
      </slot>
      <view class="wd-tag__text" :style="textStyle" v-if="$slots.default">
        <slot />
      </view>
      <view class="wd-tag__close" v-if="closable" @tap.stop="handleClose">
        <wd-icon name="close" custom-class="wd-tag__close-icon"></wd-icon>
      </view>
    </template>
  </view>
</template>
