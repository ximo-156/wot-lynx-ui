import type { ExtractPropTypes, PropType } from 'vue-lynx'
import { baseProps, makeBooleanProp, makeStringProp, numericProp } from '../../common/props'
import type { CellAsteriskPosition, CellLayout, CellSize, CellValueAlign } from '../wd-cell/types'
import { FORM_ITEM_DISABLED_KEY, type FormItemDisabledProvide } from '../../composables/useFormDisabled'
import { FORM_ITEM_VALIDATE_KEY, type FormItemValidateProvide } from '../../composables/useFormItemValidate'
import type { FormValidateEvent, FormValidateTrigger } from '../wd-form/types'

// 兼容历史从 wd-form-item/types 深度导入的用法：
// 本地共享契约（FORM_ITEM_VALIDATE_KEY / FormItemValidateProvide /
// FORM_ITEM_DISABLED_KEY / FormItemDisabledProvide）上移到 composables 层，
// 此处按原路径再导出，保持 `wd-form-item/types` 的公开 API 不变。
export { FORM_ITEM_DISABLED_KEY, FORM_ITEM_VALIDATE_KEY }
export type { FormItemDisabledProvide, FormItemValidateProvide }

export const formItemProps = {
  ...baseProps,
  /**
   * 表单域 model 字段名
   */
  prop: String,
  /**
   * 标题
   */
  title: String,
  /**
   * 右侧展示值，用于配合 placeholder 判断是否显示占位文字
   * 类型: string | number
   */
  value: numericProp,
  /**
   * 值为空时显示的占位文字，需与 value 配合使用
   * 类型: string
   */
  placeholder: String,
  /**
   * 前置图标类名
   */
  prefixIcon: String,
  /**
   * 图标大小
   */
  iconSize: numericProp,
  /**
   * 类名前缀，用于使用自定义图标
   */
  iconPrefix: String,
  /**
   * CSS 图标，用法参考 Icon 组件
   */
  cssIcon: {
    type: [Boolean, String],
    default: false
  },
  /**
   * 描述信息
   */
  label: String,
  /**
   * 是否开启点击反馈
   */
  clickable: makeBooleanProp(false),
  /**
   * 是否展示右侧箭头并开启点击反馈
   */
  isLink: makeBooleanProp(false),
  /**
   * 是否禁用表单项，禁用时不触发点击事件，未设置时继承 Form
   */
  disabled: makeBooleanProp(void 0),
  // ========== 可继承属性（使用 undefined 默认值）==========
  /**
   * 设置单元格大小，可选值：large
   * 类型: CellSize
   */
  size: String as PropType<CellSize>,
  /**
   * 是否展示边框线
   * 类型: boolean
   */
  border: makeBooleanProp(void 0),
  /**
   * 设置左侧标题宽度
   * 类型: string | number
   */
  titleWidth: numericProp,
  /**
   * 是否使内容垂直居中
   * 类型: boolean
   */
  center: makeBooleanProp(void 0),
  /**
   * 是否必填
   * 类型: boolean
   */
  required: makeBooleanProp(void 0),
  /**
   * 校验触发时机
   */
  validateTrigger: [String, Array] as PropType<FormValidateTrigger | FormValidateTrigger[]>,
  /**
   * 表单布局方式
   * 类型: CellLayout
   * 可选值: 'horizontal' | 'vertical'
   */
  layout: String as PropType<CellLayout>,
  /**
   * value 文字对齐方式
   * 类型: CellValueAlign
   * 可选值: 'left' | 'right' | 'center'
   */
  valueAlign: String as PropType<CellValueAlign>,
  /**
   * 是否超出隐藏，显示省略号
   * 类型: boolean
   */
  ellipsis: makeBooleanProp(void 0),
  /**
   * 必填星号位置
   * 类型: CellAsteriskPosition
   * 可选值: 'start' | 'end'
   */
  asteriskPosition: String as PropType<CellAsteriskPosition>,
  /**
   * 是否隐藏必填星号
   * 类型: boolean
   */
  hideAsterisk: makeBooleanProp(void 0),
  /**
   * 前置图标自定义样式类
   */
  customPrefixClass: makeStringProp(''),
  /**
   * label 使用 slot 时的自定义样式
   */
  customLabelClass: makeStringProp(''),
  /**
   * value 使用 slot 时的自定义样式
   */
  customValueClass: makeStringProp(''),
  /**
   * title 使用 slot 时的自定义样式
   */
  customTitleClass: makeStringProp('')
}

export type FormItemProps = ExtractPropTypes<typeof formItemProps>

export type { FormValidateEvent }
