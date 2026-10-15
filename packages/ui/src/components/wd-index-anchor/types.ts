import type { ExtractPropTypes } from 'vue-lynx'
import { baseProps, makeRequiredProp } from '../../common/props'

export const indexAnchorProps = {
  ...baseProps,
  /**
   * 索引
   */
  index: makeRequiredProp([String, Number])
}

export type IndexAnchorProps = ExtractPropTypes<typeof indexAnchorProps>
