import type { ExtractPropTypes } from 'vue-lynx'
import { baseProps, makeNumberProp, makeStringProp, numericProp } from '../../common/props'
import type { AvatarShape } from '../wd-avatar/types'

export const avatarGroupProps = {
  ...baseProps,
  /**
   * 最多展示个数（超出折叠）
   */
  maxCount: makeNumberProp(-1),
  /**
   * 折叠时展示的文本
   */
  collapseText: makeStringProp(''),
  /**
   * 形状
   */
  shape: makeStringProp<AvatarShape>('circle'),
  /**
   * 尺寸
   */
  size: numericProp,
  /**
   * 层叠方向
   */
  direction: makeStringProp<'left' | 'right'>('right'),
  /**
   * 是否层叠
   */
  overlap: {
    type: Boolean,
    default: true
  }
}

export type AvatarGroupProps = ExtractPropTypes<typeof avatarGroupProps>
