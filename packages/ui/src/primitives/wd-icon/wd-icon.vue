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
import { defineStyleKeys, resolveStyle, createStyleResolver } from '../../common/style'
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
const customStyle = computed(() => parseStyle(props.customStyle))
const iconSize = computed(() => String(customStyle.value['font-size'] || customStyle.value.fontSize ||
  (props.size ? addUnit(props.size) : globalConfig.value.themeVars.iconFontSize || '14px')))
const resolveRootStyle = createStyleResolver({ color: '', 'font-size': '', width: '', height: '' })
const rootStyle = computed(() => resolveRootStyle({
  color: props.color,
  'font-size': props.size ? addUnit(props.size) : '',
  width: props.size && (props.cssIcon || isImage.value) ? addUnit(props.size) : '',
  height: props.size && (props.cssIcon || isImage.value) ? addUnit(props.size) : ''
}, customStyle.value))
const svgContent = computed(() => {
  const icon = resolvedIcon.value
  if (icon?.type !== 'svg') return ''
  const color = customStyle.value.color || props.color || themeColor.value
  return sanitizeSvgContent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${icon.viewBox}" fill="${color}">${icon.paths.map((d) => `<path d="${d}"/>`).join('')}</svg>`)
})
const glyph = computed(() => resolvedIcon.value?.type === 'font' ? String.fromCodePoint(parseInt(resolvedIcon.value.unicode, 16)) : '')
const GLYPH_STYLE = defineStyleKeys({ fontFamily: '', lineHeight: 'inherit', fontSize: 'inherit', color: 'inherit' })
const glyphStyle = computed(() => resolveStyle(GLYPH_STYLE, {
  fontFamily: resolvedIcon.value?.type === 'font' ? resolvedIcon.value.fontFamily : ''
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
