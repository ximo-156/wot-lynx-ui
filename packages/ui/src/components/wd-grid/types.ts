import type { ExtractPropTypes } from 'vue-lynx'
import { baseProps, makeBooleanProp, makeNumberProp, makeStringProp } from '../../common/props'

export const gridProps = {
  ...baseProps,
  /**
   * 是否开启点击反馈
   */
  clickable: makeBooleanProp(false),
  /**
   * 是否正方形格子
   */
  square: makeBooleanProp(false),
  /**
   * 列数
   */
  column: Number,
  /**
   * 是否显示边框
   */
  border: makeBooleanProp(false),
  /**
   * 背景色
   */
  bgColor: makeStringProp(''),
  /**
   * 间距（px）
   */
  gutter: Number,
  /**
   * 按压类名
   */
  hoverClass: String,
  /**
   * 是否内容居中
   */
  center: makeBooleanProp(true)
}

export type GridProps = ExtractPropTypes<typeof gridProps>

/** grid → grid-item 的配置下发 key（square/border/clickable，Lynx 无属性选择器继承） */
export const GRID_CONFIG_KEY = 'wd-grid-config' as const
