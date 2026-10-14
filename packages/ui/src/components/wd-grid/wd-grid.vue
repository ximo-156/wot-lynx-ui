<template>
  <view :class="`wd-grid ${customClass}`" :style="styleToObject(rootStyle)">
    <slot />
  </view>
</template>

<script setup lang="ts">
import './index.css'
import {computed} from 'vue-lynx'
import { useChildren } from '../../composables/useChildren'
import { GRID_KEY, gridProps } from './types'
import { styleToObject, type CSSProperties, addUnit, isDef, objToStyle } from '../../common/util'

const props = defineProps(gridProps)

const { linkChildren } = useChildren(GRID_KEY)
linkChildren({ props })

const rootStyle = computed(() => {
  const style: CSSProperties = {}
  if (isDef(props.gutter)) {
    style.paddingLeft = addUnit(props.gutter)
    if (props.square) {
      style.marginBottom = addUnit(-props.gutter)
    }
  }

  return `${objToStyle(style)}${props.customStyle || ''}`
})
</script>

