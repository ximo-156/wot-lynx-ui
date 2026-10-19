import { computed, provide, unref, type MaybeRef } from 'vue-lynx'
import { filterStyle } from '../common/util'
import {
  CONFIG_PROVIDER_KEY,
  mergeConfig,
  type ConfigProviderInput,
  type ConfigProviderProvide,
  type ConfigProviderThemeVars,
  type GlobalConfig
} from './global-config'

export { CONFIG_PROVIDER_KEY }
export type { ConfigProviderProvide }

export const kebabCase = (str: string): string => {
  str = str.replace(str.charAt(0), str.charAt(0).toLocaleLowerCase())
  return str
    .replace(/([a-z])([A-Z])/g, (_, p1, p2) => p1 + '-' + p2.toLowerCase())
    .replace(/([a-zA-Z])(\d)/g, '$1-$2')
    .replace(/(\d)([a-zA-Z])/g, '$1-$2')
}

export const mapThemeVarsToCSSVars = (themeVars: Record<string, string>) => {
  if (!themeVars) return
  const cssVars: Record<string, string> = {}
  Object.keys(themeVars).forEach((key) => {
    cssVars[`--wot-${kebabCase(key)}`] = themeVars[key]
  })

  return cssVars
}

export interface UseConfigProviderOptions {
  themeVars?: MaybeRef<ConfigProviderThemeVars>
  theme?: MaybeRef<string>
  button?: MaybeRef<Record<string, any>>
  tag?: MaybeRef<Record<string, any>>
}

export function useConfigProvider(options: UseConfigProviderOptions = {}) {
  const { themeVars, theme, button, tag } = options

  // themeVars 映射为 --wot-* CSS 变量对象（对象语法：字符串 :style 会被
  // vue-lynx patchProp 静默丢弃，themeVars 定制主题整体失效，CONVENTIONS §19）
  const themeStyle = computed<Record<string, string>>(() => {
    const styleObj = mapThemeVarsToCSSVars(unref(themeVars) || {})
    return styleObj ? filterStyle(styleObj) : {}
  })

  const globalConfig = computed<GlobalConfig>(() => {
    return mergeConfig(null, {
      theme: unref(theme) || 'light',
      themeVars: unref(themeVars) || {},
      button: unref(button) || {},
      tag: unref(tag) || {}
    } as ConfigProviderInput)
  })

  provide<ConfigProviderProvide>(CONFIG_PROVIDER_KEY, {
    themeStyle,
    globalConfig
  })
}
