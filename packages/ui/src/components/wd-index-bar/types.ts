import type { ExtractPropTypes, InjectionKey } from 'vue-lynx'
import { baseProps, makeBooleanProp } from '../../common/props'

export type AnchorIndex = number | string

export type IndexBarProvide = {
  props: { sticky?: boolean }
  /** 激活索引状态（提供 ref，注入侧自动解包） */
  anchorState: { value: { activeIndex: AnchorIndex } }
  /**
   * 本 index-bar 实例的唯一 id 前缀。anchor 的 DOM id 由
   * `${id}-anchor-${index}` 派生，与 index-bar 侧 scrollIntoViewById
   * 的拼接口径一致；避免同页多个 index-bar 时 anchor id 重复
   * （引擎 id→签名注册表错乱，真机 9902 removeNode 家族）。
   */
  id?: string
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
