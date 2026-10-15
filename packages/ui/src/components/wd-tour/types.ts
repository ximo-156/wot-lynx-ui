import type { ExtractPropTypes } from 'vue-lynx'
import { baseProps, makeArrayProp, makeBooleanProp, makeNumberProp, makeStringProp } from '../../common/props'

export interface TourStep {
  /** 目标元素选择器 */
  element: string
  /** 提示内容 */
  content: string
  /** 标题 */
  title?: string
  /** 高亮边距 */
  offset?: number
  /** 提示位置 */
  placement?: string
}

export const tourProps = {
  ...baseProps,
  /**
   * 是否显示
   */
  modelValue: makeBooleanProp(false),
  /**
   * 步骤配置
   */
  steps: makeArrayProp<TourStep>(),
  /**
   * 当前步骤索引
   */
  current: makeNumberProp(0),
  /**
   * 是否显示遮罩
   */
  mask: makeBooleanProp(true),
  /**
   * 遮罩颜色
   */
  maskColor: String,
  /**
   * 高亮边距
   */
  offset: makeNumberProp(20),
  /**
   * 动画时长（ms）
   */
  duration: makeNumberProp(300),
  /**
   * 高亮圆角
   */
  borderRadius: makeNumberProp(12),
  /**
   * 下一步文字
   */
  nextText: String,
  /**
   * 上一步文字
   */
  prevText: String,
  /**
   * 完成文字
   */
  finishText: String
}

export type TourProps = ExtractPropTypes<typeof tourProps>
