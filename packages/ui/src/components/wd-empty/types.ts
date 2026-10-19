import type { ExtractPropTypes, PropType } from 'vue-lynx'
import { baseProps, makeStringProp } from '../../common/props'

export const emptyProps = {
  ...baseProps,
  /**
   * 缺省图片类型，支持传入图片 URL。
   * 类型: string
   * 可选值: 图标名或URL
   * 默认值: empty
   */
  icon: makeStringProp('empty'),
  /**
   * 图标类名前缀，用法参考 Icon 组件。
   * 类型: string
   */
  iconPrefix: String,
  /**
   * CSS 图标，用法参考 Icon 组件。
   * 类型: boolean | string
   * 默认值: false
   */
  cssIcon: {
    type: [Boolean, String] as PropType<boolean | string>,
    default: false
  },
  /**
   * 图片大小，默认单位为 px。
   * 类型: string 或 number
   * 默认值: 空字符串
   */
  iconSize: [String, Number] as PropType<string | number>,
  /**
   * 提示文案。
   * 类型: string
   * 默认值: 空字符串
   */
  tip: makeStringProp('')
}

export type EmptyProps = ExtractPropTypes<typeof emptyProps>
