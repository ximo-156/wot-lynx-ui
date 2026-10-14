<template>
  <!-- H5端使用 teleport -->
  <!-- 小程序使用 root-portal -->
    <view :class="themeClass" :style="styleToObject(configProviderStyle)" class="wd-root-portal">
        <slot />
      </view>
  </template>
<script setup lang="ts">
import './index.css'
import { styleToObject } from '../../common/util'
import { computed, inject } from 'vue-lynx'
import { useParent } from '../../composables/useParent'
import { USE_CONFIG_PROVIDER_KEY } from '../../composables/useConfigProvider'
import { CONFIG_PROVIDER_KEY, type ConfigProviderProvide } from '../wd-config-provider/types'
import { baseProps } from '../../common/props'

const props = defineProps({
  ...baseProps
})

const None = Symbol('None')
const hooksProvider = inject<ConfigProviderProvide | typeof None>(USE_CONFIG_PROVIDER_KEY, None)
const { parent: configProvider } = useParent(CONFIG_PROVIDER_KEY)

const configProviderStyle = computed(() => {
  return hooksProvider !== None ? hooksProvider.themeStyle.value || '' : configProvider.value?.themeStyle.value || ''
})

const themeClass = computed(() => {
  const theme = hooksProvider !== None ? hooksProvider.globalConfig?.value.theme : configProvider.value?.globalConfig?.value.theme
  return theme ? `wot-theme-${theme}` : 'wot-theme-light'
})
</script>

