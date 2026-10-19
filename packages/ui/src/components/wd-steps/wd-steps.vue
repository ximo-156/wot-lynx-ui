/*
 * wd-steps — 步骤条
 *
 * Lynx 实现说明（相对 wot-ui 的适配点）：
 * - 参考源根 view 直接绑定 customStyle 字符串，Lynx 的 patchProp 对字符串
 *   style 会静默丢弃（CONVENTIONS §19），改为 parseStyle(customStyle) 归一
 *   的对象语法；
 * - 经 useChildren 向 wd-step 提供 props（active/vertical/dot/space/
 *   alignCenter），step 的宽度（横向）/高度（纵向）由 step 侧 rootStyle 计算；
 * - 根 view 非交互节点（无可点击语义），不涉及事件映射。
 */
<script lang="ts" setup>
import './index.css'

import { parseStyle } from '../../common/util'
import { stepsProps } from './types'
import { useChildren } from '../../composables/useChildren'
import { STEPS_KEY } from './types'

const props = defineProps(stepsProps)

const { linkChildren } = useChildren(STEPS_KEY)

linkChildren({ props })
</script>

<template>
  <view :class="`wd-steps ${customClass} ${vertical ? 'is-vertical' : ''}`" :style="parseStyle(customStyle)">
    <slot />
  </view>
</template>
