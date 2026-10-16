/*
 * wd-icon — 图标
 *
 * Lynx 实现说明：
 * - 内置图标经图标注册表（icons/registry.ts）解析，两种渲染形态：
 *   - SVG 集（wot 集 302 个）：经原生 svg 元素的 content 属性渲染，
 *     content 标记过 sanitizeSvgContent 安全网（SVG 元素白名单，见 CONVENTIONS §8）；
 *   - 字体集（iconfont 集 180 个）：.ttf 字体图标（fonts/iconfont.ttf），
 *     Lynx CSS 不支持 ::before/::after，码点字形直接作为 text 子节点渲染；
 * - 寻址：不带前缀按注册顺序回退（wot 优先）；带 `集合键:图标名` 前缀
 *   （如 `iconfont:menu`）精确命中指定集合，取用与 wot 集重名的字形；
 * - svg content 不继承 CSS 变量/currentColor，未传 color 时按主题取
 *   --wd-icon-1 的对应值（common/theme.ts 镜像常量）；
 * - name 含 '/' 按图片渲染原生 image 元素；cssIcon 走 CSS 类名模式。
 */
<script lang="ts" setup>
import './index.css'
import '../../icons/fonts/iconfont.css'

import { computed, normalizeClass } from 'vue-lynx'
import { iconProps } from './types'
import { addUnit, isDef, sanitizeSvgContent, filterStyle, parseStyle } from '../../common/util'
import { resolveIcon } from '../../icons/registry'
import { THEME_ICON_COLOR } from '../../common/theme'
import { useGlobalConfig } from '../../composables/useGlobalConfig'

const props = defineProps(iconProps)
const emit = defineEmits(['click', 'touch', 'tap'])

const globalConfig = useGlobalConfig()

const DEFAULT_ICON_SIZE = 20

const isImage = computed(() => {
  return !props.cssIcon && isDef(props.name) && props.name.includes('/')
})

const resolvedIcon = computed(() => {
  if (props.cssIcon || isImage.value || !isDef(props.name)) return null
  return resolveIcon(props.name)
})

const isSvgIcon = computed(() => resolvedIcon.value?.type === 'svg')
const isFontIcon = computed(() => resolvedIcon.value?.type === 'font')

/** 主题默认色（svg content 与字体字形均不继承 CSS 变量，需 JS 侧计算） */
const iconColor = computed(() => {
  return props.color || (globalConfig.value.theme === 'dark' ? THEME_ICON_COLOR.dark : THEME_ICON_COLOR.light)
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
    // 命名空间名字（如 iconfont:menu）中的 ':' 不是合法类名字符，替换为 '-'
    clazz[`${props.classPrefix}-${props.name.replace(/:/g, '-')}`] = true
  }

  return normalizeClass([clazz, props.customClass])
})

const iconSize = computed(() => {
  return props.size ? addUnit(props.size) : `${DEFAULT_ICON_SIZE}px`
})

const rootStyle = computed(() => {
  const style: Record<string, string> = {}
  if (iconColor.value) {
    style['color'] = iconColor.value
  }
  if (props.size) {
    style['font-size'] = iconSize.value
    // CSS 图标和图片模式下，同步设置 width/height
    if (props.cssIcon || isImage.value) {
      style['width'] = iconSize.value
      style['height'] = iconSize.value
    }
  }
  return { ...filterStyle(style), ...parseStyle(props.customStyle) }
})

const svgContent = computed(() => {
  const icon = resolvedIcon.value
  if (icon?.type !== 'svg') return ''
  // 多 path 图标逐个渲染，fill 在 svg 上统一注入
  const paths = icon.paths.map((d) => `<path d="${d}"/>`).join('')
  const markup =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${icon.viewBox}" ` +
    `width="${iconSize.value}" height="${iconSize.value}" fill="${iconColor.value}">` +
    `${paths}</svg>`
  return sanitizeSvgContent(markup)
})

/** 字体图标：码点（hex）-> 字形字符 */
const glyph = computed(() => {
  const icon = resolvedIcon.value
  if (icon?.type !== 'font') return ''
  return String.fromCharCode(parseInt(icon.unicode, 16))
})

/** 字体字形样式：族名/字号/颜色显式设置（Lynx text 不依赖继承） */
const glyphStyle = computed(() => {
  const icon = resolvedIcon.value
  if (icon?.type !== 'font') return {}
  return {
    ...filterStyle({
      fontFamily: icon.fontFamily,
      fontSize: iconSize.value,
      color: iconColor.value,
      // line-height 取字号，避免 line-box 撑高图标容器
      lineHeight: iconSize.value
    })
  }
})

function handleClick(event: any) {
  emit('click', event)
  emit('tap', event)
}
</script>

<template>
  <view :class="rootClass" :style="rootStyle" @tap="handleClick">
    <image v-if="isImage" class="wd-icon__image" :src="name" />
    <svg v-else-if="isSvgIcon" :content="svgContent" />
    <text v-else-if="isFontIcon" class="wd-icon__glyph" :style="glyphStyle">{{ glyph }}</text>
  </view>
</template>
