import { computed, inject, type ComputedRef } from 'vue-lynx'
import {
  CONFIG_PROVIDER_KEY,
  DEFAULT_GLOBAL_CONFIG,
  type ConfigProviderProvide,
  type GlobalConfig
} from './global-config'

import { USE_CONFIG_PROVIDER_KEY } from './useConfigProvider'

export function useGlobalConfig(): ComputedRef<GlobalConfig> {
  const injected = inject<ConfigProviderProvide | null>(CONFIG_PROVIDER_KEY, null)
  if (injected) return injected.globalConfig
  const hook = inject<ConfigProviderProvide | null>(USE_CONFIG_PROVIDER_KEY, null)
  return hook?.globalConfig || computed(() => ({ ...DEFAULT_GLOBAL_CONFIG }))
}
