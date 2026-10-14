<template>
  <view
    :class="['wd-cell', isBorder ? 'is-border' : '', cellSize ? 'is-' + cellSize : '', isCenter ? 'is-center' : '', isLink || clickable ? 'is-link' : '', customClass]"
    :style="styleToObject(customStyle)"
    @tap="onClick"
  >
    <!-- Lynx 适配：wot-ui 用 ::after 伪元素绘制左右各内缩 12px 的分隔线，
         Lynx 无伪元素，改为真实元素（样式见 index.scss 的 __border）。 -->
    <view v-if="isBorder" class="wd-cell__border" />
    <view :class="`wd-cell__wrapper wd-cell__wrapper--${cellLayout}`">
      <view
        v-if="showLeft"
        class="wd-cell__left"
        :style="styleToObject(cellTitleWidth ? 'min-width:' + addUnit(cellTitleWidth) + ';max-width:' + addUnit(cellTitleWidth) + ';' : '')"
      >
        <text v-if="required && !hideAsterisk && asteriskPosition === 'start'" class="wd-cell__required wd-cell__required--left"><text>*</text></text>
        <!--前置图标-->
        <slot name="prefix">
          <WdIcon
            v-if="prefixIcon"
            :name="prefixIcon"
            :size="iconSize"
            :color="ICON_COLOR"
            :class-prefix="iconPrefix"
            :css-icon="cssIcon"
            :custom-class="`wd-cell__prefix ${customPrefixClass}`"
          ></WdIcon>
        </slot>

        <view v-if="showTitle" class="wd-cell__title">
          <!--title BEGIN-->
          <slot v-if="useTitleSlot && $slots.title" name="title"></slot>
          <text v-else-if="title" :class="customTitleClass"><text>{{ title }}</text></text>

          <!--title END-->

          <!--label BEGIN-->
          <slot v-if="useLabelSlot && $slots.label" name="label"></slot>
          <view v-else-if="label" :class="`wd-cell__label ${customLabelClass}`"><text>{{ label }}</text></view>
          <!--label END-->
        </view>
        <text v-if="required && !hideAsterisk && asteriskPosition === 'end'" class="wd-cell__required"><text>*</text></text>
      </view>
      <!--right content BEGIN-->
      <view class="wd-cell__right">
        <view class="wd-cell__body">
          <!--文案内容-->
          <view
            :class="`wd-cell__value ${customValueClass} wd-cell__value--${cellValueAlign} ${ellipsis ? 'wd-cell__value--ellipsis' : ''} ${
              showPlaceholder ? 'wd-cell__placeholder' : ''
            }`"
          >
            <slot>
              <text>{{ showPlaceholder ? placeholder : value }}</text>
            </slot>
          </view>
          <!--后置图标/箭头-->
          <WdIcon v-if="isLink" custom-class="wd-cell__arrow-right" :name="arrowDirection" :class-prefix="iconPrefix" :color="ICON_COLOR" :size="iconSize" />
          <slot v-else name="suffix">
            <WdIcon
              v-if="suffixIcon"
              :name="suffixIcon"
              :size="iconSize"
              :color="ICON_COLOR"
              :class-prefix="iconPrefix"
              :css-icon="cssIcon"
              :custom-class="`wd-cell__suffix ${customSuffixClass}`"
            ></WdIcon>
          </slot>
        </view>
      </view>
      <!--right content END-->
    </view>
  </view>
</template>

<script setup lang="ts">
import './index.css'
import { uni } from '../../common/uni'
import WdIcon from '../wd-icon/wd-icon.vue'
import { COOLGREY } from '../../common/theme'

/** 单元格图标色：Lynx 的 wd-icon SVG 不吃 CSS color，显式下发辅助灰（--wot-icon-auxiliary） */
const ICON_COLOR = COOLGREY[6]
import { computed, useSlots } from 'vue-lynx'
import { useCell } from '../../composables/useCell'

import { cellProps } from './types'
import { styleToObject, addUnit, isDef } from '../../common/util'

const props = defineProps(cellProps)
const emit = defineEmits<{
  (e: 'click'): void
}>()

// 获取插槽
const slots = useSlots()

const cell = useCell()

const isBorder = computed(() => {
  return Boolean(isDef(props.border) ? props.border : cell.border.value)
})

// 支持 cell-group 公共配置，子组件属性优先
const isCenter = computed(() => {
  return isDef(props.center) ? props.center : cell.center?.value
})

// 支持 cell-group 公共配置，子组件属性优先
const cellSize = computed(() => {
  return isDef(props.size) ? props.size : cell.size?.value
})

// 支持 cell-group 公共配置，子组件属性优先
const cellTitleWidth = computed(() => {
  return isDef(props.titleWidth) ? props.titleWidth : cell.titleWidth?.value
})

// 支持 cell-group 公共配置，子组件属性优先
const cellLayout = computed(() => {
  return isDef(props.layout) ? props.layout : cell.layout?.value || 'horizontal'
})

// 支持 cell-group 公共配置，子组件属性优先
const cellValueAlign = computed(() => {
  return isDef(props.valueAlign) ? props.valueAlign : cell.valueAlign?.value || 'right'
})

// 是否展示左侧部分
const showLeft = computed(() => {
  // 插槽优先级高于props
  // 有prefix插槽或prefixIcon属性
  const hasPrefix = slots.prefix || props.prefixIcon
  // 有title插槽或title属性
  const hasTitle = (slots.title && props.useTitleSlot) || props.title
  // 有label插槽或label属性
  const hasLabel = (slots.label && props.useLabelSlot) || props.label

  return hasPrefix || hasTitle || hasLabel
})

const showTitle = computed(() => {
  return (props.useTitleSlot && slots.title) || props.title || (props.useLabelSlot && slots.label) || props.label
})

const showPlaceholder = computed(() => {
  return Boolean(props.placeholder && (props.value === '' || props.value === undefined || props.value === null) && !slots.default)
})

/**
 * 点击单元格时触发
 * 处理点击事件和页面跳转
 */
function onClick() {
  const url = props.to

  if (props.clickable || props.isLink) {
    emit('click')
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

