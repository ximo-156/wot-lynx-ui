import type { ExtractPropTypes, InjectionKey } from 'vue-lynx'
import { baseProps, makeBooleanProp, makeNumberProp, makeStringProp } from '../../common/props'

export type StepsProvide = {
  props: Record<string, any>
}

export const STEPS_KEY: InjectionKey<StepsProvide> = Symbol('wd-steps')

export const stepsProps = {
  ...baseProps,
  /**
   * 当前激活步骤
   */
  active: makeNumberProp(0),
  /**
   * 是否垂直
   */
  vertical: makeBooleanProp(false),
  /**
   * 是否点状
   */
  dot: makeBooleanProp(false),
  /**
   * 间距（步骤之间的间隔，经 gap 下发：横向 column-gap，纵向 row-gap）
   */
  space: makeStringProp(''),
  /**
   * 是否居中
   */
  alignCenter: makeBooleanProp(false)
}

export type StepsProps = ExtractPropTypes<typeof stepsProps>
