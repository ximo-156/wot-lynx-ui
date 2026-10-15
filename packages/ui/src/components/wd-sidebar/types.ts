import type { ExtractPropTypes, InjectionKey, PropType } from 'vue-lynx'
import { baseProps, makeNumericProp, makeNumberProp } from '../../common/props'

export type SidebarBeforeChange = (value: number | string) => boolean | Promise<boolean>

export type SidebarProvide = {
  props: Record<string, any>
  setChange: (value: number | string, label: string) => void
}

export const SIDEBAR_KEY: InjectionKey<SidebarProvide> = Symbol('wd-sidebar')

export const sidebarProps = {
  ...baseProps,
  /**
   * 当前选中值
   */
  modelValue: makeNumericProp(0),
  /**
   * 切换前拦截
   */
  beforeChange: Function as PropType<SidebarBeforeChange>,
  /**
   * 层级
   */
  zIndex: makeNumberProp(1)
}

export type SidebarProps = ExtractPropTypes<typeof sidebarProps>
