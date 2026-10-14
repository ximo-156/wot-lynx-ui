import type { ExtractPropTypes, PropType } from 'vue-lynx'
import { baseProps, makeBooleanProp, makeNumberProp, makeRequiredProp, makeStringProp } from '../../common/props'
import type { DatetimePickerViewFilter, DatetimePickerViewFormatter } from '../wd-datetime-picker-view/types'

export type CalendarType = 'date' | 'dates' | 'datetime' | 'week' | 'month' | 'daterange' | 'datetimerange' | 'weekrange' | 'monthrange'

export type CalendarDayType = '' | 'start' | 'middle' | 'end' | 'selected' | 'same' | 'current' | 'multiple-middle' | 'multiple-selected'

export type CalendarDayItem = {
  date: number
  type: CalendarDayType
  text: number
  topInfo?: string
  bottomInfo?: string
  disabled?: boolean
  isLastRow?: boolean
  isFirstRow?: boolean
}

export type CalendarFormatter = (day: CalendarDayItem) => CalendarDayItem

export type CalendarTimeFilter = DatetimePickerViewFilter

export type CalendarTimeFormatter = DatetimePickerViewFormatter

const defaultMinDate = new Date(new Date().getFullYear() - 5, 0, 1).getTime()
const defaultMaxDate = new Date(new Date().getFullYear() + 5, 11, 31).getTime()

export const calendarViewProps = {
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
  minDate: makeNumberProp(defaultMinDate),
  /**
   * 最大日期
   */
  maxDate: makeNumberProp(defaultMaxDate),
  /**
   * 每周第一天（0 周日 ~ 6 周六）
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
   * 是否显示面板标题
   */
  showPanelTitle: makeBooleanProp(true),
  /**
   * 默认时间（datetime 类型的时分秒）
   */
  defaultTime: {
    type: Object as PropType<{ hour?: number; minute?: number; second?: number }>,
    default: () => ({ hour: 0, minute: 0, second: 0 })
  },
  /**
   * 面板高度
   */
  panelHeight: makeNumberProp(316),
  /**
   * 时间列过滤
   */
  timeFilter: Function as PropType<CalendarTimeFilter>,
  /**
   * 时间项高度
   */
  timeItemHeight: makeNumberProp(44),
  /**
   * 时间可见项数
   */
  timeVisibleItemCount: makeNumberProp(3),
  /**
   * 是否隐藏秒
   */
  hideSecond: makeBooleanProp(false),
  /**
   * 拖动过程中是否立即更新
   */
  immediateChange: makeBooleanProp(false),
  /**
   * 面板切换模式
   */
  switchMode: makeStringProp<'none' | 'month' | 'year-month'>('none')
}

export type CalendarViewProps = ExtractPropTypes<typeof calendarViewProps>
