<template>
  <view :class="`wd-gap ${safeAreaBottom ? 'wd-gap--safe' : ''} ${customClass}`" :style="styleToObject(rootStyle)"></view>
</template>

<script setup lang="ts">
import './index.css'
import {computed} from 'vue-lynx'
import { styleToObject, type CSSProperties, addUnit, isDef, objToStyle } from '../../common/util'
import { gapProps } from './types'

const props = defineProps(gapProps)

const rootStyle = computed(() => {
  const rootStyle: CSSProperties = {}
  if (isDef(props.bgColor)) {
    rootStyle['background'] = props.bgColor
  }
  if (isDef(props.height)) {
    rootStyle['height'] = addUnit(props.height)
  }
  return `${objToStyle(rootStyle)}${props.customStyle}`
})
</script>
