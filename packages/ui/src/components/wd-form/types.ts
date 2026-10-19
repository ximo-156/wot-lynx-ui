import type { ComponentPublicInstance, ExtractPropTypes, PropType } from 'vue-lynx'
import { baseProps, makeBooleanProp, makeRequiredProp, numericProp } from '../../common/props'
import type { CellAsteriskPosition, CellLayout, CellSize, CellValueAlign } from '../wd-cell/types'
import { FORM_KEY, type FormProvide } from '../../composables/useFormDisabled'
import type { FormValidateEvent } from '../../composables/useFormItemValidate'

// 兼容历史从 wd-form/types 深度导入的用法：
// 本地共享契约（FORM_KEY / FormProvide）上移到 composables/useFormDisabled，
// 此处按原路径再导出，保持 `wd-form/types` 的公开 API 不变。
export { FORM_KEY }
export type { FormProvide }

export type FormSchemaIssue = {
  path: Array<string | number>
  message: string
}

export type FormSchema = {
  validate: (model: Record<string, any>) => FormSchemaIssue[] | Promise<FormSchemaIssue[]>
  isRequired?: (path: string) => boolean | undefined
}

export const FORM_VALIDATE_EVENTS = ['change', 'blur', 'submit'] as const

export type { FormValidateEvent }

export type FormValidateTrigger = FormValidateEvent

export type FormValidateTriggerInput = FormValidateTrigger | FormValidateTrigger[]

export type ErrorMessage = {
  prop: string
  message: string
}

export const formProps = {
  ...baseProps,
  /**
   * 表单数据对象
   */
  model: makeRequiredProp(Object as PropType<Record<string, any>>),
  /**
   * 表单验证规则
   */
  schema: Object as PropType<FormSchema>,
  /**
   * 校验触发时机
   */
  validateTrigger: {
    type: [String, Array] as PropType<FormValidateTriggerInput>,
    default: 'submit'
  },
  /**
   * 是否在输入时重置表单校验信息
   */
  resetOnChange: makeBooleanProp(true),
  /**
   * 错误提示类型
   */
  errorType: {
    type: String as PropType<'toast' | 'message' | 'none'>,
    default: 'message'
  },
  /**
   * 是否禁用表单内支持禁用态的表单控件
   */
  disabled: makeBooleanProp(false),
  // ========== 公共配置属性（可被 form-item 继承）==========
  /**
   * 是否展示边框线
   * 类型: boolean
   * 默认值: false
   */
  border: makeBooleanProp(false),
  /**
   * 是否使内容垂直居中
   * 类型: boolean
   * 默认值: false
   */
  center: makeBooleanProp(false),
  /**
   * 单元格大小，可选值: 'large'
   * 类型: CellSize
   */
  size: String as PropType<CellSize>,
  /**
   * 左侧标题宽度
   * 类型: string | number
   */
  titleWidth: numericProp,
  /**
   * 单元格布局方式
   * 类型: CellLayout
   * 可选值: 'horizontal' | 'vertical'
   */
  layout: String as PropType<CellLayout>,
  /**
   * 右侧内容对齐方式
   * 类型: CellValueAlign
   * 可选值: 'left' | 'right' | 'center'
   */
  valueAlign: String as PropType<CellValueAlign>,
  /**
   * 必填星号位置
   * 类型: CellAsteriskPosition
   * 可选值: 'start' | 'end'
   */
  asteriskPosition: String as PropType<CellAsteriskPosition>,
  /**
   * 是否隐藏必填星号
   * 类型: boolean
   * 默认值: false
   */
  hideAsterisk: makeBooleanProp(false),
  /**
   * 是否超出隐藏显示省略号
   * 类型: boolean
   * 默认值: false
   */
  ellipsis: makeBooleanProp(false)
}
export type FormProps = ExtractPropTypes<typeof formProps>

export type FormExpose = {
  /**
   * 表单校验
   * @param prop 指定校验字段
   */
  validate: (prop?: string | Array<string>) => Promise<{
    valid: boolean
    errors: ErrorMessage[]
  }>
  /**
   * 重置表单项的验证提示
   */
  reset: () => void
}

export type FormInstance = ComponentPublicInstance<FormProps, FormExpose>
