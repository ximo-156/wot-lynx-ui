/*
 * wd-sticky-box — 粘性容器
 *
 * Lynx 实现说明（相对 wot-ui 的适配点）：
 * - 参考源经 wd-resize 监听容器尺寸变化，并维护子吸顶元素的
 *   IntersectionObserver 监听表（uni.createIntersectionObserver 在 Lynx 无
 *   对应能力，本地 common/uni 返回空实现）；Lynx 下吸顶由 wd-sticky 的
 *   position: sticky 原生处理，容器仅为相对定位包裹层，故移除 resize /
 *   observer 联动；
 * - 参考源外层 view 的静态 style="position: relative" 为字符串属性，
 *   vue-lynx 对字符串 style 会静默丢弃（CONVENTIONS §19），改为对象语法；
 * - customStyle 经 parseStyle 归一后绑定；
 * - **根节点三件套**（NATIVE-REWRITE §3.1）：display: flex +
 *   flex-direction: column + position: relative 在 index.scss 显式声明
 *   （linear 默认布局下 flex-direction 会被静默丢弃），外层包裹 view 仅承担
 *   对象语法的 position: relative；
 * - 本地私有 props（containerHeight / offsetTop）与参考源不一致，已移除
 *   （参考源仅 baseProps）。
 */
<script lang="ts" setup>
import './index.css'

import { parseStyle } from '../../common/util'
import { stickyBoxProps } from './types'

defineProps(stickyBoxProps)
</script>

<template>
  <view :style="{ position: 'relative' }">
    <view :class="`wd-sticky-box ${customClass}`" :style="parseStyle(customStyle)">
      <slot />
    </view>
  </view>
</template>
