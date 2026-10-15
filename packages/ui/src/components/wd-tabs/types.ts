import type { ExtractPropTypes, InjectionKey, PropType } from 'vue-lynx'
import { baseProps, makeBooleanProp, makeNumericProp, makeNumberProp, makeStringProp, numericProp } from '../../common/props'

export type TabsLineTheme = 'normal' | 'capsule' | 'rounded'

export type TabsProvide = {
  /** 组件 props（提供 reactive 对象，子选项卡读取 modelValue） */
  props: Record<string, any>
  /** 该索引是否已渲染过（懒渲染保持） */
  isRendered: (index: number) => boolean
}

export const TABS_KEY: InjectionKey<TabsProvide> = Symbol('wd-tabs')

export const tabsProps = {
  ...baseProps,
  /**
   * 当前选中（索引或 name）
   */
  modelValue: makeNumericProp(0),
  /**
   * 可滑动阈值（超过则导航可横向滚动）
   */
  slidableNum: makeNumberProp(6),
  /**
   * 折叠阈值
   */
  mapNum: makeNumberProp(10),
  /**
   * 折叠标题
   */
  mapTitle: String,
  /**
   * 是否吸顶
   */
  sticky: makeBooleanProp(false),
  /**
   * 吸顶偏移
   */
  offsetTop: makeNumberProp(0),
  /**
   * 是否可滑动切换
   */
  swipeable: makeBooleanProp(false),
  /**
   * 指示线主题
   */
  lineTheme: makeStringProp<TabsLineTheme>('normal'),
  /**
   * 指示线宽度
   */
  lineWidth: numericProp,
  /**
   * 指示线高度
   */
  lineHeight: numericProp,
  /**
   * 是否有动画
   */
  animated: makeBooleanProp(false)
}

export type TabsProps = ExtractPropTypes<typeof tabsProps>
