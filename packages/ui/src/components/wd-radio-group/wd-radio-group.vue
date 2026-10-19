/*
 * wd-radio-group — 单选框组
 *
 * Lynx 实现说明（相对 wot-ui 2.3.2 的适配点）：
 * - wot-ui 的分组容器是普通块级 view，横向排列靠子 wd-radio 的 inline-flex
 *   行内流式布局实现；Lynx 3.x 默认 linear 布局（纵向堆叠）且不识别
 *   inline-flex，故在容器上显式声明 flex 方向，并按 direction 追加
 *   `wd-radio-group--horizontal | --vertical` 修饰类；
 * - 横向项间距：wot-ui 用 `.wd-radio--horizontal:not(:last-child)` 的
 *   margin 实现，Lynx 无兄弟选择器，改为容器 gap（取值与
 *   --wot-radio-horizontal-margin 的水平间距一致）。
 */
<script lang="ts" setup>
import './index.css'

import { computed, watch } from 'vue-lynx'
import { radioGroupProps } from './types'
import { useChildren } from '../../composables/useChildren'
import { RADIO_GROUP_KEY } from '../../composables/useRadioGroup'
import { parseStyle } from '../../common/util'

const props = defineProps(radioGroupProps)
const emit = defineEmits(['change', 'update:modelValue'])

const { linkChildren } = useChildren(RADIO_GROUP_KEY)

linkChildren({ props, updateValue })

watch(
  () => props.type,
  (newValue) => {
    // type: 'dot', 'button', 'circle', 'square'
    const type = ['circle', 'dot', 'button', 'square']
    if (type.indexOf(newValue) === -1) console.error(`type must be one of ${type.toString()}`)
  },
  { deep: true, immediate: true }
)

const rootClass = computed(() => {
  const classes = ['wd-radio-group', `wd-radio-group--${props.direction}`]
  if (props.customClass) classes.push(props.customClass)
  return classes.join(' ')
})

/**
 * 处理radio子节点通知
 */
function updateValue(value: string | number | boolean | null) {
  emit('update:modelValue', value)
  emit('change', {
    value
  })
}
</script>

<template>
  <view :class="rootClass" :style="parseStyle(customStyle)">
    <slot />
  </view>
</template>
