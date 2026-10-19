import type { ExtractPropTypes, PropType } from 'vue-lynx'
import { baseProps, makeBooleanProp, makeNumberProp, makeRequiredProp, makeStringProp } from '../../common/props'
import type {
  DatetimePickerViewFilter,
  DatetimePickerViewFormatter,
  DateTimeType
} from '../wd-datetime-picker-view/types'

export type DatetimePickerBeforeConfirm = (value: string | number | Array<string | number>) => boolean | Promise<boolean>

export type DatetimePickerDisplayFormatTabLabel = (items: Record<string, any>[]) => string

const defaultMinDate = new Date(new Date().getFullYear() - 10, 0, 1).getTime()
const defaultMaxDate = new Date(new Date().getFullYear() + 10, 11, 31).getTime()

export const datetimePickerProps = {
  ...baseProps,
  /**
   * 当前值（时间戳/时间字符串，区间模式传数组）
   */
  modelValue: makeRequiredProp([String, Number, Array] as PropType<string | number | Array<string | number>>),
  /**
   * 是否显示
   */
  visible: makeBooleanProp(false),
  /**
   * 标题
   */
  title: String,
  /**
   * 取消按钮文字
   */
  cancelButtonText: String,
  /**
   * 确认按钮文字
   */
  confirmButtonText: String,
  /**
   * 点击遮罩是否关闭
   */
  closeOnClickModal: makeBooleanProp(true),
  /**
   * 底部安全区适配
   */
  safeAreaInsetBottom: makeBooleanProp(true),
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
   * 最小日期
   */
  minDate: makeNumberProp(defaultMinDate),
  /**
   * 最大日期
   */
  maxDate: makeNumberProp(defaultMaxDate),
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
   * 列过滤
   */
  filter: Function as PropType<DatetimePickerViewFilter>,
  /**
   * 单元格格式化
   */
  formatter: Function as PropType<DatetimePickerViewFormatter>,
  /**
   * 确认前拦截
   */
  beforeConfirm: Function as PropType<DatetimePickerBeforeConfirm>,
  /**
   * 区间模式 tab 文字格式化
   */
  displayFormatTabLabel: Function as PropType<DatetimePickerDisplayFormatTabLabel>,
  /**
   * 层级
   */
  zIndex: makeNumberProp(15),
  /**
   * 是否挂载到根节点
   */
  rootPortal: makeBooleanProp(false),
  /**
   * picker-view 自定义类名
   */
  customViewClass: makeStringProp(''),
  /**
   * 是否在手指松开时立即触发 picker-view 的 change 事件。若不开启则会在滚动动画结束后触发 change 事件，1.2.25版本起提供，仅微信小程序和支付宝小程序支持。
   */
  immediateChange: makeBooleanProp(false)
}

export type DatetimePickerProps = ExtractPropTypes<typeof datetimePickerProps>

export type DatetimePickerExpose = {
  open: () => void
  close: () => void
}
