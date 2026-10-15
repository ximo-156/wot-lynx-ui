import type { ExtractPropTypes } from 'vue-lynx'
import { baseProps, makeNumberProp } from '../../common/props'

export const stickyBoxProps = {
  ...baseProps,
  /**
   * 容器高度（px）
   */
  containerHeight: makeNumberProp(0),
  /**
   * 吸顶偏移（px）
   */
  offsetTop: makeNumberProp(0)
}

export type StickyBoxProps = ExtractPropTypes<typeof stickyBoxProps>
