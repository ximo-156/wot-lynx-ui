import type { ExtractPropTypes, PropType } from 'vue-lynx'
import { baseProps, makeBooleanProp, makeNumberProp, makeStringProp, numericProp } from '../../common/props'

export const qrCodeProps = {
  ...baseProps,
  /**
   * 二维码内容
   */
  text: makeStringProp(''),
  /**
   * 尺寸（px）
   */
  size: numericProp,
  /**
   * 前景色
   */
  color: makeStringProp('#000000'),
  /**
   * 背景色
   */
  background: makeStringProp('#FFFFFF'),
  /**
   * 是否启用渐变（Lynx SVG 白名单不支持 linearGradient，降级为纯色）
   */
  enableGradient: makeBooleanProp(false),
  /**
   * 渐变起始色
   */
  gradientStartColor: makeStringProp('#7F5CFF'),
  /**
   * 渐变结束色
   */
  gradientEndColor: makeStringProp('#6E8FFB'),
  /**
   * 纠错等级（当前固定 M）
   */
  errorLevel: makeStringProp('M')
}

export type QrCodeProps = ExtractPropTypes<typeof qrCodeProps>
