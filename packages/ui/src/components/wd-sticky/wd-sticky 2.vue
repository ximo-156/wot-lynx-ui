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
 * - rootStyle 由参考源的「objToStyle 拼字符串 + customStyle 拼接」改为对象语法
 *   （parseStyle 归一，CONVENTIONS §19：字符串 :style 会被静默丢弃）；
 * - 无交互事件（按压/点击由插槽内容自行处理）。
 */
<script lang="ts" setup>
import './index.css'

import { computed } from 'vue-lynx'
import { stickyProps } from './types'
import { addUnit, parseStyle, uuid, type CSSProperties } from '../../common/util'

const props = defineProps(stickyProps)

const stickyId = `wd-sticky-${uuid()}`

const rootStyle = computed<CSSProperties>(() => {
  const style: CSSProperties = {
    position: 'sticky',
    top: addUnit(props.offsetTop),
    zIndex: String(props.zIndex)
  }
  return { ...style, ...parseStyle(props.customStyle) }
})
</script>

<template>
  <view :class="`wd-sticky ${customClass}`" :style="rootStyle" :id="stickyId">
    <view class="wd-sticky__container">
      <slot />
    </view>
  </view>
</template>
