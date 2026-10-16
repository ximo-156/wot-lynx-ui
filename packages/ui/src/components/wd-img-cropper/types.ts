import type { ExtractPropTypes } from 'vue-lynx'
import { baseProps, makeBooleanProp, makeNumberProp, makeNumericProp, makeStringProp } from '../../common/props'

export type ImgCropperEmits = {
  (e: 'update:modelValue', value: boolean): void
  (e: 'confirm', value: { src: string; width: number; height: number; x: number; y: number; scale: number }): void
  (e: 'cancel'): void
  // 根 view 绑定 @touchmove 锁滚：按 CONVENTIONS §14，根元素上的 Lynx
  // 原生事件名必须同时声明为 emit 并转发，否则消费方的同名监听会经
  // $attrs 穿透到根元素，与根元素自身绑定被 mergeProps 合成为数组，
  // 真机 publishEvent 调用数组即 TypeError 崩溃。
  (e: 'touchmove', value: any): void
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
  // 注意：wot-ui 的 disabledRotate（是否禁用旋转）在本降级版中未实现——
  // 组件没有旋转 UI（旋转能力仅经 expose 的 setRotate 以编程方式提供），
  // 该 prop 已从定义中删除，避免"声明但完全不生效"的无效 API。
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
