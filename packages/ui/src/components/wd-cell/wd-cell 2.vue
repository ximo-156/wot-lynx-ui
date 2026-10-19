/*
 * wd-cell — 单元格
 *
 * Lynx 实现说明（相对 wot-ui 的适配点）：
 * - 根 view 绑 @tap 并在 emits 声明转发 click/tap（CONVENTIONS §6/§14）；
 *   参考源的 hover-class="is-hover"（isLink||clickable 时）按压反馈在 Lynx
 *   无对应属性，改为根节点常驻 is-hover 类 + CSS :active（CONVENTIONS §17），
 *   hover-stay-time 为 uni-app 专有属性，删除；
 * - rootStyle / titleWidth 样式由参考源的字符串拼接改为对象语法
 *   （parseStyle 归一 customStyle，CONVENTIONS §19）；
 * - 页面跳转：参考源调用全局 uni.navigateTo/redirectTo，改为 common/uni
 *   兼容层下发（宿主可注入路由，未注入时降级 warning）；
 * - 箭头图标：参考源直接把 arrowDirection（left/up/down/right）作为图标名
 *   传给 wd-icon；本地内置图标集无该名字形，经 arrowIcon 映射到
 *   arrow-left/up/down/right-bold（CONVENTIONS §8）；
 * - label / value 的兜底裸文本包 text 元素（Lynx view 内裸文本不渲染）。
 */
<script lang="ts" setup>
import './index.css'

import { computed, useSlots } from 'vue-lynx'
import WdIcon from '../wd-icon/wd-icon.vue'
import { cellProps } from './types'
import { useCell } from '../../composables/useCell'
import { addUnit, isDef, parseStyle, type CSSProperties } from '../../common/util'
import { uni } from '../../common/uni'

const props = defineProps(cellProps)
const emit = defineEmits<{
  (e: 'click'): void
  (e: 'tap'): void
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

/** is-link 箭头图标：arrowDirection 映射到本地内置图标集字形 */
const arrowIcon = computed(() => {
  const map: Record<string, string> = {
    left: 'arrow-left-bold',
    up: 'arrow-up-bold',
    down: 'arrow-down-bold',
    right: 'arrow-right-bold'
  }
  return map[props.arrowDirection] || 'arrow-right-bold'
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

/** 左侧标题宽度（对象语法：字符串 :style 会被 vue-lynx 静默丢弃） */
const titleWidthStyle = computed<CSSProperties>(() => {
  if (!cellTitleWidth.value) return {}
  const width = addUnit(cellTitleWidth.value as string | number)
  return { minWidth: width, maxWidth: width }
})

const rootClass = computed(() => {
  return [
    'wd-cell',
    isBorder.value ? 'is-border' : '',
    cellSize.value ? 'is-' + cellSize.value : '',
    isCenter.value ? 'is-center' : '',
    // 参考源 :hover-class="isLink || clickable ? 'is-hover' : 'none'"
    props.isLink || props.clickable ? 'is-hover' : '',
    props.customClass
  ]
})

/**
 * 点击单元格时触发
 * 处理点击事件和页面跳转
 */
function onClick(event: any) {
  const url = props.to

  if (props.clickable || props.isLink) {
    emit('click')
    emit('tap', event)
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
        <!--前置图标-->
        <slot name="prefix">
          <wd-icon
            v-if="prefixIcon"
            :name="prefixIcon"
            :size="iconSize"
            :class-prefix="iconPrefix"
            :css-icon="cssIcon"
            :custom-class="`wd-cell__prefix ${customPrefixClass}`"
          ></wd-icon>
        </slot>

        <view v-if="showTitle" class="wd-cell__title">
          <!--title BEGIN-->
          <slot v-if="useTitleSlot && $slots.title" name="title"></slot>
          <text v-else-if="title" :class="customTitleClass">{{ title }}</text>

          <!--title END-->

          <!--label BEGIN-->
          <slot v-if="useLabelSlot && $slots.label" name="label"></slot>
          <view v-else-if="label" :class="`wd-cell__label ${customLabelClass}`"><text>{{ label }}</text></view>
          <!--label END-->
        </view>
        <text v-if="required && !hideAsterisk && asteriskPosition === 'end'" class="wd-cell__required">*</text>
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
            <slot><text>{{ showPlaceholder ? placeholder : value }}</text></slot>
          </view>
          <!--后置图标/箭头-->
          <wd-icon v-if="isLink" custom-class="wd-cell__arrow-right" :name="arrowIcon" :class-prefix="iconPrefix" />
          <slot v-else name="suffix">
            <wd-icon
              v-if="suffixIcon"
              :name="suffixIcon"
              :size="iconSize"
              :class-prefix="iconPrefix"
              :css-icon="cssIcon"
              :custom-class="`wd-cell__suffix ${customSuffixClass}`"
            ></wd-icon>
          </slot>
        </view>
      </view>
      <!--right content END-->
    </view>
  </view>
</template>
