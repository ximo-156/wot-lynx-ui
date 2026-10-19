/*
 * wd-icon — 图标
 *
 * Lynx 实现说明（相对 wot-ui 的适配点）：
 * - 内置图标经图标注册表（icons/registry.ts）解析，两种渲染形态：
 *   - 内置 iconfont 集（180 个）：.ttf 字体图标（fonts/iconfont.ttf），
 *     Lynx CSS 不支持 ::before/::after，码点字形直接作为 text 子节点渲染；
 *   - SVG 集（registerIconSet 扩展注册）：经原生 svg 元素的 content 渲染，
 *     content 标记过 sanitizeSvgContent 安全网（SVG 元素白名单，见 CONVENTIONS §8）；
 * - 寻址：不带前缀按注册顺序回退（内置集优先）；带 `集合键:图标名` 前缀
 *   （如 `iconfont:menu`）精确命中指定集合；
 * - 尺寸/颜色语义与 wot-ui 一致：默认由 CSS 承担（根视图 font-size 即
 *   --wot-icon-font-size，默认 14px；消费方经 custom-class 的 font-size /
 *   color 覆盖），仅当 color / size prop 显式传入时才写内联（内联优先级
 *   高于类，prop 优先是 wot-ui 的既定语义）。这依赖宿主开启
 *   enableCSSInheritance（README 快速上手的必需配置）：Lynx 默认不开 CSS
 *   继承，text 不继承父视图的文本样式；
 * - 字体字形需显式 font-family（注册表给出族名）；line-height 显式置 1，
 *   避免 line-box 撑高图标容器；
 * - svg content 不继承 CSS 变量 / currentColor，SVG 集的填充色由 JS 侧
 *   按 color prop 或主题默认色（common/theme.ts 镜像）注入——SVG 集为本地
 *   扩展能力，CSS 类的 color 覆盖不影响其填充色；
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

/** 默认图标尺寸：与 --wot-icon-font-size 的默认值（typography-body-size-main = 14px）一致 */
const DEFAULT_ICON_SIZE = '14px'

const isImage = computed(() => {
  return !props.cssIcon && isDef(props.name) && props.name.includes('/')
})

const resolvedIcon = computed(() => {
  if (props.cssIcon || isImage.value || !isDef(props.name)) return null
  return resolveIcon(props.name)
})

const isSvgIcon = computed(() => resolvedIcon.value?.type === 'svg')
const isFontIcon = computed(() => resolvedIcon.value?.type === 'font')

/** 主题默认色（svg content 不继承 CSS 变量，需 JS 侧计算） */
const themeColor = computed(() =>
  globalConfig.value.theme === 'dark' ? THEME_ICON_COLOR.dark : THEME_ICON_COLOR.light
)

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
  return props.size ? addUnit(props.size) : DEFAULT_ICON_SIZE
})

const rootStyle = computed(() => {
  const style: Record<string, string> = {}
  // 仅 prop 显式传入时写内联；未传时由 CSS 类（custom-class / 组件样式）承担
  if (isDef(props.color)) {
    style['color'] = props.color
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
    `width="${iconSize.value}" height="${iconSize.value}" fill="${isDef(props.color) ? props.color : themeColor.value}">` +
    `${paths}</svg>`
  return sanitizeSvgContent(markup)
})

/** 字体图标：码点（hex）-> 字形字符 */
const glyph = computed(() => {
  const icon = resolvedIcon.value
  if (icon?.type !== 'font') return ''
  return String.fromCharCode(parseInt(icon.unicode, 16))
})

/** 字体字形样式：族名显式设置（Lynx text 不依赖继承）；字号/颜色仅在 prop 传入时内联 */
const glyphStyle = computed(() => {
  const icon = resolvedIcon.value
  if (icon?.type !== 'font') return {}
  const style: Record<string, string> = {
    fontFamily: icon.fontFamily,
    // line-height 取 1，避免 line-box 撑高图标容器（与 wot-ui 根视图一致）
    lineHeight: '1'
  }
  if (props.size) {
    style.fontSize = iconSize.value
  }
  if (isDef(props.color)) {
    style.color = props.color
  }
  return filterStyle(style)
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
