import type { ExtractPropTypes, PropType } from 'vue-lynx'
import { baseProps, makeStringProp } from '../../common/props'

export type CardType = 'rectangle'

export const cardProps = {
  ...baseProps,
  /**
   * 卡片标题
   * 类型: string
   * 默认值: -
   */
  title: String,
  /**
   * 卡片类型
   */
  type: String as PropType<CardType>,
  /**
   * 标题自定义样式
   * 类型: string
   * 默认值: ''
   */
  customTitleClass: makeStringProp(''),
  /**
   * 内容自定义样式
   * 类型: string
   * 默认值: ''
   */
  customContentClass: makeStringProp(''),
  /**
   * 底部自定义样式
   * 类型: string
   * 默认值: ''
   */
  customFooterClass: makeStringProp('')
}

export type CardProps = ExtractPropTypes<typeof cardProps>
