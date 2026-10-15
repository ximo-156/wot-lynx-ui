import type { ExtractPropTypes, PropType } from 'vue-lynx'
import { baseProps, makeBooleanProp, makeNumberProp, makeStringProp } from '../../common/props'

export type NoticeBarType = 'warning' | 'danger' | 'info'

export type NoticeBarScrollDirection = 'horizontal' | 'vertical'

export const noticeBarProps = {
  ...baseProps,
  /**
   * 通知文本（数组时纵向滚动）
   */
  text: {
    type: [String, Array] as PropType<string | string[]>,
    default: ''
  },
  /**
   * 类型
   */
  type: makeStringProp<NoticeBarType>('warning'),
  /**
   * 是否可滚动（单行超出时）
   */
  scrollable: makeBooleanProp(true),
  /**
   * 滚动延迟（s）
   */
  delay: makeNumberProp(1),
  /**
   * 滚动速度（px/s）
   */
  speed: makeNumberProp(50),
  /**
   * 是否可关闭
   */
  closable: makeBooleanProp(false),
  /**
   * 是否换行
   */
  wrapable: makeBooleanProp(false),
  /**
   * 前置图标
   */
  prefix: String,
  /**
   * 文字颜色
   */
  color: String,
  /**
   * 背景色
   */
  backgroundColor: String,
  /**
   * 滚动方向
   */
  direction: makeStringProp<NoticeBarScrollDirection>('horizontal')
}

export type NoticeBarProps = ExtractPropTypes<typeof noticeBarProps>

export type NoticeBarExpose = {
  reset: () => void
}
