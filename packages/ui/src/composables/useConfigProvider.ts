import { computed, provide, unref, type MaybeRef } from 'vue-lynx'
import { filterStyle } from '../common/util'
import {
  CONFIG_PROVIDER_KEY, mergeConfig, type ConfigProviderInput, type ConfigProviderProvide,
  type ConfigProviderThemeVars, type ButtonConfig, type TagConfig, type GlobalConfig
} from './global-config'

export { CONFIG_PROVIDER_KEY }
export type { ConfigProviderProvide }
/** 官方 hook 键独立于 useChildren 组件树键，避免注入没有 link/unlink 的对象。 */
export const USE_CONFIG_PROVIDER_KEY = '__CONFIG_PROVIDER__'
export const kebabCase = (str: string): string => {
  str = str.replace(str.charAt(0), str.charAt(0).toLocaleLowerCase())
  // 连续大写（如 zIndex → z-index）必须按「大写+大写小写」边界断开，
  // 否则 backtopZIndex 只产出 --wot-backtop-zIndex，组件消费的
  // --wot-backtop-z-index 永远收不到值（CSS 变量名大小写敏感）。
  return str.replace(/([A-Z])([A-Z][a-z])/g, '$1-$2')
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([a-zA-Z])(\d)/g, '$1-$2').replace(/(\d)([a-zA-Z])/g, '$1-$2')
    .toLowerCase()
}
export const mapThemeVarsToCSSVars = (themeVars: Record<string, string>) => {
  if (!themeVars) return
  const cssVars: Record<string, string> = {}
  Object.keys(themeVars).forEach((key) => { cssVars[`--wot-${kebabCase(key)}`] = themeVars[key] })
  return cssVars
}
export interface UseConfigProviderOptions {
  themeVars?: MaybeRef<ConfigProviderThemeVars>
  theme?: MaybeRef<string>
  button?: MaybeRef<ButtonConfig>
  tag?: MaybeRef<TagConfig>
}
export function useConfigProvider(options: UseConfigProviderOptions = {}) {
  const themeStyle = computed<Record<string, string>>(() => filterStyle(mapThemeVarsToCSSVars(unref(options.themeVars) || {}) || {}))
  const globalConfig = computed<GlobalConfig>(() => mergeConfig(null, {
    theme: unref(options.theme) || 'light', themeVars: unref(options.themeVars) || {},
    button: unref(options.button) || {}, tag: unref(options.tag) || {}
  } as ConfigProviderInput))
  provide<ConfigProviderProvide>(USE_CONFIG_PROVIDER_KEY, { themeStyle, globalConfig })
}
