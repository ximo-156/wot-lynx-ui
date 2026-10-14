import type { ExtractPropTypes, PropType } from 'vue-lynx'
import { baseProps, makeBooleanProp, makeStringProp, numericProp } from '../../common/props'
import type { CellAsteriskPosition, CellLayout, CellSize, CellValueAlign } from '../wd-cell/types'
import { FORM_ITEM_DISABLED_KEY, type FormItemDisabledProvide } from '../../composables/useFormDisabled'
import { FORM_ITEM_VALIDATE_KEY, type FormItemValidateProvide } from '../../composables/useFormItemValidate'
import type { FormValidateEvent, FormValidateTrigger } from '../wd-form/types'

// 兼容历史从 wd-form-item/types 深度导入的用法
export { FORM_ITEM_DISABLED_KEY, FORM_ITEM_VALIDATE_KEY }
export type { FormItemDisabledProvide, FormItemValidateProvide }

export const formItemProps = {
  ...baseProps,
  /**
   * 表单域 model 字段名
   */
  prop: String,
  /**
   * 左侧标题
   */
  title: String,
  /**
   * 右侧内容
   */
  value: numericProp,
  /**
   * 占位内容
   */
  placeholder: String,
  /**
   * 前置图标名称
   */
  prefixIcon: String,
  /**
   * 图标大小
   */
  iconSize: numericProp,
  /**
   * 图标类名前缀
   */
  iconPrefix: String,
  /**
   * CSS 图标类名
   */
  cssIcon: {
    type: [Boolean, String],
    default: false
  },
  /**
   * 标题下方的描述
   */
  label: String,
  /**
   * 是否可点击
   */
  clickable: makeBooleanProp(false),
  /**
   * 是否展示右侧箭头
   */
  isLink: makeBooleanProp(false),
  /**
   * 是否禁用
   */
  disabled: makeBooleanProp(void 0),
  /**
   * 单元格大小
   */
  size: String as PropType<CellSize>,
  /**
   * 是否显示边框线
   */
  border: makeBooleanProp(void 0),
  /**
   * 左侧标题宽度
   */
  titleWidth: numericProp,
  /**
   * 是否使内容垂直居中
   */
  center: makeBooleanProp(void 0),
  /**
   * 是否显示必填星号
   */
  required: makeBooleanProp(void 0),
  /**
   * 校验触发时机
   */
  validateTrigger: [String, Array] as PropType<FormValidateTrigger | FormValidateTrigger[]>,
  /**
   * 单元格布局方式
   */
  layout: String as PropType<CellLayout>,
  /**
   * 右侧内容对齐方式
   */
  valueAlign: String as PropType<CellValueAlign>,
  /**
   * 右侧内容超出是否省略
   */
  ellipsis: makeBooleanProp(void 0),
  /**
   * 必填星号位置
   */
  asteriskPosition: String as PropType<CellAsteriskPosition>,
  /**
   * 是否隐藏必填星号
   */
  hideAsterisk: makeBooleanProp(void 0),
  /**
   * 前置图标自定义类名
   */
  customPrefixClass: makeStringProp(''),
  /**
   * label 自定义类名
   */
  customLabelClass: makeStringProp(''),
  /**
   * value 自定义类名
   */
  customValueClass: makeStringProp(''),
  /**
   * title 自定义类名
   */
  customTitleClass: makeStringProp('')
}

export type FormItemProps = ExtractPropTypes<typeof formItemProps>

export type { FormValidateEvent }
