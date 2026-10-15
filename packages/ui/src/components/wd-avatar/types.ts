import type { ExtractPropTypes, PropType } from 'vue-lynx'
import { baseProps, makeStringProp, numericProp } from '../../common/props'

export type AvatarShape = 'circle' | 'square' | 'round'

export const avatarProps = {
  ...baseProps,
  /**
   * 图片地址
   */
  src: makeStringProp(''),
  /**
   * 文本
   */
  text: makeStringProp(''),
  /**
   * 尺寸
   */
  size: numericProp,
  /**
   * 形状
   */
  shape: String as PropType<AvatarShape>,
  /**
   * 背景色
   */
  bgColor: makeStringProp(''),
  /**
   * 文字颜色
   */
  color: makeStringProp(''),
  /**
   * 图标名称
   */
  icon: makeStringProp(''),
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
   * 替代文本
   */
  alt: makeStringProp('')
}

export type AvatarProps = ExtractPropTypes<typeof avatarProps>
