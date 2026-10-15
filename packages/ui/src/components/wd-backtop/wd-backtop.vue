/*
 * wd-backtop — 回到顶部
 *
 * Lynx 实现说明：scrollTop 超过 top 阈值时经 wd-transition 淡入；
 * 点击 emit click（由页面执行滚动，组件不持有 scroll 状态）。
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
  'z-index': String(props.zIndex),
  bottom: addUnit(props.bottom),
  right: addUnit(props.right),
  ...parseStyle(props.customStyle)
}))

/** 图标样式（iconStyle 为字符串，parseStyle 归一） */
const iconStyle = computed(() => parseStyle(props.iconStyle))

function handleBacktop() {
  emit('click')
  emit('tap')
}
</script>

<template>
  <wd-transition :show="show" name="fade">
    <view
      :class="`wd-backtop wd-backtop--${shape} ${customClass}`"
      :style="rootStyle"
      @tap="handleBacktop"
    >
      <slot>
        <view class="wd-backtop__content">
          <wd-icon custom-class="wd-backtop__backicon" name="to-top" :custom-style="iconStyle" />
          <text v-if="text" class="wd-backtop__text">{{ text }}</text>
        </view>
      </slot>
    </view>
  </wd-transition>
</template>
