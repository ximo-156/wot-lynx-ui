/*
 * wd-backtop — 回到顶部
 *
 * Lynx 实现说明：scrollTop 超过 top 阈值时经 wd-transition 淡入；
 * 点击 emit click（由页面执行滚动，组件不持有 scroll 状态）。
 *
 * 定位必须落在 wd-transition 的**根节点**上（custom-class / custom-style）：
 * Lynx 引擎会把 `position: fixed` 节点提升到页面根节点，一旦它是 transition
 * 根 view 的**子节点**，父级的 display:none（v-show 隐藏态）就管不到它——
 * 阈值未到时按钮照样常驻屏幕（2026-10-19 演示页实测）。把 fixed 与显隐放在
 * 同一个节点上，隐藏即真正不可见、可点击区域也随之消失。
 */
<script lang="ts" setup>
import './index.css'

import { computed } from 'vue-lynx'
import WdTransition from '../wd-transition/wd-transition.vue'
import WdIcon from '../wd-icon/wd-icon.vue'
import { backtopProps } from './types'
import { addUnit, parseStyle } from '../../common/util'

const props = defineProps(backtopProps)
const emit = defineEmits(['click', 'tap'])

const show = computed(() => props.scrollTop >= props.top)

/** 根节点定位样式（对象语法 + customStyle 解析，CONVENTIONS §19） */
const rootStyle = computed(() => ({
  // transition 根节点默认 flex-direction: column（.wd-transition），
  // 这里用内联值固定为横向，避免依赖两份 CSS 的引入顺序
  'flex-direction': 'row',
  'z-index': String(props.zIndex),
  bottom: addUnit(props.bottom),
  right: addUnit(props.right),
  ...parseStyle(props.customStyle)
}))

/** 图标样式（iconStyle 为字符串，parseStyle 归一） */
const iconStyle = computed(() => parseStyle(props.iconStyle))

const rootClass = computed(() => `wd-backtop wd-backtop--${props.shape} ${props.customClass}`)

function handleBacktop() {
  emit('click')
  emit('tap')
}
</script>

<template>
  <wd-transition
    :show="show"
    name="fade"
    :custom-class="rootClass"
    :custom-style="rootStyle"
    @tap="handleBacktop"
  >
    <slot>
      <view class="wd-backtop__content">
        <wd-icon custom-class="wd-backtop__backicon" name="top" :custom-style="iconStyle" />
        <text v-if="text" class="wd-backtop__text">{{ text }}</text>
      </view>
    </slot>
  </wd-transition>
</template>
