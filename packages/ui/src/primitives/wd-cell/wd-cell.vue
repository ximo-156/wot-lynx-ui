/*
 * wd-cell — 单元格
 *
 * Lynx 使用 tap 转发官方无参数 click；路由由宿主原生模块执行，宿主未注册
 * 路由能力时回退为 `navigate` 事件（由应用自己用原生导航处理）。
 * 真实分割线元素保留官方左右缩进；文本必须由 text 元素承载。
 * 标题宽度清除时显式下发空值，避免 Lynx 合并样式残留。
 */
<script lang="ts" setup>
import './index.css'

import { computed, useSlots } from 'vue-lynx'
import WdIcon from '../wd-icon/wd-icon.vue'
import { cellProps } from './types'
import { useCell } from '../../composables/useCell'
import { addUnit, isDef, parseStyle, type CSSProperties } from '../../common/util'
import { defineStyleKeys, resolveStyle } from '../../common/style'
import { WdTextSlot } from '../../common/textSlot'
import { getHost } from '../../common/host'

const props = defineProps(cellProps)
const emit = defineEmits<{
  (e: 'click'): void
  (e: 'tap', event: any): void
  (e: 'navigate', payload: { url: string; replace: boolean }): void
}>()
const slots = useSlots()
const cell = useCell()
const isBorder = computed(() => Boolean(isDef(props.border) ? props.border : cell.border.value))
const isCenter = computed(() => isDef(props.center) ? props.center : cell.center.value)
const cellSize = computed(() => isDef(props.size) ? props.size : cell.size.value)
const cellTitleWidth = computed(() => isDef(props.titleWidth) ? props.titleWidth : cell.titleWidth.value)
const cellLayout = computed(() => isDef(props.layout) ? props.layout : cell.layout.value || 'horizontal')
const cellValueAlign = computed(() => isDef(props.valueAlign) ? props.valueAlign : cell.valueAlign.value || 'right')
const showLeft = computed(() => slots.prefix || props.prefixIcon || (slots.title && props.useTitleSlot) || props.title || (slots.label && props.useLabelSlot) || props.label)
const showTitle = computed(() => (props.useTitleSlot && slots.title) || props.title || (props.useLabelSlot && slots.label) || props.label)
const showPlaceholder = computed(() => Boolean(props.placeholder && (props.value === '' || props.value == null) && !slots.default))
const TITLE_STYLE = defineStyleKeys({ minWidth: '', maxWidth: '' })
const titleWidthStyle = computed<CSSProperties>(() => {
  const width = cellTitleWidth.value ? addUnit(cellTitleWidth.value) : ''
  return resolveStyle(TITLE_STYLE, { minWidth: width, maxWidth: width })
})
const rootClass = computed(() => [
  'wd-cell', isBorder.value ? 'is-border' : '', cellSize.value ? `is-${cellSize.value}` : '',
  isCenter.value ? 'is-center' : '', props.isLink || props.clickable ? 'is-hover' : '', props.customClass
])
function onClick(event: any) {
  if (props.clickable || props.isLink) {
    emit('click')
    emit('tap', event)
  }
  if (props.to && props.isLink) {
    const host = getHost()
    const navigate = props.replace ? host.redirectTo : host.navigateTo
    if (typeof navigate === 'function') navigate({ url: props.to })
    else emit('navigate', { url: props.to, replace: props.replace })
  }
}
</script>

<template>
  <view :class="rootClass" :style="parseStyle(customStyle)" @tap="onClick">
    <view :class="`wd-cell__wrapper wd-cell__wrapper--${cellLayout}`">
      <view v-if="showLeft" class="wd-cell__left" :style="titleWidthStyle">
        <text v-if="required && !hideAsterisk && asteriskPosition === 'start'" class="wd-cell__required wd-cell__required--left">*</text>
        <slot name="prefix">
          <WdIcon v-if="prefixIcon" :name="prefixIcon" :size="iconSize" :class-prefix="iconPrefix" :css-icon="cssIcon" :custom-class="`wd-cell__prefix ${customPrefixClass}`" />
        </slot>
        <view v-if="showTitle" class="wd-cell__title">
          <WdTextSlot v-if="useTitleSlot && $slots.title" text-class="wd-cell__title-text"><slot name="title" /></WdTextSlot>
          <text v-else-if="title" :class="['wd-cell__title-text', customTitleClass]">{{ title }}</text>
          <WdTextSlot v-if="useLabelSlot && $slots.label" text-class="wd-cell__label-text"><slot name="label" /></WdTextSlot>
          <view v-else-if="label" :class="`wd-cell__label ${customLabelClass}`"><text class="wd-cell__label-text">{{ label }}</text></view>
        </view>
        <text v-if="required && !hideAsterisk && asteriskPosition === 'end'" class="wd-cell__required">*</text>
      </view>
      <view class="wd-cell__right">
        <view class="wd-cell__body">
          <view :class="`wd-cell__value ${customValueClass} wd-cell__value--${cellValueAlign} ${ellipsis ? 'wd-cell__value--ellipsis' : ''} ${showPlaceholder ? 'wd-cell__placeholder' : ''}`">
            <WdTextSlot text-class="wd-cell__value-text" :text-maxline="ellipsis ? 1 : undefined">
              <slot><text class="wd-cell__value-text" :text-maxline="ellipsis ? 1 : undefined">{{ showPlaceholder ? placeholder : value }}</text></slot>
            </WdTextSlot>
          </view>
          <WdIcon v-if="isLink" custom-class="wd-cell__arrow-right" :name="arrowDirection" :class-prefix="iconPrefix" />
          <slot v-else name="suffix">
            <WdIcon v-if="suffixIcon" :name="suffixIcon" :size="iconSize" :class-prefix="iconPrefix" :css-icon="cssIcon" :custom-class="`wd-cell__suffix ${customSuffixClass}`" />
          </slot>
        </view>
      </view>
    </view>
    <view v-if="isBorder" class="wd-cell__border" />
  </view>
</template>
