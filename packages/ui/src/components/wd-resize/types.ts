import type { ExtractPropTypes } from 'vue-lynx'
import { baseProps, makeStringProp } from '../../common/props'

export const resizeProps = {
  ...baseProps,
  /**
   * 容器自定义类名
   */
  customContainerClass: makeStringProp('')
}

export type ResizeProps = ExtractPropTypes<typeof resizeProps>
