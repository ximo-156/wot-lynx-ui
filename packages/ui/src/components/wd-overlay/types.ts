import type { PropType } from 'vue-lynx'
import { baseProps, makeBooleanProp, makeNumberProp } from '../../common/props'

export const overlayProps = {
  ...baseProps,
  /**
   * 是否展示遮罩层
   * 类型: boolean
   * 默认值: false
   */
  show: makeBooleanProp(false),
  /**
   * 动画时长，单位毫秒
   * 类型: Record<string, number> | number | boolean
   * 默认值: 300
   */
  duration: {
    type: [Object, Number, Boolean] as PropType<Record<string, number> | number | boolean>,
    default: 300
  },
  /**
   * 是否锁定滚动
   * 类型: boolean
   * 默认值: true
   */
  lockScroll: makeBooleanProp(true),
  /**
   * 层级
   * 类型: number
   * 默认值: 10
   */
  zIndex: makeNumberProp(10)
}
