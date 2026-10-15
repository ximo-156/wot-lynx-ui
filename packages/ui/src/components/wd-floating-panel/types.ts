import type { ExtractPropTypes } from 'vue-lynx'
import { baseProps, makeArrayProp, makeBooleanProp, makeNumericProp, makeNumberProp, truthProp } from '../../common/props'

export const floatingPanelProps = {
  ...baseProps,
  /**
   * 面板高度（px）
   */
  height: makeNumberProp(0),
  /**
   * 锚点位置数组（px）
   */
  anchors: makeArrayProp<number>(),
  /**
   * 底部安全区适配
   */
  safeAreaInsetBottom: makeBooleanProp(false),
  /**
   * 是否显示滚动条
   */
  showScrollbar: truthProp,
  /**
   * 动画时长（ms）
   */
  duration: makeNumericProp(300),
  /**
   * 内容是否可拖动
   */
  contentDraggable: truthProp
}

export type FloatingPanelProps = ExtractPropTypes<typeof floatingPanelProps>
