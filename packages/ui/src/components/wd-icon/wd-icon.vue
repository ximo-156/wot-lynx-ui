/*
 * wd-icon — 官方字体图标 + 本地扩展。
 * 官方 2.3.2 的 305 个字形随包发布并以原生 text 渲染，避免伪元素依赖；
 * iconfont: 前缀保留原扩展集合。SVG 扩展显式读取主题变量；任意 CSS 类的
 * currentColor 无法直接解析到 SVG content，须传 color 或 themeVars。
 */
<script lang="ts" setup>
import './index.css'
import '../../icons/fonts/iconfont.css'
import '../../icons/fonts/wot-icons.css'
import { computed, normalizeClass } from 'vue-lynx'
import { iconProps } from './types'
import { addUnit, isDef, sanitizeSvgContent, parseStyle } from '../../common/util'
import { defineStyleKeys, resolveStyle } from '../../common/style'
import { resolveIcon } from '../../icons/registry'
import { THEME_ICON_COLOR } from '../../common/theme'
import { useGlobalConfig } from '../../composables/useGlobalConfig'

const props = defineProps(iconProps)
const emit = defineEmits(['click', 'touch', 'tap'])
const globalConfig = useGlobalConfig()
const isImage = computed(() => !props.cssIcon && isDef(props.name) && props.name.includes('/'))
const resolvedIcon = computed(() => props.cssIcon || isImage.value || !isDef(props.name) ? null : resolveIcon(props.name))
const isSvgIcon = computed(() => resolvedIcon.value?.type === 'svg')
const isFontIcon = computed(() => resolvedIcon.value?.type === 'font')
const themeColor = computed(() => globalConfig.value.themeVars.iconMain || globalConfig.value.themeVars.textMain ||
  (globalConfig.value.theme === 'dark' ? THEME_ICON_COLOR.dark : THEME_ICON_COLOR.light))
const rootClass = computed(() => {
  const classes: Record<string, boolean> = { 'wd-icon': true }
  if (props.cssIcon) { classes['wd-icon--css'] = true; classes[typeof props.cssIcon === 'string' ? props.cssIcon : props.name] = true }
  else if (isImage.value) classes['wd-icon--image'] = true
  else { classes[props.classPrefix] = true; classes[`${props.classPrefix}-${props.name.replace(/:/g, '-')}`] = true }
  return normalizeClass([classes, props.customClass])
})
const iconSize = computed(() => props.size ? addUnit(props.size) : (globalConfig.value.themeVars.iconFontSize || '14px'))
const ROOT_STYLE = defineStyleKeys({ color: '', 'font-size': '', width: '', height: '' })
const rootStyle = computed(() => resolveStyle(ROOT_STYLE, {
  color: props.color,
  'font-size': props.size ? iconSize.value : '',
  width: props.size && (props.cssIcon || isImage.value) ? iconSize.value : '',
  height: props.size && (props.cssIcon || isImage.value) ? iconSize.value : ''
}, parseStyle(props.customStyle)))
const svgContent = computed(() => {
  const icon = resolvedIcon.value
  if (icon?.type !== 'svg') return ''
  const customColor = parseStyle(props.customStyle).color
  return sanitizeSvgContent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${icon.viewBox}" width="${iconSize.value}" height="${iconSize.value}" fill="${customColor || props.color || themeColor.value}">${icon.paths.map((d) => `<path d="${d}"/>`).join('')}</svg>`)
})
const glyph = computed(() => resolvedIcon.value?.type === 'font' ? String.fromCharCode(parseInt(resolvedIcon.value.unicode, 16)) : '')
const GLYPH_STYLE = defineStyleKeys({ fontFamily: '', lineHeight: '1', fontSize: '', color: '' })
const glyphStyle = computed(() => resolveStyle(GLYPH_STYLE, {
  fontFamily: resolvedIcon.value?.type === 'font' ? resolvedIcon.value.fontFamily : '',
  fontSize: props.size ? iconSize.value : '', color: props.color
}))
function handleClick(event: any) { emit('click', event); emit('tap', event) }
</script>
<template>
  <view :class="rootClass" :style="rootStyle" @tap="handleClick">
    <image v-if="isImage" class="wd-icon__image" :src="name" />
    <svg v-else-if="isSvgIcon" class="wd-icon__svg" :content="svgContent" :style="{ width: iconSize, height: iconSize }" />
    <text v-else-if="isFontIcon" class="wd-icon__glyph" :style="glyphStyle">{{ glyph }}</text>
  </view>
</template>
