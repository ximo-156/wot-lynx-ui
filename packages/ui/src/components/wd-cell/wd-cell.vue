/*
 * wd-cell — 单元格
 *
 * Lynx 实现说明：
 * - 点击经 @tap 捕获后 emit 'click'；页面跳转经 common/uni 兼容层
 *   下发（宿主可注入路由，未注入时降级）；
 * - 分组共享配置（border/center/size/titleWidth/layout/valueAlign）
 *   经 useCell 从 wd-cell-group 读取，组件自身 props 优先；
 * - 按压缩态用 :active（is-link / clickable 时）；
 * - 分组分割线用原生 border-top + 1ppx（首块无线，见 is-border）。
 */
<script lang="ts" setup>
import './index.css'

import { computed, useSlots } from 'vue-lynx'
import WdIcon from '../wd-icon/wd-icon.vue'
import { cellProps } from './types'
import { useCell } from '../../composables/useCell'
import { addUnit, isDef, parseStyle } from '../../common/util'
import { uni } from '../../common/uni'

const props = defineProps(cellProps)
const emit = defineEmits<{
  (e: 'click'): void
  (e: 'tap'): void
}>()

const slots = useSlots()
const cell = useCell()

const isBorder = computed(() => {
  return Boolean(isDef(props.border) ? props.border : cell.border.value)
})

const isCenter = computed(() => {
  return isDef(props.center) ? props.center : cell.center?.value
})

const cellSize = computed(() => {
  return isDef(props.size) ? props.size : cell.size?.value
})

const cellTitleWidth = computed(() => {
  return isDef(props.titleWidth) ? props.titleWidth : cell.titleWidth?.value
})

const cellLayout = computed(() => {
  return isDef(props.layout) ? props.layout : cell.layout?.value || 'horizontal'
})

const cellValueAlign = computed(() => {
  return isDef(props.valueAlign) ? props.valueAlign : cell.valueAlign?.value || 'right'
})

/** is-link 箭头图标：arrowDirection（left/up/down/right）映射到内置图标名字形 */
const arrowIcon = computed(() => {
  const map: Record<string, string> = {
    left: 'arrow-left-bold',
    up: 'arrow-up-bold',
    down: 'arrow-down-bold',
    right: 'arrow-right-bold'
  }
  return map[props.arrowDirection] || 'arrow-right-bold'
})

const showLeft = computed(() => {
  const hasPrefix = slots.prefix || props.prefixIcon
  const hasTitle = (slots.title && props.useTitleSlot) || props.title
  const hasLabel = (slots.label && props.useLabelSlot) || props.label
  return Boolean(hasPrefix || hasTitle || hasLabel)
})

const showTitle = computed(() => {
  return Boolean((props.useTitleSlot && slots.title) || props.title || (props.useLabelSlot && slots.label) || props.label)
})

const showPlaceholder = computed(() => {
  return Boolean(props.placeholder && (props.value === '' || props.value === undefined || props.value === null) && !slots.default)
})

const titleWidthStyle = computed<Record<string, string>>(() => {
  if (!isDef(cellTitleWidth.value)) return {}
  const width = addUnit(cellTitleWidth.value as string | number)
  return { 'min-width': width, 'max-width': width } as Record<string, string>
})

const rootClass = computed(() => {
  const classes = ['wd-cell']
  if (isBorder.value) classes.push('is-border')
  if (cellSize.value) classes.push(`is-${cellSize.value}`)
  if (isCenter.value) classes.push('is-center')
  if (props.isLink) classes.push('is-link')
  if (props.clickable) classes.push('is-clickable')
  if (props.customClass) classes.push(props.customClass)
  return classes
})

function onClick() {
  const url = props.to

  if (props.clickable || props.isLink) {
    emit('click')
    emit('tap')
  }
  if (url && props.isLink) {
    if (props.replace) {
      uni.redirectTo({ url })
    } else {
      uni.navigateTo({ url })
    }
  }
}
</script>

<template>
  <view :class="rootClass" :style="parseStyle(customStyle)" @tap="onClick">
    <view :class="`wd-cell__wrapper wd-cell__wrapper--${cellLayout}`">
      <view v-if="showLeft" class="wd-cell__left" :style="titleWidthStyle">
        <text v-if="required && !hideAsterisk && asteriskPosition === 'start'" class="wd-cell__required wd-cell__required--left">*</text>
        <slot name="prefix">
          <wd-icon
            v-if="prefixIcon"
            :name="prefixIcon"
            :size="iconSize"
            :class-prefix="iconPrefix"
            :css-icon="cssIcon"
            :custom-class="`wd-cell__prefix ${customPrefixClass}`"
          />
        </slot>
        <view v-if="showTitle" class="wd-cell__title">
          <slot v-if="useTitleSlot && $slots.title" name="title" />
          <text v-else-if="title" :class="customTitleClass">{{ title }}</text>
          <slot v-if="useLabelSlot && $slots.label" name="label" />
          <view v-else-if="label" :class="`wd-cell__label ${customLabelClass}`">{{ label }}</view>
        </view>
        <text v-if="required && !hideAsterisk && asteriskPosition === 'end'" class="wd-cell__required">*</text>
      </view>
      <view class="wd-cell__right">
        <view class="wd-cell__body">
          <view
            :class="[
              'wd-cell__value',
              `wd-cell__value--${cellValueAlign}`,
              customValueClass,
              { 'wd-cell__value--ellipsis': ellipsis, 'wd-cell__placeholder': showPlaceholder }
            ]"
          >
            <slot>{{ showPlaceholder ? placeholder : value }}</slot>
          </view>
          <wd-icon
            v-if="isLink"
            custom-class="wd-cell__arrow-right"
            :name="arrowIcon"
            :class-prefix="iconPrefix"
          />
          <slot v-else name="suffix">
            <wd-icon
              v-if="suffixIcon"
              :name="suffixIcon"
              :size="iconSize"
              :class-prefix="iconPrefix"
              :css-icon="cssIcon"
              :custom-class="`wd-cell__suffix ${customSuffixClass}`"
            />
          </slot>
        </view>
      </view>
    </view>
  </view>
</template>
