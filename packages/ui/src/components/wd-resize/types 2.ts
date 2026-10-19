import type { ExtractPropTypes } from 'vue-lynx'
import { baseProps, makeStringProp } from '../../common/props'

/**
 * Resize 组件 Props 定义
 */
export const resizeProps = {
  ...baseProps,
  /**
   * 自定义容器类名
   * 类型: string
   * 默认值: ''
   */
  customContainerClass: makeStringProp('')
}

export type ResizeProps = ExtractPropTypes<typeof resizeProps>
