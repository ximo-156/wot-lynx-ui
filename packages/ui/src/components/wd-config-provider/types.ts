import type { ExtractPropTypes, PropType } from 'vue-lynx'
import { baseProps, makeStringProp } from '../../common/props'
import type {
  ButtonConfig,
  ConfigProviderThemeVars,
  TagConfig
} from '../../composables/global-config'

export const configProviderProps = {
  ...baseProps,
  /**
   * 主题风格，设置为 dark 来开启深色模式，全局生效
   */
  theme: makeStringProp('light'),
  /**
   * 自定义主题变量（camelCase 键，映射为 --wd-* 内联变量）
   */
  themeVars: {
    type: Object as PropType<ConfigProviderThemeVars>,
    default: () => ({})
  },
  /**
   * Button 组件全局配置，支持 size / variant / type / round
   */
  button: {
    type: Object as PropType<ButtonConfig>,
    default: () => ({})
  },
  /**
   * Tag 组件全局配置，支持 size / variant / round
   */
  tag: {
    type: Object as PropType<TagConfig>,
    default: () => ({})
  }
}

export type ConfigProviderProps = ExtractPropTypes<typeof configProviderProps>

// 兼容历史从 wd-config-provider/types 深度导入的用法
export { CONFIG_PROVIDER_KEY } from '../../composables/global-config'
export type { ConfigProviderProvide, ConfigProviderThemeVars } from '../../composables/global-config'
