import type { ExtractPropTypes } from 'vue-lynx'
import { baseProps, makeStringProp } from '../../common/props'

export const emptyProps = {
  ...baseProps,
  /**
   * 图标名称
   */
  icon: makeStringProp('folder-close'),
  /**
   * 图标类名前缀
   */
  iconPrefix: String,
  /**
   * CSS 图标类名
   */
  cssIcon: {
    type: [Boolean, String],
    default: false
  },
  /**
   * 图标大小
   */
  iconSize: [String, Number],
  /**
   * 提示文字
   */
  tip: makeStringProp('')
}

export type EmptyProps = ExtractPropTypes<typeof emptyProps>
