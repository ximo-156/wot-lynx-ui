/*
 * wot-ui — 内部占位组件
 *
 * 与 wot-ui 的目录结构对齐；不提供公开能力。
 */
<script lang="ts" setup>
import './index.css'

import { wotUiProps } from './types'

defineProps(wotUiProps)
</script>

<template>
  <view :class="`wot-ui ${customClass}`" :style="customStyle" />
</template>
