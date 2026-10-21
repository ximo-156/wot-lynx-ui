/*
 * wd-navbar-capsule — 导航胶囊
 *
 * Lynx 实现说明（相对 wot-ui 2.3.2 的适配点）：
 * - 参考源用 @click 绑在 wd-icon 上，Lynx view 只派发 tap，改为 @tap
 *   （wd-icon 的 emits 同时声明 click / tap 并转发，CONVENTIONS §6/§14）；
 * - 参考源以 ::before（200% 尺寸 + scale(0.5)）绘制 0.5px 描边圆环、以
 *   ::after（left: 50% 绝对定位）绘制中线；Lynx 无伪元素，分别改为主元素
 *   真实 border（halfPixelBorderSurround，1ppx 物理像素）+ 两个图标之间的
 *   真实分割线元素，见 index.scss；
 * - 参考源的 &:empty { display: none } 为 Web 专有结构伪类（Lynx 不支持），
 *   且组件恒渲染两个图标、永不命中，删除；
 * - 左侧箭头图标：参考源传 name="left"，本地内置图标集无该字形，映射到
 *   arrow-left-bold（CONVENTIONS §8）；home 字形内置集具备，保持不变；
 * - customStyle 经 parseStyle 归一为对象后绑定（CONVENTIONS §19）。
 */
<script lang="ts" setup>
import './index.css'

import WdIcon from '../wd-icon/wd-icon.vue'
import { navbarCapsuleProps } from './types'
import { parseStyle } from '../../common/util'

defineProps(navbarCapsuleProps)

/**
 * 事件发送器
 */
const emit = defineEmits(['back', 'back-home'])

/**
 * 处理返回事件
 */
function handleBack() {
  emit('back')
}

/**
 * 处理返回首页事件
 */
function handleBackHome() {
  emit('back-home')
}
</script>

<template>
  <view :class="`wd-navbar-capsule ${customClass}`" :style="parseStyle(customStyle)">
    <WdIcon @tap="handleBack" name="left" custom-class="wd-navbar-capsule__icon" />
    <view class="wd-navbar-capsule__separator" />
    <WdIcon @tap="handleBackHome" name="home" custom-class="wd-navbar-capsule__icon" />
    <view class="wd-navbar-capsule__border" />
  </view>
</template>
