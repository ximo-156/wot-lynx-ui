import type { ExtractPropTypes, PropType } from 'vue-lynx'
import { baseProps, makeBooleanProp, makeNumberProp, makeRequiredProp, makeStringProp } from '../../common/props'

export type DateTimeType = 'date' | 'year-month' | 'time' | 'datetime' | 'year'

export type DatetimePickerViewColumnType = 'year' | 'month' | 'date' | 'hour' | 'minute' | 'second'

export type DatetimePickerViewFilter = (props: { type: DatetimePickerViewColumnType; values: number[] }) => number[]

export type DatetimePickerViewFormatter = (type: DatetimePickerViewColumnType, value: string) => string

/**
 * 列格式化：收到的是**映射后**的列数组（每列为 { label, value } 选项），
 * 与 wot-ui 对齐；返回值替换整列数据。
 */
export type DatetimePickerViewColumnFormatter = (
  columns: Array<Array<{ label: string; value: number }>>
) => Array<Array<{ label: string; value: number }>>

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
  immediateChange: makeBooleanProp(false)
}

export type DatetimePickerViewProps = ExtractPropTypes<typeof datetimePickerViewProps>

export type DatetimePickerViewExpose = {
  /**
   * 获取选中的选项对象
   */
  getSelectedOptions: () => any[]
}
