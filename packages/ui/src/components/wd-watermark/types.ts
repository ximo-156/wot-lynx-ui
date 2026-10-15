import type { ExtractPropTypes } from 'vue-lynx'
import { baseProps, makeNumberProp, makeStringProp } from '../../common/props'

export const watermarkProps = {
  ...baseProps,
  /**
   * 水印文字
   */
  content: makeStringProp(''),
  /**
   * 水印图片
   */
  image: makeStringProp(''),
  /**
   * 图片高度
   */
  imageHeight: makeNumberProp(100),
  /**
   * 图片宽度
   */
  imageWidth: makeNumberProp(100),
  /**
   * 水平间距
   */
  gutterX: makeNumberProp(0),
  /**
   * 垂直间距
   */
  gutterY: makeNumberProp(0),
  /**
   * 单块宽度
   */
  width: makeNumberProp(100),
  /**
   * 单块高度
   */
  height: makeNumberProp(100),
  /**
   * 旋转角度
   */
  rotate: makeNumberProp(-22),
  /**
   * 透明度
   */
  opacity: makeNumberProp(0.2),
  /**
   * 字体大小
   */
  fontSize: makeNumberProp(14),
  /**
   * 字体颜色
   */
  color: makeStringProp('#171B26')
}

export type WatermarkProps = ExtractPropTypes<typeof watermarkProps>
