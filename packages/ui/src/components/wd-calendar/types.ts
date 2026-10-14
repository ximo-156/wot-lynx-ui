import type { ExtractPropTypes, PropType } from 'vue-lynx'
import { baseProps, makeArrayProp, makeBooleanProp, makeNumberProp, makeRequiredProp, makeStringProp } from '../../common/props'
import type { CalendarFormatter, CalendarTimeFilter, CalendarType } from '../wd-calendar-view/types'

export type CalendarBeforeConfirm = (value: number | number[] | null) => boolean | Promise<boolean>

export type CalendarInnerDisplayFormat = (value: number, rangeType: 'start' | 'end', type: CalendarType) => string

export type CalendarOnShortcutsClick = (item: Record<string, any>) => void

export const calendarProps = {
  ...baseProps,
  /**
   * 当前值（时间戳 / 时间戳数组）
   */
  modelValue: makeRequiredProp([Number, Array, null] as PropType<number | number[] | null>),
  /**
   * 日期类型
   */
  type: makeStringProp<CalendarType>('date'),
  /**
   * 最小日期
   */
  minDate: makeNumberProp(new Date(new Date().getFullYear() - 5, 0, 1).getTime()),
  /**
   * 最大日期
   */
  maxDate: makeNumberProp(new Date(new Date().getFullYear() + 5, 11, 31).getTime()),
  /**
   * 每周第一天
   */
  firstDayOfWeek: makeNumberProp(0),
  /**
   * 日期格式化
   */
  formatter: Function as PropType<CalendarFormatter>,
  /**
   * 范围选择最大天数
   */
  maxRange: Number,
  /**
   * 范围超出提示
   */
  rangePrompt: String,
  /**
   * 是否允许同一天
   */
  allowSameDay: makeBooleanProp(false),
  /**
   * 默认时间
   */
  defaultTime: {
    type: Object as PropType<{ hour?: number; minute?: number; second?: number }>,
    default: () => ({ hour: 0, minute: 0, second: 0 })
  },
  /**
   * 时间列过滤
   */
  timeFilter: Function as PropType<CalendarTimeFilter>,
  /**
   * 是否隐藏秒
   */
  hideSecond: makeBooleanProp(false),
  /**
   * 标题
   */
  title: String,
  /**
   * 点击遮罩是否关闭
   */
  closeOnClickModal: makeBooleanProp(true),
  /**
   * 层级
   */
  zIndex: makeNumberProp(15),
  /**
   * 是否显示确认按钮
   */
  showConfirm: makeBooleanProp(true),
  /**
   * 确认按钮文字
   */
  confirmText: String,
  /**
   * 区间模式自定义展示
   */
  innerDisplayFormat: Function as PropType<CalendarInnerDisplayFormat>,
  /**
   * 超出范围是否省略
   */
  ellipsis: makeBooleanProp(false),
  /**
   * 是否显示类型切换
   */
  showTypeSwitch: makeBooleanProp(false),
  /**
   * 快捷选项
   */
  shortcuts: makeArrayProp<Record<string, any>>(),
  /**
   * 快捷选项点击
   */
  onShortcutsClick: Function as PropType<CalendarOnShortcutsClick>,
  /**
   * 底部安全区适配
   */
  safeAreaInsetBottom: makeBooleanProp(true),
  /**
   * 确认前拦截
   */
  beforeConfirm: Function as PropType<CalendarBeforeConfirm>,
  /**
   * picker-view 自定义类名
   */
  customViewClass: makeStringProp('')
}

export type CalendarProps = ExtractPropTypes<typeof calendarProps>

export type CalendarExpose = {
  open: () => void
  close: () => void
}
