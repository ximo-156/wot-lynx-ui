/*
 * wd-sticky — 粘性布局
 *
 * Lynx 实现说明（相对 wot-ui 的适配点）：
 * - 吸顶机制降级：参考源依赖 uni.createIntersectionObserver（uni-app 小程序
 *   专有 API，本地 common/uni 返回空实现、永不回调）+ getRect 手动补位驱动
 *   fixed/absolute 定位；Lynx 无该能力，整套滚动联动不工作。改用渲染器原生
 *   position: sticky（与 wd-index-anchor / wd-table 同方案）：吸顶元素保持
 *   在文档流内，滚动到阈值位置时由引擎贴住 offsetTop 处，零 JS 开销；
 * - 因此参考源的外层占位 view（JS 改定位时撑起高度）、wd-resize 尺寸监听、
 *   defineExpose(setPosition/stickyState) 与 sticky-box 的 observerForChild
 *   联动均不再需要，DOM 精简为 wd-sticky（sticky 元素）> wd-sticky__container，
 *   类名与 id 保留；
 * - 参考源 innerOffsetTop 的 H5 44px 导航栏补偿为条件编译（#ifdef H5），
 *   Lynx 无该概念，直接取 props.offsetTop；
 * - **根节点三件套 + 居中核查**（NATIVE-REWRITE §3.1）：display: flex +
 *   flex-direction: column 在 index.scss 显式声明（根与 __container 两处），
 *   linear 默认布局下缺一行 flex-direction 即被静默丢弃；
 * - **Style Funnel**（CONVENTIONS §20）：rootStyle 的三个可切换键
 *   （position / top / z-index）经 defineStyleKeys + resolveStyle 每帧输出
 *   完整键集——offsetTop 由具体值变 0 时旧位移不会残留；
 * - rootStyle 由参考源的「objToStyle 拼字符串 + customStyle 拼接」改为对象语法
 *   （parseStyle 归一，CONVENTIONS §19：字符串 :style 会被静默丢弃）；
 * - 无交互事件（按压/点击由插槽内容自行处理）。
 */
<script lang="ts" setup>
import './index.css'

import { computed } from 'vue-lynx'
import { stickyProps } from './types'
import { addUnit, parseStyle, uuid, type CSSProperties } from '../../common/util'
import { defineStyleKeys, resolveStyle } from '../../common/style'

const props = defineProps(stickyProps)

const stickyId = `wd-sticky-${uuid()}`

/**
 * 可切换样式键 + 中性值（CONVENTIONS §20：每帧输出完整键集）。
 * position 恒为 sticky（渲染器原生吸顶），top / z-index 的中性值取
 * prop 默认值——offsetTop 由具体值变 0 时旧位移不会残留。
 */
const STICKY_STYLE = defineStyleKeys({
  position: 'sticky',
  top: '0px',
  zIndex: '1'
})

const rootStyle = computed<CSSProperties>(() => {
  return {
    ...resolveStyle(STICKY_STYLE, {
      position: 'sticky',
      top: addUnit(props.offsetTop),
      zIndex: String(props.zIndex)
    }),
    ...parseStyle(props.customStyle)
  }
})
</script>

<template>
  <view :class="`wd-sticky ${customClass}`" :style="rootStyle" :id="stickyId">
    <view class="wd-sticky__container">
      <slot />
    </view>
  </view>
</template>
