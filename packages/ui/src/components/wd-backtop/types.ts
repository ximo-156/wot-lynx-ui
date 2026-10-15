import type { ExtractPropTypes } from 'vue-lynx'
import { baseProps, makeNumberProp, makeRequiredProp, makeStringProp } from '../../common/props'

export type BacktopShape = 'circle' | 'square'

export const backtopProps = {
  ...baseProps,
  /**
   * 滚动位置（由页面 scroll-view 下发）
   */
  scrollTop: makeRequiredProp(Number),
  /**
   * 按钮文字
   */
  text: String,
  /**
   * 显示阈值（滚动超过该值显示）
   */
  top: makeNumberProp(300),
  /**
   * 点击回到顶部时长（ms）
   */
  duration: makeNumberProp(100),
  /**
   * 层级
   */
  zIndex: makeNumberProp(10),
  /**
   * 图标样式
   */
  iconStyle: makeStringProp(''),
  /**
   * 形状
   */
  shape: makeStringProp<BacktopShape>('circle'),
  /**
   * 底部偏移
   */
  bottom: makeNumberProp(100),
  /**
   * 右侧偏移
   */
  right: makeNumberProp(20)
}

export type BacktopProps = ExtractPropTypes<typeof backtopProps>
