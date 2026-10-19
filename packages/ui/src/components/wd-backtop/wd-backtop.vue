/*
 * wd-backtop — 回到顶部
 *
 * Lynx 实现说明（相对 wot-ui 2.3.2 的适配点）：
 * - 定位必须落在 wd-transition 的**根节点**上（custom-class / custom-style）：
 *   Lynx 引擎会把 position: fixed 节点提升到页面根节点，一旦它是 transition
 *   根 view 的子节点，父级的 display:none（v-show 隐藏态）就管不到它——阈值
 *   未到时按钮照样常驻屏幕（2026-10-19 演示页实测，回归见
 *   test/backtop-visibility.test.ts）。因此参考源中 view 根节点的类名与定位
 *   样式经 wd-transition 的 custom-class / custom-style 下发到 transition 根
 *   view，显隐与定位同源；
 * - 形状类名与参考源一致（is-circle / is-square，由 SCSS 的 when() 生成）；
 * - 事件映射：参考源 @click → @tap（CONVENTIONS §6，Lynx view 不派发 click）；
 *   根 view 交互组件在 emits 声明 'tap' 并在处理器转发（CONVENTIONS §14：
 *   消费方在组件上绑 @tap 不会落入合并崩溃）；
 * - 参考源的 uni.pageScrollTo 平台调用按 PORTING §3.9 降级：Lynx 页面滚动由
 *   宿主的 scroll-view 承载，宿主经 configureUniAdapter 注入 pageScrollTo 时
 *   走原生滚动（duration 生效），否则仅抛 click / tap 事件由消费方自行滚动；
 * - customStyle / iconStyle 为字符串，经 parseStyle 归一为对象语法
 *   （CONVENTIONS §19：字符串 :style 会被 vue-lynx 静默丢弃）；
 * - 图标名 to-top 在本地 iconfont 集中无对应字形，取最近似字形 top；
 * - 参考源 view 内的裸文本（{{ text }}）包进 text 元素（CONVENTIONS §4）。
 */
<script lang="ts" setup>
import './index.css'

import { computed } from 'vue-lynx'
import WdTransition from '../wd-transition/wd-transition.vue'
import WdIcon from '../wd-icon/wd-icon.vue'
import { backtopProps } from './types'
import { addUnit, parseStyle } from '../../common/util'
import { hasUniAdapter, uni } from '../../common/uni'

const props = defineProps(backtopProps)
const emit = defineEmits(['click', 'tap'])

/**
 * 是否显示回到顶部按钮
 */
const show = computed(() => props.scrollTop > props.top)

/** 根节点（transition 根 view）类名：形状状态与参考源一致（is- 前缀） */
const rootClass = computed(() => `wd-backtop ${props.customClass} is-${props.shape}`)

/** 根节点定位样式（对象语法 + customStyle 解析，CONVENTIONS §19） */
const rootStyle = computed(() => ({
  'z-index': String(props.zIndex),
  bottom: addUnit(props.bottom),
  right: addUnit(props.right),
  ...parseStyle(props.customStyle)
}))

/** 图标样式（iconStyle 为字符串，parseStyle 归一） */
const iconStyle = computed(() => parseStyle(props.iconStyle))

/**
 * 处理点击回到顶部
 */
function handleBacktop() {
  // Lynx 页面滚动由宿主 scroll-view 承载：宿主注入了 pageScrollTo 时走原生
  // 滚动（与 wot-ui 的 uni.pageScrollTo 语义一致，duration 生效），否则仅抛
  // 事件由消费方自行滚动（scroll-view 的 scroll-top 绑定）。
  if (hasUniAdapter('pageScrollTo')) {
    uni.pageScrollTo({ scrollTop: 0, duration: props.duration })
  }
  emit('click')
  emit('tap')
}
</script>

<template>
  <wd-transition :show="show" name="fade" :custom-class="rootClass" :custom-style="rootStyle" @tap="handleBacktop">
    <slot>
      <view class="wd-backtop__content">
        <wd-icon custom-class="wd-backtop__backicon" name="top" :custom-style="iconStyle" />
        <text v-if="text" class="wd-backtop__text">{{ text }}</text>
      </view>
    </slot>
  </wd-transition>
</template>
