import type { ExtractPropTypes, PropType } from 'vue-lynx'
import { baseProps, makeStringProp } from '../../common/props'

export type CardType = 'default' | 'rectangle' | 'round'

export const cardProps = {
  ...baseProps,
  /**
   * 标题
   */
  title: String,
  /**
   * 类型
   */
  type: String as PropType<CardType>,
  /**
   * 标题自定义类名
   */
  customTitleClass: makeStringProp(''),
  /**
   * 内容自定义类名
   */
  customContentClass: makeStringProp(''),
  /**
   * 底部自定义类名
   */
  customFooterClass: makeStringProp('')
}

export type CardProps = ExtractPropTypes<typeof cardProps>
