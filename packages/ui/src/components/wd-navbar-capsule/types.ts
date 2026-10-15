import type { ExtractPropTypes } from 'vue-lynx'
import { baseProps, makeBooleanProp, makeStringProp } from '../../common/props'

export const navbarCapsuleProps = {
  ...baseProps,
  /**
   * 是否显示返回箭头
   */
  showBack: makeBooleanProp(true),
  /**
   * 是否显示首页图标
   */
  showHome: makeBooleanProp(true),
  /**
   * 背景色
   */
  bgColor: makeStringProp(''),
  /**
   * 文字/图标颜色
   */
  color: makeStringProp(''),
  /**
   * 边框
   */
  border: makeBooleanProp(false)
}

export type NavbarCapsuleProps = ExtractPropTypes<typeof navbarCapsuleProps>
