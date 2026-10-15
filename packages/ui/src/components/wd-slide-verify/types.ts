import type { ExtractPropTypes } from 'vue-lynx'
import { baseProps, makeBooleanProp, makeNumberProp, makeStringProp, numericProp } from '../../common/props'

export type SlideVerifyEmits = {
  (e: 'update:modelValue', value: boolean): void
  (e: 'change', value: { value: boolean }): void
  (e: 'success', value: { value: boolean }): void
  (e: 'fail', value: { value: boolean }): void
  (e: 'move', value: { distanceX: number; containerWidth: number }): void
}

export const slideVerifyProps = {
  ...baseProps,
  /**
   * 当前值（是否通过）
   */
  modelValue: makeBooleanProp(false),
  /**
   * 容错像素（距离终点小于该值视为通过）
   */
  tolerance: {
    type: Number,
    default: 4
  },
  /**
   * 提示文字
   */
  text: makeStringProp(''),
  /**
   * 成功提示文字
   */
  successText: makeStringProp(''),
  /**
   * 是否禁用
   */
  disabled: makeBooleanProp(false),
  /**
   * 背景色
   */
  backgroundColor: String,
  /**
   * 滑动后背景色
   */
  activeBackgroundColor: String,
  /**
   * 滑块图标
   */
  icon: makeStringProp('double-right'),
  /**
   * 成功图标
   */
  successIcon: makeStringProp('check-circle-fill'),
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
  iconSize: numericProp,
  /**
   * 成功图标大小
   */
  successIconSize: numericProp
}

export type SlideVerifyProps = ExtractPropTypes<typeof slideVerifyProps>
