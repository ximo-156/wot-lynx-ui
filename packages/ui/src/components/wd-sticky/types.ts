import type { ExtractPropTypes } from 'vue-lynx'
import { baseProps, makeNumberProp } from '../../common/props'

export const stickyProps = {
  ...baseProps,
  /**
   * 层级
   */
  zIndex: makeNumberProp(1),
  /**
   * 吸顶偏移（px）。
   * 刻意不设默认值：需区分「未传（继承父级 wd-sticky-box 的偏移）」与
   * 「显式传 0（贴顶）」。旧实现默认 0，导致显式 0 被当作未传而错用父级偏移。
   */
  offsetTop: {
    type: Number
  }
}

export type StickyProps = ExtractPropTypes<typeof stickyProps>
