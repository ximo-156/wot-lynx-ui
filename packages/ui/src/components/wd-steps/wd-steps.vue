/*
 * wd-steps — 步骤条
 *
 * Lynx 实现说明：经 useChildren 向 step 提供共享配置；
 * 横向排列显式 display: flex（Lynx 3.x linear 默认纵向）。
 */
<script lang="ts" setup>
import './index.css'

import { stepsProps, STEPS_KEY } from './types'
import { useChildren } from '../../composables/useChildren'

const props = defineProps(stepsProps)

const { linkChildren } = useChildren(STEPS_KEY)

linkChildren({ props: props as any })
</script>

<template>
  <view :class="`wd-steps ${vertical ? 'is-vertical' : 'is-horizontal'} ${alignCenter ? 'is-align-center' : ''} ${dot ? 'is-dot' : ''} ${customClass}`" :style="customStyle">
    <slot />
  </view>
</template>
