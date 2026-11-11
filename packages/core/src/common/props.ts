import type { PropType } from 'vue-lynx'

export type Numeric = number | string

export const unknownProp = null as unknown as PropType<unknown>

export const numericProp = [Number, String]

export const truthProp = {
  type: Boolean,
  default: true as const
}

export const makeRequiredProp = <T>(type: T) => ({
  type,
  required: true as const
})

export const makeArrayProp = <T>() => ({
  type: Array as PropType<T[]>,
  default: () => []
})

export const makeBooleanProp = <T>(defaultVal: T) => ({
  type: Boolean,
  default: defaultVal
})

export const makeNumberProp = <T>(defaultVal: T) => ({
  type: Number,
  default: defaultVal
})

export const makeNumericProp = <T>(defaultVal: T) => ({
  type: numericProp,
  default: defaultVal
})

export const makeStringProp = <T>(defaultVal: T) => ({
  type: String as unknown as PropType<T>,
  default: defaultVal
})

export const baseProps = {
  /**
   * 自定义根节点样式。
   *
   * 接受字符串（CSS 声明串）或对象两种语法：vue-lynx 的 patchProp 对
   * `:style` 只认对象（字符串形式会被静默丢弃，CONVENTIONS §19），组件
   * 内部统一经 parseStyle() 归一为对象后下发，因此两种传入形式都支持。
   */
  customStyle: {
    type: [String, Object] as PropType<string | Record<string, any>>,
    default: ''
  },
  /**
   * 自定义根节点样式类
   */
  customClass: makeStringProp('')
}
