import type { ExtractPropTypes } from 'vue-lynx'
import { baseProps, makeBooleanProp, makeNumberProp, makeStringProp } from '../../common/props'

export type FabType = 'primary' | 'success' | 'warning' | 'danger' | 'info'

export type FabPosition = 'left-top' | 'right-top' | 'left-bottom' | 'right-bottom'

export type FabDirection = 'top' | 'bottom' | 'left' | 'right'

export type FabExpose = {
  open: () => void
  close: () => void
}

export const fabProps = {
  ...baseProps,
  /**
   * 是否展开
   */
  active: makeBooleanProp(false),
  /**
   * 类型
   */
  type: makeStringProp<FabType>('primary'),
  /**
   * 位置
   */
  position: makeStringProp<FabPosition>('right-bottom'),
  /**
   * 展开方向
   */
  direction: makeStringProp<FabDirection>('top'),
  /**
   * 是否禁用
   */
  disabled: makeBooleanProp(false),
  /**
   * 未激活图标
   */
  inactiveIcon: makeStringProp('add'),
  /**
   * 激活图标
   */
  activeIcon: makeStringProp('close'),
  /**
   * 层级
   */
  zIndex: makeNumberProp(99),
  /**
   * 拖拽距离阈值
   */
  dragDistance: makeNumberProp(0),
  /**
   * 展开间距
   */
  gap: makeNumberProp(16)
}

export type FabProps = ExtractPropTypes<typeof fabProps>
