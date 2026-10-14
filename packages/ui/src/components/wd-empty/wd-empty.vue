<template>
  <view :class="`wd-empty  ${customClass}`" :style="styleToObject(customStyle)">
    <slot name="image">
      <WdIcon :name="icon" :class-prefix="iconPrefix" :css-icon="cssIcon" custom-class="wd-empty__icon" :custom-style="iconStyle" :color="ICON_COLOR"></WdIcon>
    </slot>
    <view v-if="tip" class="wd-empty__text"><text>{{ tip }}</text></view>
    <slot name="bottom" />
  </view>
</template>

<script setup lang="ts">
import './index.css'
import WdIcon from '../wd-icon/wd-icon.vue'
import { COOLGREY } from '../../common/theme'

/** 空状态图标色：Lynx 的 wd-icon SVG 不吃 CSS color，显式下发浅灰 */
const ICON_COLOR = COOLGREY[4]
import {computed} from 'vue-lynx'
import { styleToObject, type CSSProperties, addUnit, objToStyle } from '../../common/util'
import { emptyProps } from './types'

const props = defineProps(emptyProps)

/**
 * 图标样式
 */
const iconStyle = computed(() => {
  let style: CSSProperties = {}
  if (props.iconSize) {
    style['font-size'] = addUnit(props.iconSize)
    style['width'] = addUnit(props.iconSize)
    style['height'] = addUnit(props.iconSize)
  }
  return `${objToStyle(style)}`
})
</script>
