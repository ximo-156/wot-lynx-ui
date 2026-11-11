import type { ComponentPublicInstance, ExtractPropTypes } from 'vue-lynx'
import { baseProps, makeBooleanProp, makeStringProp, numericProp } from '@wot-lynx/core/common/props'

export const slideVerifyProps = {
  ...baseProps,
  /**
   * 容错范围（单位：px），距离终点多少距离内视为验证通过
   * 类型: number
   * 默认值: 10
   */
  tolerance: {
    type: Number,
    default: 10
  },

  /**
   * 提示文字
   * 类型: string
   * 默认值: ''
   */
  text: makeStringProp(''),

  /**
   * 验证成功提示文字
   * 类型: string
   * 默认值: ''
   */
  successText: makeStringProp(''),

  /**
   * 是否禁用
   * 类型: boolean
   * 默认值: false
   */
  disabled: makeBooleanProp(false),

  /**
   * 背景颜色
   * 类型: string
   */
  backgroundColor: String,

  /**
   * 激活时的背景颜色
   * 类型: string
   */
  activeBackgroundColor: String,

  /**
   * 滑块图标名称
   * 类型: string
   * 默认值: 'double-right'
   */
  icon: makeStringProp('double-right'),

  /**
   * 成功图标名称
   * 类型: string
   * 默认值: 'check-circle-fill'
   */
  successIcon: makeStringProp('check-circle-fill'),
  /**
   * 图标类名前缀，用法参考 Icon 组件
   * 类型: string
   */
  iconPrefix: String,
  /**
   * CSS 图标，用法参考 Icon 组件
   * 类型: boolean | string
   * 默认值: false
   */
  cssIcon: {
    type: [Boolean, String],
    default: false
  },

  /**
   * 图标大小（单位：px）
   * 类型: string | number
   * 默认值: 20
   */
  iconSize: numericProp,

  /**
   * 成功图标大小（单位：px）
   * 类型: string | number
   * 默认值: 12
   */
  successIconSize: numericProp
}

export type SlideVerifyProps = ExtractPropTypes<typeof slideVerifyProps>

export type SlideVerifyExpose = {
  /**
   * 初始化尺寸信息
   */
  init: () => Promise<void>
  /**
   * 重置验证组件到初始状态
   */
  reset: () => void
}

export type SlideVerifyEmits = {
  /** 验证成功事件 */
  (e: 'success'): void
  /** 验证失败事件 */
  (e: 'fail'): void
  /**
   * 容器布局变化（原生 layoutchange 转发，参数为原生事件对象）。
   *
   * 根节点挂 @layoutchange 补度量（真机首帧 onMounted 度量可能拿到 0）。
   * 同名事件必须声明为 emit 并转发：否则消费方的 @layoutchange 监听会
   * 穿透 $attrs 与根元素自身监听被 mergeProps 合并成数组，设备上事件
   * 到达即抛 registry TypeError（CONVENTIONS §14，wd-index-bar 同款）。
   */
  (e: 'layoutchange', event: any): void
}

export type SlideVerifyInstance = ComponentPublicInstance<SlideVerifyProps, SlideVerifyExpose>
