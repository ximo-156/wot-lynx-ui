/*
 * wd-config-provider — 全局配置
 *
 * Lynx 实现说明：
 * - 根 view 挂 wd-theme-light / wd-theme-dark 类切换语义令牌（见 styles/tokens）；
 * - themeVars 经 mapThemeVarsToCSSVars 映射为 --wd-* 内联变量下发；
 * - 嵌套 ConfigProvider 经 useParent 读取上层配置并 merge；
 * - position: fixed 弹层被提升到页面根节点后会脱离本子树，
 *   主题变量由 .wd-root-portal 容器镜像（见 _semantic.scss）。
 */
<script lang="ts" setup>
import './index.css'

import { computed } from 'vue-lynx'
import { configProviderProps } from './types'
import { objToStyle } from '../../common/util'
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
  return `wd-theme-${props.theme}${props.customClass ? ' ' + props.customClass : ''}`
})

const themeStyle = computed(() => {
  const styleObj = mapThemeVarsToCSSVars(props.themeVars)
  return styleObj ? objToStyle(styleObj) : ''
})

const rootStyle = computed(() => {
  return `${themeStyle.value}${props.customStyle || ''}`
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
