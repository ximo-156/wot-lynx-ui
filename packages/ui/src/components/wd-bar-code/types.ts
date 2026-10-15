import type { ExtractPropTypes } from 'vue-lynx'
import { baseProps, makeBooleanProp, makeNumberProp, makeStringProp, numericProp } from '../../common/props'

export const barCodeProps = {
  ...baseProps,
  /**
   * 条码内容
   */
  text: makeStringProp(''),
  /**
   * 宽度
   */
  width: numericProp,
  /**
   * 高度
   */
  height: numericProp,
  /**
   * 前景色
   */
  color: makeStringProp('#000000'),
  /**
   * 背景色
   */
  background: makeStringProp('#FFFFFF'),
  /**
   * 是否显示文本
   */
  showText: makeBooleanProp(true),
  /**
   * 字体大小
   */
  fontSize: makeNumberProp(12)
}

export type BarCodeProps = ExtractPropTypes<typeof barCodeProps>
