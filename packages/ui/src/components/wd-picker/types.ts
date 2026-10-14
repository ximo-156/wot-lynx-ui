import type { ExtractPropTypes, PropType } from 'vue-lynx'
import { baseProps, makeArrayProp, makeBooleanProp, makeNumberProp, makeStringProp } from '../../common/props'
import type { PickerOption } from '../wd-picker-view/types'
import type { Numeric } from '../../common/props'

export type PickerBeforeConfirm = (value: Numeric[]) => boolean | Promise<boolean>

export const pickerProps = {
  ...baseProps,
  /**
   * 选中值（数组，按列）
   */
  modelValue: makeArrayProp<Numeric>(),
  /**
   * 列数据
   */
  columns: makeArrayProp<PickerOption | Array<PickerOption>>(),
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
   * 确认前拦截
   */
  beforeConfirm: Function as PropType<PickerBeforeConfirm>,
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
   * 是否级联
   */
  cascade: makeBooleanProp(false),
  /**
   * 选项对象中 children 对应的 key
   */
  childrenKey: makeStringProp('children'),
  /**
   * 层级
   */
  zIndex: makeNumberProp(15),
  /**
   * 拖动过程中是否立即更新
   */
  immediateChange: makeBooleanProp(false),
  /**
   * 是否挂载到根节点
   */
  rootPortal: makeBooleanProp(false),
  /**
   * picker-view 自定义类名
   */
  customViewClass: makeStringProp('')
}

export type PickerProps = ExtractPropTypes<typeof pickerProps>

export type PickerExpose = {
  open: () => void
  close: () => void
}
