import type { ExtractPropTypes, PropType } from 'vue-lynx'
import { baseProps, makeArrayProp, makeBooleanProp, makeNumberProp, makeStringProp } from '../../common/props'

export type SkeletonTheme = 'text' | 'image' | 'button' | 'list' | 'card' | 'custom'

export type SkeletonRowCol = number | { width?: string | number; height?: string | number; size?: string | number; shape?: string }

export type SkeletonAnimation = 'gradient' | 'flashing' | 'pulse' | 'none'

export const skeletonProps = {
  ...baseProps,
  /**
   * 主题
   */
  theme: makeStringProp<SkeletonTheme>('text'),
  /**
   * 行列配置
   */
  rowCol: makeArrayProp<SkeletonRowCol>(),
  /**
   * 是否加载中
   */
  loading: makeBooleanProp(true),
  /**
   * 动画类型
   */
  animation: {
    type: String as PropType<SkeletonAnimation>,
    default: 'gradient'
  },
  /**
   * 圆角
   */
  round: makeBooleanProp(false)
}

export type SkeletonProps = ExtractPropTypes<typeof skeletonProps>
