import type { ExtractPropTypes, PropType } from 'vue-lynx'
import { baseProps, makeArrayProp, makeBooleanProp, makeNumberProp, makeRequiredProp, makeStringProp } from '../../common/props'
import { ORANGE } from '../../common/theme'

export type SelectPickerType = 'checkbox' | 'radio'

export type SelectPickerBeforeConfirm = (value: string | number | boolean | Array<string | number | boolean>) => boolean | Promise<boolean>

export const selectPickerProps = {
  ...baseProps,
  /**
   * 标题
   */
  title: String,
  /**
   * 选中颜色
   */
  checkedColor: String,
  /**
   * 多选最小数量
   */
  min: makeNumberProp(0),
  /**
   * 多选最大数量
   */
  max: makeNumberProp(0),
  /**
   * 选项尺寸
   */
  selectSize: String,
  /**
   * 加载中
   */
  loading: makeBooleanProp(false),
  /**
   * 加载颜色
   */
  loadingColor: makeStringProp(ORANGE[6]),
  /**
   * 点击遮罩是否关闭
   */
  closeOnClickModal: makeBooleanProp(true),
  /**
   * 当前值
   */
  modelValue: makeRequiredProp([String, Number, Boolean, Array] as PropType<string | number | boolean | (string | number | boolean)[]>),
  /**
   * 选项数据
   */
  columns: makeArrayProp<Record<string, any>>(),
  /**
   * 选择类型
   */
  type: makeStringProp<SelectPickerType>('checkbox'),
  /**
   * 选项对象中 value 对应的 key
   */
  valueKey: makeStringProp('value'),
  /**
   * 选项对象中展示文本对应的 key
   */
  labelKey: makeStringProp('label'),
  /**
   * 确认按钮文字
   */
  confirmButtonText: String,
  /**
   * 确认前拦截
   */
  beforeConfirm: Function as PropType<SelectPickerBeforeConfirm>,
  /**
   * 层级
   */
  zIndex: makeNumberProp(15),
  /**
   * 底部安全区适配
   */
  safeAreaInsetBottom: makeBooleanProp(true),
  /**
   * 是否可搜索
   */
  filterable: makeBooleanProp(false),
  /**
   * 搜索占位
   */
  filterPlaceholder: String,
  /**
   * 打开时是否滚动到选中项
   */
  scrollIntoView: makeBooleanProp(true),
  /**
   * 内容自定义类名
   */
  customContentClass: makeStringProp(''),
  /**
   * 是否显示确认按钮
   */
  showConfirm: makeBooleanProp(true),
  /**
   * 是否显示
   */
  visible: makeBooleanProp(false),
  /**
   * 是否挂载到根节点
   */
  rootPortal: makeBooleanProp(false)
}

export type SelectPickerProps = ExtractPropTypes<typeof selectPickerProps>

export type SelectPickerExpose = {
  open: () => void
  close: () => void
}
