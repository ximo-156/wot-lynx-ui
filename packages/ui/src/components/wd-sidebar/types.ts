import { type ExtractPropTypes, type InjectionKey, type PropType } from 'vue-lynx'
import { baseProps, makeNumericProp } from '../../common/props'

export type SidebarProvide = {
  props: Partial<SidebarProps>
  setChange: (value: number | string, label: string) => void
}

export const SIDEBAR_KEY: InjectionKey<SidebarProvide> = Symbol('wd-sidebar')

export type SidebarBeforeChange = (value: number | string) => boolean | Promise<boolean>

export const sidebarProps = {
  ...baseProps,
  /**
   * 当前导航项的索引
   */
  modelValue: makeNumericProp(0),
  /**
   * 在改变前执行的函数
   */
  beforeChange: Function as PropType<SidebarBeforeChange>
}

export type SidebarProps = ExtractPropTypes<typeof sidebarProps>
