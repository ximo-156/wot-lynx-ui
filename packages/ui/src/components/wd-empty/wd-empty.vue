/*
 * wd-empty — 空状态
 * 官方 empty 字形直接交给 WdIcon；iconSize 同时覆盖图标盒宽高和字号。
 * Lynx 文本使用真实 text 节点，样式对象保留清空键以恢复 CSS 默认值。
 */
<script lang="ts" setup>
import './index.css'

import { computed } from 'vue-lynx'
import WdIcon from '../wd-icon/wd-icon.vue'
import { emptyProps } from './types'
import { addUnit, parseStyle } from '../../common/util'
import { defineStyleKeys, resolveStyle } from '../../common/style'

const props = defineProps(emptyProps)
const ICON_STYLE = defineStyleKeys({ width: '', height: '', 'font-size': '' })
const iconStyle = computed(() => {
  const size = props.iconSize ? addUnit(props.iconSize) : ''
  return resolveStyle(ICON_STYLE, { width: size, height: size, 'font-size': size })
})
</script>

<template>
  <view :class="`wd-empty ${customClass}`" :style="parseStyle(customStyle)">
    <slot name="image">
      <WdIcon
        :name="icon"
        :class-prefix="iconPrefix"
        :css-icon="cssIcon"
        custom-class="wd-empty__icon"
        :custom-style="iconStyle"
        :size="iconSize || undefined"
      />
    </slot>
    <view v-if="tip" class="wd-empty__text">
      <text class="wd-empty__tip">{{ tip }}</text>
    </view>
    <slot name="bottom" />
  </view>
</template>
