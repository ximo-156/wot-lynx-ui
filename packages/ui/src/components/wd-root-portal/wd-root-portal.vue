/*
 * wd-root-portal — 根节点容器
 *
 * Lynx 实现说明：
 * - Lynx 中 position: fixed 节点会被引擎自动提升到页面根节点，
 *   不需要 teleport / root-portal 元素；本组件仅作为「携带主题变量的容器」：
 *   弹层被提升到根节点后会脱离 ConfigProvider 子树，靠本容器镜像的
 *   主题类与 themeVars 内联变量保持亮暗主题一致（CONVENTIONS §3）。
 */
<script lang="ts" setup>
import './index.css'

import { computed } from 'vue-lynx'
import { rootPortalProps } from './types'
import { useParent } from '../../composables/useParent'
import { CONFIG_PROVIDER_KEY } from '../../composables/global-config'
import { parseStyle } from '../../common/util'

const props = defineProps(rootPortalProps)

const { parent: configProvider } = useParent(CONFIG_PROVIDER_KEY)

const configProviderStyle = computed(() => {
  return configProvider.value?.themeStyle.value || ''
})

const themeClass = computed(() => {
  const theme = configProvider.value?.globalConfig?.value.theme
  return theme ? `wot-theme-${theme}` : 'wot-theme-light'
})

/** 主题变量 + customStyle 合并为对象（字符串 :style 会被丢弃，CONVENTIONS §19） */
const rootStyle = computed(() => ({
  ...parseStyle(configProviderStyle.value),
  ...parseStyle(props.customStyle)
}))
</script>

<template>
  <view :class="`wd-root-portal ${themeClass} ${customClass}`" :style="rootStyle">
    <slot />
  </view>
</template>
