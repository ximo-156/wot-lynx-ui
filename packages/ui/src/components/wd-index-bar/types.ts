import type { ExtractPropTypes, InjectionKey } from 'vue-lynx'
import { baseProps, makeBooleanProp } from '../../common/props'

export type AnchorIndex = number | string

export type IndexBarProvide = {
  props: { sticky?: boolean }
  /** 激活索引状态（提供 ref，注入侧自动解包） */
  anchorState: { value: { activeIndex: AnchorIndex } }
}

export const indexBarInjectionKey: InjectionKey<IndexBarProvide> = Symbol('wd-index-bar')

export const indexBarProps = {
  ...baseProps,
  /**
   * 是否吸顶
   */
  sticky: makeBooleanProp(false)
}

export type IndexBarProps = ExtractPropTypes<typeof indexBarProps>
