<template>
  <view :class="themeClass" :style="styleToObject(rootStyle)">
    <slot />
  </view>
</template>

<script setup lang="ts">
import './index.css'
import { computed, inject } from 'vue-lynx'
import { configProviderProps, CONFIG_PROVIDER_KEY, type ConfigProviderProvide } from './types'
import { styleToObject, objToStyle } from '../../common/util'
import { useChildren } from '../../composables/useChildren'
import { useParent } from '../../composables/useParent'
import { mapThemeVarsToCSSVars } from '../../composables/useConfigProvider'
import { USE_CONFIG_PROVIDER_KEY } from '../../composables/useConfigProvider'
import { mergeConfig, type ConfigProviderInput, type GlobalConfig } from './global-config'

const None = Symbol('None')
const hooksProvider = inject<ConfigProviderProvide | typeof None>(USE_CONFIG_PROVIDER_KEY, None)
const props = defineProps(configProviderProps)

const { linkChildren } = useChildren(CONFIG_PROVIDER_KEY)
const { parent: parentConfigProvider } = useParent(CONFIG_PROVIDER_KEY)

const themeClass = computed(() => {
  return `wot-theme-${props.theme} ${props.customClass}`
})

const themeStyle = computed(() => {
  if (hooksProvider !== None) {
    return hooksProvider.themeStyle.value
  }
  const styleObj = mapThemeVarsToCSSVars(props.themeVars)
  return styleObj ? `${objToStyle(styleObj)}` : ''
})

const rootStyle = computed(() => {
  const style = `${themeStyle.value}${props.customStyle}`
  return style
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

