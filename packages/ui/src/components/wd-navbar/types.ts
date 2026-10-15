import type { ExtractPropTypes } from 'vue-lynx'
import { baseProps, makeBooleanProp, makeNumberProp, makeStringProp, numericProp } from '../../common/props'

export const navbarProps = {
  ...baseProps,
  /**
   * 标题
   */
  title: String,
  /**
   * 左侧文字
   */
  leftText: String,
  /**
   * 右侧文字
   */
  rightText: String,
  /**
   * 是否显示左侧箭头
   */
  leftArrow: makeBooleanProp(false),
  /**
   * 是否显示下边框
   */
  bordered: makeBooleanProp(false),
  /**
   * 是否固定
   */
  fixed: makeBooleanProp(false),
  /**
   * 是否占位
   */
  placeholder: makeBooleanProp(false),
  /**
   * 层级
   */
  zIndex: makeNumberProp(10),
  /**
   * 顶部安全区适配
   */
  safeAreaInsetTop: makeBooleanProp(false),
  /**
   * 左侧是否禁用
   */
  leftDisabled: makeBooleanProp(false),
  /**
   * 右侧是否禁用
   */
  rightDisabled: makeBooleanProp(false),
  /**
   * 高度
   */
  height: numericProp
}

export type NavbarProps = ExtractPropTypes<typeof navbarProps>
