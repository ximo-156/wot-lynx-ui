import type { ExtractPropTypes, PropType } from 'vue-lynx'
import { baseProps, makeBooleanProp, makeNumberProp, makeStringProp, numericProp } from '../../common/props'
import type { PlacementType } from '../wd-popover/types'

export interface TooltipExpose {
  open: () => void
  close: () => void
  updatePosition: () => void
}

export const tooltipProps = {
  ...baseProps,
  /**
   * 是否显示箭头
   */
  visibleArrow: makeBooleanProp(true),
  /**
   * 内容
   */
  content: {
    type: String,
    default: ''
  },
  /**
   * 弹出位置
   */
  placement: makeStringProp<PlacementType>('bottom'),
  /**
   * 偏移量
   */
  offset: {
    type: [Number, Array] as PropType<number | number[]>,
    default: 0
  },
  /**
   * 是否禁用
   */
  disabled: makeBooleanProp(false),
  /**
   * 是否显示关闭按钮
   */
  showClose: makeBooleanProp(false),
  /**
   * 是否显示
   */
  modelValue: makeBooleanProp(false),
  /**
   * 箭头自定义类名
   */
  customArrow: makeStringProp(''),
  /**
   * 气泡自定义类名
   */
  customPop: makeStringProp('')
}

export type TooltipProps = ExtractPropTypes<typeof tooltipProps>
