/*
 * wd-steps — 步骤条
 *
 * Lynx 实现说明：经 useChildren 向 step 提供共享配置；
 * 横向排列显式 display: flex（Lynx 3.x linear 默认纵向）；
 * space 作为步骤间距经 gap 下发（横向 column-gap / 纵向 row-gap）。
 */
<script lang="ts" setup>
import './index.css'
import { addUnit, parseStyle } from '../../common/util'

import { computed } from 'vue-lynx'
import { stepsProps, STEPS_KEY } from './types'
import { useChildren } from '../../composables/useChildren'

const props = defineProps(stepsProps)

const { linkChildren } = useChildren(STEPS_KEY)

linkChildren({ props: props as any })

/** space：步骤间距（gap 随 flex 方向自动取列/行间距） */
const rootStyle = computed(() => {
  const style: Record<string, string> = {}
  if (props.space) {
    const gap = addUnit(props.space)
    style['column-gap'] = gap
    style['row-gap'] = gap
  }
  return { ...style, ...parseStyle(props.customStyle) }
})
</script>

<template>
  <view :class="`wd-steps ${vertical ? 'is-vertical' : 'is-horizontal'} ${alignCenter ? 'is-align-center' : ''} ${dot ? 'is-dot' : ''} ${customClass}`" :style="rootStyle">
    <slot />
  </view>
</template>
