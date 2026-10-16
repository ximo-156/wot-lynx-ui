import type { ExtractPropTypes, InjectionKey } from 'vue-lynx'
import { baseProps, makeBooleanProp, makeNumericProp, makeStringProp } from '../../common/props'

export type TabbarShape = 'default' | 'round'

export interface TabbarItem {
  name: string | number
}

export type TabbarProvide = {
  props: Record<string, any>
  setChange: (child: TabbarItem) => void
}

export const TABBAR_KEY: InjectionKey<TabbarProvide> = Symbol('wd-tabbar')

export const tabbarProps = {
  ...baseProps,
  /**
   * 当前选中索引
   */
  modelValue: makeNumericProp(0),
  /**
   * 是否固定底部
   */
  fixed: makeBooleanProp(false),
  /**
   * 是否显示上边框
   */
  bordered: makeBooleanProp(false),
  /**
   * 底部安全区适配
   */
  safeAreaInsetBottom: makeBooleanProp(false),
  /**
   * 形状
   */
  shape: makeStringProp<TabbarShape>('default'),
  /**
   * 激活颜色
   */
  activeColor: String,
  /**
   * 未激活颜色
   */
  inactiveColor: String,
  /**
   * 是否显示激活态指示条（激活项底部线条，本库扩展，wot-ui 无此 prop）
   */
  activeLine: makeBooleanProp(false)
}

export type TabbarProps = ExtractPropTypes<typeof tabbarProps>
