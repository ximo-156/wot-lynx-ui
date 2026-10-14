/*
 * wd-icon — 图标
 *
 * Lynx 适配说明：
 * - wot-ui 基于 iconfont 字体渲染，Lynx 无稳定的跨端字体加载方案，
 *   因此内置图标改为由 wd-icons 图标字体提取的 SVG path，通过 Lynx 原生 svg 元素渲染，
 *   颜色由 fill 属性实时控制，无需加载字体文件，性能与保真度兼得。
 * - svg / image 子元素的尺寸必须显式声明（px）：Lynx 的 svg 元素不解析 em
 *   相对单位，依赖 1em 会导致图标放大到默认尺寸（见 vue-lynx examples/elk）。
 * - svg content 内的 fill 颜色必须显式指定，不能依赖 currentColor 跨原生边界继承。
 */
<script setup lang="ts">
import './index.css'

import { computed } from 'vue-lynx'
import { iconProps } from './types'
import { iconPaths, ICON_VIEW_BOX } from '../../icons/data'
import { styleToObject, addUnit, isDef, objToStyle, sanitizeSvgContent, type CSSProperties } from '../../common/util'

/** 默认图标颜色，对应主题变量 --wot-icon-main (coolgrey-10) */
const DEFAULT_ICON_COLOR = '#191A1F'
/** 默认图标尺寸（px），对应主题变量 --wot-icon-font-size / 正文字号 */
const DEFAULT_ICON_SIZE = 14

const props = defineProps(iconProps)
const emit = defineEmits(['click', 'touch'])

const isImage = computed(() => {
  return !props.cssIcon && isDef(props.name) && props.name.includes('/')
})

const pathData = computed(() => {
  if (props.cssIcon || isImage.value) return ''
  return iconPaths[props.name] || ''
})

const svgContent = computed(() => {
  if (!pathData.value) return ''
  const color = props.color || DEFAULT_ICON_COLOR
  // sanitizeSvgContent：白名单外元素会触发真机 insertNode 致命异常（9902），过一道安全网
  return sanitizeSvgContent(`<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="${ICON_VIEW_BOX}"><path d="${pathData.value}" fill="${color}"/></svg>`)
})

/** 图标盒尺寸（px）：svg / image 子元素显式定尺，避免 em 单位在 Lynx 失效 */
const boxSize = computed(() => {
  return isDef(props.size) ? addUnit(props.size) : `${DEFAULT_ICON_SIZE}px`
})

const boxStyle = computed(() => {
  return objToStyle({ width: boxSize.value, height: boxSize.value })
})

const rootClass = computed(() => {
  const clazz: Record<string, boolean> = {
    'wd-icon': true
  }

  if (props.cssIcon) {
    clazz['wd-icon--css'] = true

    if (typeof props.cssIcon === 'string') {
      clazz[props.cssIcon] = true
    } else {
      clazz[props.name] = true
    }
  } else if (isImage.value) {
    clazz['wd-icon--image'] = true
  }

  return [clazz, props.customClass]
})

const rootStyle = computed(() => {
  const style: CSSProperties = {}
  if (props.color) {
    style['color'] = props.color
  }
  if (props.size) {
    const sizeValue = addUnit(props.size)
    style['font-size'] = sizeValue
  }
  return `${objToStyle(style)}${props.customStyle ? ';' + props.customStyle : ''}`
})

function handleClick(event: any) {
  emit('click', event)
}
</script>

<template>
  <view :class="rootClass" :style="styleToObject(rootStyle)" @tap="handleClick">
    <image v-if="isImage" class="wd-icon__image" :src="name" :style="styleToObject(boxStyle)" />
    <svg v-else-if="svgContent" class="wd-icon__svg" :content="svgContent" :style="styleToObject(boxStyle)" />
  </view>
</template>
