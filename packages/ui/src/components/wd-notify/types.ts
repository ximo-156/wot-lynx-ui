import type { ExtractPropTypes } from 'vue-lynx'
import { baseProps, makeBooleanProp, makeNumericProp, makeNumberProp, makeStringProp } from '../../common/props'

export type NotifyType = 'primary' | 'success' | 'warning' | 'danger'

export type NotifyPosition = 'top' | 'bottom'

export type NotifyVariant = 'filled' | 'floating'

export const notifyProps = {
  ...baseProps,
  /**
   * 类型
   */
  type: makeStringProp<NotifyType>('danger'),
  /**
   * 文字颜色
   */
  color: makeStringProp(''),
  /**
   * 层级
   */
  zIndex: makeNumberProp(99),
  /**
   * 是否显示
   */
  visible: makeBooleanProp(false),
  /**
   * 消息内容
   */
  message: makeNumericProp(''),
  /**
   * 选择器（区分多实例）
   */
  selector: makeStringProp(''),
  /**
   * 显示时长（ms，0 为不自动关闭）
   */
  duration: makeNumberProp(3000),
  /**
   * 位置
   */
  position: makeStringProp<NotifyPosition>('top'),
  /**
   * 安全高度
   */
  safeHeight: Number,
  /**
   * 背景色
   */
  background: makeStringProp(''),
  /**
   * 是否挂载到根节点
   */
  rootPortal: makeBooleanProp(false),
  /**
   * 是否可关闭
   */
  closable: makeBooleanProp(false),
  /**
   * 变体
   */
  variant: makeStringProp<NotifyVariant>('filled')
}

export type NotifyProps = ExtractPropTypes<typeof notifyProps>
