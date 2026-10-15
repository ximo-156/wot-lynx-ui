import type { ComputedRef, InjectionKey } from 'vue-lynx'

/**
 * 全局配置契约（ConfigProvider 的配置模型）。
 *
 * 本文件是 composable 层的共享契约：WdConfigProvider 与各消费组件
 * （useGlobalConfig / useConfigProvider）都从这里导入类型，避免
 * composable 反向依赖组件目录。
 */

/** 按钮类型（与 wd-button 的 type prop 一致） */
export type ButtonType = 'primary' | 'success' | 'info' | 'warning' | 'danger'

/** 按钮变体（与 wd-button 的 variant prop 一致） */
export type ButtonVariant = 'base' | 'plain' | 'dashed' | 'soft' | 'subtle' | 'text'

/** 按钮尺寸（与 wd-button 的 size prop 一致） */
export type ButtonSize = 'mini' | 'small' | 'medium' | 'large'

/** 标签变体（与 wd-tag 的 variant prop 一致） */
export type TagVariant = 'light' | 'dark' | 'plain' | 'dashed' | 'text'

/** 标签尺寸（与 wd-tag 的 size prop 一致） */
export type TagSize = 'small' | 'medium' | 'large' | 'extra-large' | 'default'

/** Button 组件全局配置 */
export interface ButtonConfig {
  size?: ButtonSize
  variant?: ButtonVariant
  type?: ButtonType
  round?: boolean
}

/** Tag 组件全局配置 */
export interface TagConfig {
  size?: TagSize
  variant?: TagVariant
  round?: boolean
}

/**
 * 自定义主题变量：键为 camelCase 令牌名（如 primaryColor），
 * 由 ConfigProvider 映射为 `--wd-<kebab-case>` 内联变量下发。
 */
export type ConfigProviderThemeVars = Record<string, string>

/** 全局配置 */
export interface GlobalConfig {
  theme: string
  themeVars: ConfigProviderThemeVars
  button: ButtonConfig
  tag: TagConfig
}

/** ConfigProvider 入参 */
export type ConfigProviderInput = Partial<GlobalConfig>

export const DEFAULT_GLOBAL_CONFIG: GlobalConfig = Object.freeze({
  theme: 'light',
  themeVars: {},
  button: {},
  tag: {}
}) as GlobalConfig

export function mergeConfig(parent: GlobalConfig | null, input: ConfigProviderInput): GlobalConfig {
  const base = parent || DEFAULT_GLOBAL_CONFIG
  const cleaned = omitUndefined(input) as ConfigProviderInput
  return {
    theme: cleaned.theme || base.theme,
    themeVars: mergeBucket(base.themeVars, cleaned.themeVars),
    button: mergeBucket(base.button, cleaned.button),
    tag: mergeBucket(base.tag, cleaned.tag)
  }
}

// 剔除 override 自身的 undefined 键，避免 `:button="{ size: undefined }"` 抹掉外层已有的值
function mergeBucket<T extends object>(base: T, override?: T): T {
  if (!override) return base
  return { ...base, ...(omitUndefined(override) as T) }
}

function omitUndefined<T extends object>(obj: T): Partial<T> {
  const result: Record<string, unknown> = {}
  for (const key of Object.keys(obj)) {
    if ((obj as Record<string, unknown>)[key] !== undefined) {
      result[key] = (obj as Record<string, unknown>)[key]
    }
  }
  return result as Partial<T>
}

/** ConfigProvider 向下提供的上下文 */
export type ConfigProviderProvide = {
  globalConfig: ComputedRef<GlobalConfig>
  /** themeVars 映射出的 --wd-* 变量（对象样式，CONVENTIONS §19） */
  themeStyle: ComputedRef<Record<string, string>>
}

export const CONFIG_PROVIDER_KEY: InjectionKey<ConfigProviderProvide> = Symbol('wd-config-provider')
