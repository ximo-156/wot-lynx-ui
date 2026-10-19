import type { ComponentPublicInstance, ExtractPropTypes } from 'vue-lynx'
import { baseProps, makeBooleanProp, makeNumberProp, makeNumericProp, makeStringProp } from '../../common/props'

export const imgCropperProps = {
  ...baseProps,
  /**
   * 打开图片裁剪组件
   * 类型: boolean
   * 默认值: false
   */
  modelValue: makeBooleanProp(false),
  /**
   * 取消按钮文案
   * 类型: string
   * 默认值: '取消'
   */
  cancelButtonText: String,
  /**
   * 确认按钮文案
   * 类型: string
   * 默认值: '确认'
   */
  confirmButtonText: String,
  /**
   * 是否禁用旋转功能
   * 类型: boolean
   * 默认值: false
   */
  disabledRotate: makeBooleanProp(false),
  /**
   * Canvas 输出文件类型
   * 类型: string
   * 可选值: 'png' | 'jpg' | 'jpeg'
   * 默认值: 'png'
   *
   * Lynx 实现说明：无 canvas 导出能力，该 prop 与 quality 仅保留声明
   * （API 对齐），对 confirm 的裁剪参数不生效。
   */
  fileType: makeStringProp('png'),
  /**
   * Canvas 图片输出质量，范围 0-1
   * 类型: number
   * 默认值: 1
   *
   * Lynx 实现说明：同上，canvas 导出专有 props，保留声明不生效。
   */
  quality: makeNumberProp(1),
  /**
   * 导出图片的缩放倍数
   * 类型: number
   * 默认值: 2
   */
  exportScale: makeNumberProp(2),
  /**
   * 图片源路径
   * 类型: string
   * 默认值: ''
   */
  imgSrc: makeStringProp(''),
  /**
   * 图片初始宽度（支持 px 和 % 单位）
   * 类型: string | number
   * 默认值: ''
   */
  imgWidth: makeNumericProp(''),
  /**
   * 图片初始高度（支持 px 和 % 单位）
   * 类型: string | number
   * 默认值: ''
   */
  imgHeight: makeNumericProp(''),
  /**
   * 图片最大缩放倍数
   * 类型: number
   * 默认值: 3
   */
  maxScale: makeNumberProp(3),
  /**
   * 裁剪框宽高比
   * 类型: string
   * 格式: 'width:height' (如 '1:1', '16:9')
   * 默认值: '1:1'
   */
  aspectRatio: makeStringProp('1:1')
}

export type ImgCropperProps = ExtractPropTypes<typeof imgCropperProps>

/**
 * 裁剪结果
 *
 * Lynx 实现说明：无 canvas 2D 能力（CONVENTIONS §12 降级），confirm 不产出
 * 位图文件：tempFilePath 恒为空串，width / height 为导出像素尺寸
 * （cutWidth / cutHeight × exportScale，与 wot-ui 语义一致），src / x / y /
 * scale / angle 为宿主自行完成最终裁剪所需的几何参数（x / y 为裁剪框左上角
 * 在图片自然像素坐标系中的位置，未含旋转，angle 为当前旋转角度）。
 */
export type ImgCropperResult = {
  tempFilePath: string
  width: number
  height: number
  src: string
  x: number
  y: number
  scale: number
  angle: number
}

export type ImgCropperExpose = {
  /**
   * 切换图片过渡动画效果
   * @param animation 是否启用动画，或包含动画状态的对象
   */
  revertIsAnimation: (animation: boolean | { value: boolean }) => void
  /**
   * 重置图片的大小、角度和位置到初始状态
   */
  resetImg: () => void
  /**
   * 旋转图片
   * @param angle 旋转角度（建议使用 90 的倍数）
   */
  setRotate: (angle: number) => void
}

export type ImgCropperEmits = {
  (e: 'update:modelValue', value: boolean): void
  (e: 'cancel'): void
  (e: 'confirm', value: ImgCropperResult): void
  (e: 'imgloaded', value: any): void
  (e: 'imgloaderror', value: any): void
  // 根 view 绑定 @touchmove 阻止页面滚动：按 CONVENTIONS §14，根元素上的
  // Lynx 原生事件名必须同时声明为 emit 并转发，否则消费方的同名监听会经
  // $attrs 穿透到根元素，与根元素自身绑定被 mergeProps 合成为数组，
  // 真机 publishEvent 调用数组即 TypeError 崩溃。
  (e: 'touchmove', value: any): void
}

export type ImgCropperInstance = ComponentPublicInstance<ImgCropperProps, ImgCropperExpose>
