/* 根节点主题镜像；使用纯注入不参加父子排序。
 * CSS 自定义属性走 `style` 属性字符串通道（见 composables/useCssVarHost），
 * 普通 customStyle 走对象通道；两者键集互不重叠，逐元素 Style Funnel 支持撤回。
 */
<script lang="ts" setup>
import './index.css'
import { computed } from 'vue-lynx'
import { rootPortalProps } from './types'
import { useGlobalConfig } from '../../composables/useGlobalConfig'
import { useCssVarHost } from '../../composables/useCssVarHost'
import { mapThemeVarsToCSSVars } from '../../composables/useConfigProvider'
import { parseStyle } from '../../common/util'
import { createStyleResolver } from '../../common/style'

const props = defineProps(rootPortalProps)
const globalConfig = useGlobalConfig()
const themeClass = computed(() => `wot-theme-${globalConfig.value.theme || 'light'}`)
const themeStyle = computed(() => mapThemeVarsToCSSVars(globalConfig.value.themeVars) || {})
const customStyle = computed(() => parseStyle(props.customStyle))
const resolveRootStyle = createStyleResolver()
/** 普通样式（对象通道）；`--*` 变量由属性通道下发 */
const rootStyle = computed(() => resolveRootStyle(themeStyle.value, customStyle.value))
const { hostId } = useCssVarHost(() => [themeStyle.value, customStyle.value], () => rootStyle.value)
</script>
<template>
  <view :class="`wd-root-portal ${themeClass} ${customClass}`" :style="rootStyle" :wd-css-vars="hostId"><slot /></view>
</template>
