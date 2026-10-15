import type { ExtractPropTypes } from 'vue-lynx'
import { baseProps, makeBooleanProp, makeStringProp, numericProp } from '../../common/props'

export type ImageMode = 'scaleToFill' | 'aspectFit' | 'aspectFill' | 'widthFix' | 'heightFix' | 'top' | 'bottom' | 'center' | 'left' | 'right'

export const imgProps = {
  ...baseProps,
  /**
   * 原生 image 自定义类名
   */
  customImage: makeStringProp(''),
  /**
   * 图片地址
   */
  src: String,
  /**
   * 预览地址（enablePreview 时）
   */
  previewSrc: String,
  /**
   * 是否圆形
   */
  round: makeBooleanProp(false),
  /**
   * 裁剪模式
   */
  mode: makeStringProp<ImageMode>('scaleToFill'),
  /**
   * 懒加载
   */
  lazyLoad: makeBooleanProp(false),
  /**
   * 宽度
   */
  width: numericProp,
  /**
   * 高度
   */
  height: numericProp,
  /**
   * 圆角
   */
  radius: numericProp,
  /**
   * 是否开启预览
   */
  enablePreview: makeBooleanProp(false),
  /**
   * 长按是否显示菜单
   */
  showMenuByLongpress: makeBooleanProp(false),
  /**
   * 是否显示加载态
   */
  showLoading: makeBooleanProp(true),
  /**
   * 是否显示错误态
   */
  showError: makeBooleanProp(true)
}

export type ImgProps = ExtractPropTypes<typeof imgProps>
