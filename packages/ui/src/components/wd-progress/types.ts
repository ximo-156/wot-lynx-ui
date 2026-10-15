import type { ExtractPropTypes, PropType } from 'vue-lynx'
import { baseProps, makeBooleanProp, makeNumberProp, makeStringProp } from '../../common/props'

export type ProgressStatus = 'success' | 'danger' | 'warning'

export type ProgressPercentPosition = {
  type?: 'inner' | 'outer'
  align?: 'left' | 'center' | 'right'
}

export const progressProps = {
  ...baseProps,
  /**
   * 百分比（0-100）
   */
  percentage: makeNumberProp(0),
  /**
   * 进度条颜色（对象时为 { left, right } 渐变）
   */
  color: {
    type: [String, Object] as PropType<string | { left: string; right: string }>,
    default: ''
  },
  /**
   * 轨道颜色
   */
  trackColor: makeStringProp(''),
  /**
   * 进度条宽度
   */
  strokeWidth: makeNumberProp(6),
  /**
   * 是否显示文字
   */
  hideText: makeBooleanProp(false),
  /**
   * 状态
   */
  status: String as PropType<ProgressStatus>,
  /**
   * 文字位置
   */
  percentPosition: {
    type: Object as PropType<ProgressPercentPosition>,
    default: () => ({})
  }
}

export type ProgressProps = ExtractPropTypes<typeof progressProps>
