import type { ComponentPublicInstance, ExtractPropTypes, PropType } from 'vue-lynx'
import { baseProps, makeBooleanProp, makeNumberProp, makeStringProp } from '../../common/props'

export type SliderValue = number | number[]

export type SliderTheme = 'default' | 'capsule'

export type SliderPopoverVisible = 'always' | 'normal' | 'never'

export type SliderMarks = number[] | Record<number, string>

export type SliderDragEvent = {
  value: SliderValue
}

export type SliderEmits = {
  (e: 'update:modelValue', value: SliderValue): void
  (e: 'dragstart', event: SliderDragEvent): void
  (e: 'dragmove', event: SliderDragEvent): void
  (e: 'dragend', event: SliderDragEvent): void
  (e: 'change', value: SliderValue): void
}

export const sliderProps = {
  ...baseProps,
  /**
   * 绑定的值
   * 类型: number | number[]
   * 默认值: 0
   */
  modelValue: {
    type: [Number, Array] as PropType<SliderValue>,
    default: 0
  },
  /**
   * 最小值
   * 类型: number
   * 默认值: 0
   */
  min: makeNumberProp(0),
  /**
   * 最大值
   * 类型: number
   * 默认值: 100
   */
  max: makeNumberProp(100),
  /**
   * 步长
   * 类型: number
   * 默认值: 1
   */
  step: makeNumberProp(1),
  /**
   * 是否双滑块
   * 类型: boolean
   * 默认值: false
   */
  range: makeBooleanProp(false),
  /**
   * 是否垂直
   * 类型: boolean
   * 默认值: false
   */
  vertical: makeBooleanProp(false),
  /**
   * 主题
   * 类型: string
   * 可选值: 'default' | 'capsule'
   * 默认值: 'default'
   */
  theme: makeStringProp<SliderTheme>('default'),
  /**
   * 是否禁用
   * 类型: boolean
   * 默认值: false
   */
  disabled: makeBooleanProp(false),
  /**
   * 是否显示首尾极值
   * 类型: boolean
   * 默认值: false
   */
  showExtremeValue: makeBooleanProp(false),
  /**
   * 气泡显示时机
   * 类型: string
   * 可选值: 'always' | 'normal' | 'never'
   * 默认值: 'normal'
   */
  popoverVisible: makeStringProp<SliderPopoverVisible>('normal'),
  /**
   * 刻度标记
   * 类型: number[] | Record<number, string>
   */
  marks: [Array, Object] as PropType<SliderMarks>,
  /**
   * 激活颜色
   */
  activeColor: makeStringProp(''),
  /**
   * 未激活颜色
   */
  inactiveColor: makeStringProp('')
}

export type SliderProps = ExtractPropTypes<typeof sliderProps>

export type SliderExpose = {
  /**
   * 重新初始化滑块尺寸
   */
  initSlider: () => void
}

export type SliderInstance = ComponentPublicInstance<SliderProps, SliderExpose>
