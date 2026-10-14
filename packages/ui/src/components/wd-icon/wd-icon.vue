/*
 * wd-icon — 图标
 *
 * Lynx 实现说明：
 * - 内置图标（302 个，icons/data.ts）经原生 <svg :content> 渲染，
 *   content 标记过 sanitizeSvgContent 安全网（SVG 元素白名单，见 CONVENTIONS §8）；
 * - svg content 不继承 CSS 变量/currentColor，未传 color 时按主题取
 *   --wd-icon-1 的对应值（common/theme.ts 镜像常量）；
 * - name 含 '/' 按图片渲染 <image>；cssIcon 走 CSS 类名模式。
 */
<script lang="ts" setup>
import './index.css'

import { computed, normalizeClass } from 'vue-lynx'
import { iconProps } from './types'
import { addUnit, isDef, objToStyle, sanitizeSvgContent } from '../../common/util'
import { ICON_VIEW_BOX, iconPaths } from '../../icons/data'
import { GRAY, THEME_ICON_COLOR } from '../../common/theme'
import { useGlobalConfig } from '../../composables/useGlobalConfig'

const props = defineProps(iconProps)
const emit = defineEmits(['click', 'touch'])

const globalConfig = useGlobalConfig()

const DEFAULT_ICON_SIZE = 20

const isImage = computed(() => {
  return !props.cssIcon && isDef(props.name) && props.name.includes('/')
})

const hasBuiltin = computed(() => {
  return !props.cssIcon && !isImage.value && isDef(props.name) && !!iconPaths[props.name]
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
  } else {
    clazz[props.classPrefix] = true
    clazz[`${props.classPrefix}-${props.name}`] = true
  }

  return normalizeClass([clazz, props.customClass])
})

const iconSize = computed(() => {
  return props.size ? addUnit(props.size) : `${DEFAULT_ICON_SIZE}px`
})

const rootStyle = computed(() => {
  const style: Record<string, string> = {}
  const color = props.color || (globalConfig.value.theme === 'dark' ? THEME_ICON_COLOR.dark : THEME_ICON_COLOR.light)
  if (color) {
    style['color'] = color
  }
  if (props.size) {
    style['font-size'] = iconSize.value
    // CSS 图标和图片模式下，同步设置 width/height
    if (props.cssIcon || isImage.value) {
      style['width'] = iconSize.value
      style['height'] = iconSize.value
    }
  }
  return `${objToStyle(style)} ${props.customStyle}`
})

const svgContent = computed(() => {
  const d = iconPaths[props.name]
  if (!d) return ''
  const color = props.color || (globalConfig.value.theme === 'dark' ? THEME_ICON_COLOR.dark : THEME_ICON_COLOR.light)
  const markup =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${ICON_VIEW_BOX}" ` +
    `width="${iconSize.value}" height="${iconSize.value}" fill="${color}">` +
    `<path d="${d}"/></svg>`
  return sanitizeSvgContent(markup)
})

function handleClick(event: any) {
  emit('click', event)
}
</script>

<template>
  <view :class="rootClass" :style="rootStyle" @click="handleClick">
    <image v-if="isImage" class="wd-icon__image" :src="name" />
    <svg v-else-if="hasBuiltin" :content="svgContent" />
  </view>
</template>
