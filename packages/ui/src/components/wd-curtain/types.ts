import type { ExtractPropTypes } from 'vue-lynx'
import { baseProps, makeBooleanProp, makeNumberProp, makeStringProp } from '../../common/props'

export type ClosePosition = 'inset' | 'bottom' | 'top'

export const curtainProps = {
  ...baseProps,
  /**
   * 是否显示
   */
  modelValue: makeBooleanProp(false),
  /**
   * 关闭按钮位置
   */
  closePosition: makeStringProp<ClosePosition>('inset'),
  /**
   * 图片地址
   */
  src: String,
  /**
   * 跳转地址
   */
  to: String,
  /**
   * 宽度
   */
  width: Number,
  /**
   * 点击遮罩是否关闭
   */
  closeOnClickModal: makeBooleanProp(false),
  /**
   * 关闭时是否销毁
   */
  hideWhenClose: makeBooleanProp(true)
}

export type CurtainProps = ExtractPropTypes<typeof curtainProps>
