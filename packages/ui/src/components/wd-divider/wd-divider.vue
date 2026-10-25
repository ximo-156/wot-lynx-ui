/* wd-divider — 真实线段替代伪元素，保留厚度/半缩放以及任意内容插槽。 */
<script lang="ts" setup>
import './index.css'

import { computed, useSlots } from 'vue-lynx'
import { dividerProps } from './types'
import { parseStyle } from '../../common/util'

const props = defineProps(dividerProps)
const slots = useSlots()
const contentMode = computed(() => !props.vertical && (props.contentPosition !== 'center' || Boolean(slots.default)))
const rootStyle = computed(() => ({
  color: props.color || '',
  ...parseStyle(props.customStyle)
}))
const rootClass = computed(() => ['wd-divider', { 'is-dashed': props.dashed, 'is-hairline': props.hairline },
  props.vertical ? 'wd-divider--vertical' : contentMode.value ? `wd-divider--${props.contentPosition}` : '', props.customClass])
function lineClass(position: 'first' | 'last') {
  const short = (position === 'first' && props.contentPosition === 'left') || (position === 'last' && props.contentPosition === 'right')
  return ['wd-divider__line', `wd-divider__line--${position}`, { 'wd-divider__line--short': short }]
}
</script>

<template>
  <view :class="rootClass" :style="rootStyle">
    <template v-if="!vertical">
      <view :class="lineClass('first')" />
      <view v-if="$slots.default" class="wd-divider__content"><slot /></view>
      <view v-if="contentMode" :class="lineClass('last')" />
    </template>
    <view v-else class="wd-divider__line" />
  </view>
</template>
