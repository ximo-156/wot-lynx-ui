/* 根节点主题镜像；纯注入不参加父子排序。
 * CSS 变量与 customStyle 同走原生对象通道，逐元素 Style Funnel 支持撤回。
 * 不查询 DOM，避免后台线程不可用及多个 portal 错写同一节点。
 */
<script lang="ts" setup>
import './index.css'
import { computed } from 'vue-lynx'
import { rootPortalProps } from './types'
import { useGlobalConfig } from '../../composables/useGlobalConfig'
import { mapThemeVarsToCSSVars } from '../../composables/useConfigProvider'
import { parseStyle } from '../../common/util'
import { createStyleResolver } from '../../common/style'

const props = defineProps(rootPortalProps)
const globalConfig = useGlobalConfig()
const themeClass = computed(() => `wot-theme-${globalConfig.value.theme || 'light'}`)
const themeStyle = computed(() => mapThemeVarsToCSSVars(globalConfig.value.themeVars) || {})
const customStyle = computed(() => parseStyle(props.customStyle))
const resolveRootStyle = createStyleResolver()
/** 原生对象通道同时下发主题变量与普通覆盖。 */
const rootStyle = computed(() => resolveRootStyle(themeStyle.value, customStyle.value))
</script>
<template>
  <view :class="`wd-root-portal ${themeClass} ${customClass}`" :style="rootStyle"><slot /></view>
</template>
