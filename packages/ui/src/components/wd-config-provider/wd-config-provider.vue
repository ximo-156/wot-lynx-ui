/*
 * wd-config-provider — 全局配置
 *
 * Lynx 实现说明：
 * - 根 view 挂 wot-theme-light / wot-theme-dark 类切换语义令牌（见 styles/theme）；
 * - themeVars 经 mapThemeVarsToCSSVars 映射为 --wot-* 内联变量下发；
 * - 嵌套 ConfigProvider 经 useParent 读取上层配置并 merge；
 * - position: fixed 弹层被提升到页面根节点后会脱离本子树，
 *   主题变量由 .wd-root-portal 容器镜像（见 styles/theme/index.scss）。
 */
<script lang="ts" setup>
import './index.css'

import { computed } from 'vue-lynx'
import { configProviderProps } from './types'
import { filterStyle, parseStyle } from '../../common/util'
import { useChildren } from '../../composables/useChildren'
import { useParent } from '../../composables/useParent'
import { mapThemeVarsToCSSVars } from '../../composables/useConfigProvider'
import {
  CONFIG_PROVIDER_KEY,
  mergeConfig,
  type ConfigProviderInput,
  type GlobalConfig
} from '../../composables/global-config'

const props = defineProps(configProviderProps)

const { linkChildren } = useChildren(CONFIG_PROVIDER_KEY)
const { parent: parentConfigProvider } = useParent(CONFIG_PROVIDER_KEY)

const themeClass = computed(() => {
  // wd-config-provider 必须入栈：index.scss 的根容器布局声明
  // （height:100%; display:flex; flex-direction:column）以该类为选择器，
  // 缺失时整组声明被静默丢弃（CONVENTIONS §5 类名错配）。
  return `wd-config-provider wot-theme-${props.theme}${props.customClass ? ' ' + props.customClass : ''}`
})

const themeStyle = computed<Record<string, string>>(() => {
  const styleObj = mapThemeVarsToCSSVars(props.themeVars)
  return styleObj ? filterStyle(styleObj) : {}
})

const rootStyle = computed(() => {
  return { ...themeStyle.value, ...parseStyle(props.customStyle) }
})

const globalConfig = computed<GlobalConfig>(() => {
  const parentGlobalConfig = parentConfigProvider.value?.globalConfig.value || null
  return mergeConfig(parentGlobalConfig, {
    theme: props.theme,
    themeVars: props.themeVars,
    button: props.button,
    tag: props.tag
  } as ConfigProviderInput)
})

linkChildren({
  themeStyle,
  globalConfig
})
</script>

<template>
  <view :class="themeClass" :style="rootStyle">
    <slot />
  </view>
</template>
