import type { ExtractPropTypes } from 'vue-lynx'
import { baseProps, makeBooleanProp, makeNumberProp, makeNumericProp, makeStringProp } from '../../common/props'

export type ImgCropperEmits = {
  (e: 'update:modelValue', value: boolean): void
  (e: 'confirm', value: { src: string; width: number; height: number; x: number; y: number; scale: number }): void
  (e: 'cancel'): void
}

export const imgCropperProps = {
  ...baseProps,
  /**
   * 是否显示
   */
  modelValue: makeBooleanProp(false),
  /**
   * 取消按钮文字
   */
  cancelButtonText: String,
  /**
   * 确认按钮文字
   */
  confirmButtonText: String,
  /**
   * 是否禁用旋转
   */
  disabledRotate: makeBooleanProp(false),
  /**
   * 导出文件类型
   */
  fileType: makeStringProp<'png' | 'jpg'>('png'),
  /**
   * 导出质量（0-1）
   */
  quality: makeNumberProp(1),
  /**
   * 导出缩放
   */
  exportScale: makeNumberProp(2),
  /**
   * 图片地址
   */
  imgSrc: makeStringProp(''),
  /**
   * 图片宽度
   */
  imgWidth: makeNumericProp(''),
  /**
   * 图片高度
   */
  imgHeight: makeNumericProp(''),
  /**
   * 最大缩放
   */
  maxScale: makeNumberProp(3),
  /**
   * 裁剪框宽高比
   */
  aspectRatio: makeStringProp('1:1')
}

export type ImgCropperProps = ExtractPropTypes<typeof imgCropperProps>

export type ImgCropperExpose = {
  revertIsAnimation: (animation: boolean | { value: boolean }) => void
  resetImg: () => void
  setRotate: (angle: number) => void
}
