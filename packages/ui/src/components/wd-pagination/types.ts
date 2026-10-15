import type { ExtractPropTypes, PropType } from 'vue-lynx'
import { baseProps, makeBooleanProp, makeNumberProp, makeRequiredProp, makeStringProp } from '../../common/props'
import type { ButtonVariant } from '../wd-button/types'

export const paginationProps = {
  ...baseProps,
  /**
   * 当前页
   */
  modelValue: makeRequiredProp(Number),
  /**
   * 总页数
   */
  totalPage: makeNumberProp(1),
  /**
   * 是否显示图标
   */
  showIcon: makeBooleanProp(false),
  /**
   * 按钮变体
   */
  buttonVariant: {
    type: String as PropType<ButtonVariant>,
    default: 'text'
  },
  /**
   * 是否显示消息
   */
  showMessage: makeBooleanProp(false),
  /**
   * 总条数
   */
  total: makeNumberProp(0),
  /**
   * 每页条数
   */
  pageSize: makeNumberProp(10),
  /**
   * 上一页文字
   */
  prevText: String,
  /**
   * 下一页文字
   */
  nextText: String,
  /**
   * 只有一页时隐藏
   */
  hideIfOnePage: makeBooleanProp(false)
}

export type PaginationProps = ExtractPropTypes<typeof paginationProps>
