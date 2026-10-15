import type { ExtractPropTypes, PropType } from 'vue-lynx'
import { baseProps, makeBooleanProp, makeNumberProp, makeStringProp, numericProp } from '../../common/props'

export type PlacementType =
  | 'top'
  | 'left'
  | 'right'
  | 'bottom'
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right'
  | 'left-top'
  | 'left-bottom'
  | 'right-top'
  | 'right-bottom'

export type PopoverMode = 'normal' | 'menu'

export interface PopoverMenuItem {
  iconClass?: string
  content?: string
}

export interface PopoverExpose {
  open: () => void
  close: () => void
  updatePosition: () => void
}

export const popoverProps = {
  ...baseProps,
  /**
   * 是否显示箭头
   */
  visibleArrow: makeBooleanProp(true),
  /**
   * 内容（normal 为文本，menu 为菜单项数组）
   */
  content: {
    type: [String, Array] as PropType<string | PopoverMenuItem[]>,
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
   * 模式
   */
  mode: makeStringProp<PopoverMode>('normal'),
  /**
   * 箭头自定义类名
   */
  customArrow: makeStringProp(''),
  /**
   * 气泡自定义类名
   */
  customPop: makeStringProp('')
}

export type PopoverProps = ExtractPropTypes<typeof popoverProps>
