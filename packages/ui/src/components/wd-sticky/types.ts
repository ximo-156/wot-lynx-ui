import type { ExtractPropTypes } from 'vue-lynx'
import { baseProps, makeNumberProp } from '../../common/props'

export const stickyProps = {
  ...baseProps,
  /**
   * 层级
   */
  zIndex: makeNumberProp(1),
  /**
   * 吸顶距离
   */
  offsetTop: makeNumberProp(0)
}

export type StickyProps = ExtractPropTypes<typeof stickyProps>
