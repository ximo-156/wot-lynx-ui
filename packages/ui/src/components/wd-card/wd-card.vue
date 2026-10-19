/*
 * wd-card — 卡片
 *
 * Lynx 实现说明（相对 wot-ui 的适配点）：
 * - rootStyle：参考源直接绑定 customStyle 字符串，改为 parseStyle() 归一
 *   的对象语法（CONVENTIONS §19，字符串 :style 会被静默丢弃）；
 * - 参考源 `&:not(:last-child)` 的结构性伪类在 Lynx 不支持（PORTING §4.5），
 *   卡片堆叠间距改为根节点恒定 margin-bottom（多卡场景间距可预期，
 *   末卡需要贴底时由消费方 customStyle 覆盖）；
 * - footer / rectangle 内容区的分割线：参考源用 halfPixelBorder 的 ::after
 *   伪元素（并带 $left 左右缩进），Lynx 无伪元素，改为主元素真实
 *   border-top（1ppx），参考源 mixin 前置的 position: relative 显式保留，
 *   缩进丢失（边框随元素全宽，属既定适配）；
 * - box-shadow / transition 按参考源原样保留（PORTING §4 未列入删除清单，
 *   Lynx 不支持时由引擎忽略，令牌定制点不丢失）。
 */
<script lang="ts" setup>
import './index.css'

import { parseStyle } from '../../common/util'
import { cardProps } from './types'

defineProps(cardProps)
</script>

<template>
  <view :class="`wd-card ${type ? `wd-card--${type}` : ''} ${customClass}`" :style="parseStyle(customStyle)">
    <view :class="`wd-card__title ${customTitleClass}`" v-if="title || $slots.title">
      <slot name="title">
        <text class="wd-card__title-text" v-if="title">{{ title }}</text>
      </slot>
    </view>
    <view :class="`wd-card__content ${customContentClass}`">
      <slot></slot>
    </view>
    <view :class="`wd-card__footer ${customFooterClass}`" v-if="$slots.footer">
      <slot name="footer"></slot>
    </view>
  </view>
</template>
