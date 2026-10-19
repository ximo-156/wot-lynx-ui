import type { ExtractPropTypes, PropType } from 'vue-lynx'
import { baseProps, makeBooleanProp, makeNumberProp, makeRequiredProp, makeStringProp, type Numeric } from '../../common/props'

export type DateTimeType = 'date' | 'year-month' | 'time' | 'datetime' | 'year'

export type DatetimePickerViewColumnType = 'year' | 'month' | 'date' | 'hour' | 'minute' | 'second'

export type DatetimePickerViewOption = {
  /**
   * 选项值
   * 类型: string | number
   */
  value: number
  /**
   * 选项显示文本
   * 类型: string | number
   */
  label: string
  /**
   * 是否禁用
   * 类型: boolean
   * 默认值: false
   */
  disabled?: boolean
}

export type DatetimePickerViewColumn = {
  type: DatetimePickerViewColumnType
  values: number[]
}

export type DatetimePickerViewFilter = (options: DatetimePickerViewColumn) => number[]

export type DatetimePickerViewFormatter = (type: DatetimePickerViewColumnType, value: Numeric) => string

/**
 * 列格式化：收到的是**映射后**的列数组（每列为 DatetimePickerViewOption 选项），
 * 与 wot-ui 对齐；返回值替换整列数据。
 */
export type DatetimePickerViewColumnFormatter = (columns: DatetimePickerViewOption[][]) => DatetimePickerViewOption[][]

export const datetimePickerViewProps = {
  ...baseProps,
  /**
   * 当前值（时间戳或时间字符串）
   */
  modelValue: makeRequiredProp([String, Number]),
  /**
   * 每项高度（px）
   */
  itemHeight: makeNumberProp(44),
  /**
   * 可见项数
   */
  visibleItemCount: makeNumberProp(6),
  /**
   * 选项对象中 value 对应的 key
   */
  valueKey: makeStringProp('value'),
  /**
   * 选项对象中展示文本对应的 key
   */
  labelKey: makeStringProp('label'),
  /**
   * 类型
   */
  type: makeStringProp<DateTimeType>('datetime'),
  /**
   * 列过滤
   */
  filter: Function as PropType<DatetimePickerViewFilter>,
  /**
   * 单元格格式化
   */
  formatter: Function as PropType<DatetimePickerViewFormatter>,
  /**
   * 列格式化
   */
  columnFormatter: Function as PropType<DatetimePickerViewColumnFormatter>,
  /**
   * 最小日期
   */
  minDate: makeNumberProp(new Date(new Date().getFullYear() - 10, 0, 1).getTime()),
  /**
   * 最大日期
   */
  maxDate: makeNumberProp(new Date(new Date().getFullYear() + 10, 11, 31).getTime()),
  /**
   * 最小小时
   */
  minHour: makeNumberProp(0),
  /**
   * 最大小时
   */
  maxHour: makeNumberProp(23),
  /**
   * 最小分钟
   */
  minMinute: makeNumberProp(0),
  /**
   * 最大分钟
   */
  maxMinute: makeNumberProp(59),
  /**
   * 是否使用秒
   */
  useSecond: makeBooleanProp(false),
  /**
   * 最小秒
   */
  minSecond: makeNumberProp(0),
  /**
   * 最大秒
   */
  maxSecond: makeNumberProp(59),
  /**
   * 拖动过程中是否立即更新
   */
  immediateChange: makeBooleanProp(false),
  /**
   * 范围选择时，开始时间的最小值，用于处理开始时间和结束时间的联动
   * 类型: number
   * 注：wot-ui 2.3.2 中声明但未在视图内消费（区间联动由父级 wd-datetime-picker
   * 的 columnFormatter 完成），此处保留声明以对齐 API，传入不生效。
   */
  boundaryMinDate: Number,
  /**
   * 范围选择时，结束时间的最大值，用于处理开始时间和结束时间的联动
   * 类型: number
   * 注：wot-ui 2.3.2 中声明但未在视图内消费，此处保留声明以对齐 API，传入不生效。
   */
  boundaryMaxDate: Number
}

export type DatetimePickerViewProps = ExtractPropTypes<typeof datetimePickerViewProps>

export type DatetimePickerViewExpose = {
  /**
   * 获取选中的选项对象
   */
  getSelectedOptions: () => any[]
}
