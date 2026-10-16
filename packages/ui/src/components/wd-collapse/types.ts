import type { ComputedRef, ExtractPropTypes, InjectionKey } from 'vue-lynx'
import { baseProps, makeBooleanProp, makeStringProp } from '../../common/props'

export type CollapseValue = string | number | Array<string | number>

export type CollapseProvide = {
  props: Record<string, any>
  currentValue: ComputedRef<CollapseValue>
  /** name 传原始值（数字/字符串），内部统一转 String 比较，push 时保留原类型 */
  toggle: (name: string | number, expanded: boolean) => void
}

export const COLLAPSE_KEY: InjectionKey<CollapseProvide> = Symbol('wd-collapse')

export const collapseProps = {
  ...baseProps,
  /**
   * 当前展开项（accordion 为单值）
   */
  modelValue: {
    type: [String, Number, Array] as any,
    default: ''
  },
  /**
   * 是否手风琴模式
   */
  accordion: makeBooleanProp(false),
  /**
   * 是否展示更多
   */
  viewmore: makeBooleanProp(false),
  /**
   * 是否使用更多插槽
   */
  useMoreSlot: makeBooleanProp(false),
  /**
   * 更多插槽自定义类名
   */
  customMoreSlotClass: makeStringProp('')
}

export type CollapseProps = ExtractPropTypes<typeof collapseProps>
