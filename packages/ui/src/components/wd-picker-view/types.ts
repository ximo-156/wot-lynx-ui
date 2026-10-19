import type { ExtractPropTypes } from 'vue-lynx'
import { baseProps, makeArrayProp, makeBooleanProp, makeNumberProp, makeStringProp } from '../../common/props'
import type { Numeric } from '../../common/props'

// 类型下沉到 L2：composables（L3）需要它，不能反向依赖组件（INV-1）。
// 这里 re-export 保持既有引用路径不变。
export type { PickerOption } from '../../common/picker'
import type { PickerOption } from '../../common/picker'

export type ColumnItem = PickerOption

export const pickerViewProps = {
  ...baseProps,
  /**
   * 每项高度（px）
   */
  itemHeight: makeNumberProp(44),
  /**
   * 可见项数（奇数，选中项居中）
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
   * 是否立即触发 change（拖动过程中）
   */
  immediateChange: makeBooleanProp(false),
  /**
   * 是否启用级联模式
   */
  cascade: makeBooleanProp(false),
  /**
   * 选项对象中 children 对应的 key
   */
  childrenKey: makeStringProp('children'),
  /**
   * 选中值（数组，按列）
   */
  modelValue: makeArrayProp<Numeric>(),
  /**
   * 列数据
   */
  columns: makeArrayProp<PickerOption | Array<PickerOption>>()
}

export type PickerViewProps = ExtractPropTypes<typeof pickerViewProps>

export type PickerViewExpose = {
  getSelectedOptions: () => PickerOption[]
  getSelectedValues: () => Numeric[]
  getColumnsData: () => PickerOption[][]
  getColumnData: (columnIndex: number) => PickerOption[]
  getColumnIndex: (columnIndex: number) => number
  getSelectedLabels: () => string[]
  getSelectedIndex: () => number[]
}
