import type { ComponentPublicInstance, ExtractPropTypes, InjectionKey, PropType } from 'vue-lynx'
import { baseProps, makeBooleanProp, makeRequiredProp, makeStringProp, numericProp } from '../../common/props'
import type { CellAsteriskPosition, CellLayout, CellSize, CellValueAlign } from '../wd-cell/types'
import { FORM_KEY, type FormProvide } from '../../composables/useFormDisabled'
import type { FormValidateEvent } from '../../composables/useFormItemValidate'

// 兼容历史从 wd-form/types 深度导入的用法
export { FORM_KEY }
export type { FormProvide }

export const FORM_VALIDATE_EVENTS = ['change', 'blur', 'submit'] as const

export type { FormValidateEvent }

export type FormValidateTrigger = FormValidateEvent

export type FormValidateTriggerInput = FormValidateTrigger | FormValidateTrigger[]

export interface FormSchemaIssue {
  /** 字段路径 */
  path: Array<string | number>
  /** 错误信息 */
  message: string
}

export interface FormSchema {
  /** 校验模型，返回问题列表 */
  validate: (model: Record<string, any>) => FormSchemaIssue[] | Promise<FormSchemaIssue[]>
}

export interface ErrorMessage {
  prop: string
  message: string
}

export type FormRules = Record<string, any>

export const formProps = {
  ...baseProps,
  /**
   * 表单数据对象
   */
  model: makeRequiredProp(Object as PropType<Record<string, any>>),
  /**
   * 校验 schema（返回问题列表的校验器）
   */
  schema: Object as PropType<FormSchema>,
  /**
   * 校验触发时机
   */
  validateTrigger: {
    type: [String, Array] as PropType<FormValidateTriggerInput>,
    default: 'blur'
  },
  /**
   * 模型变化时重置校验提示
   */
  resetOnChange: makeBooleanProp(true),
  /**
   * 错误提示展示方式
   */
  errorType: makeStringProp<'none' | 'toast' | 'message'>('message'),
  /**
   * 是否禁用
   */
  disabled: makeBooleanProp(false),
  /**
   * 是否显示边框
   */
  border: makeBooleanProp(false),
  /**
   * 是否内容垂直居中
   */
  center: makeBooleanProp(false),
  /**
   * 单元格大小
   */
  size: String as PropType<CellSize>,
  /**
   * 左侧标题宽度
   */
  titleWidth: numericProp,
  /**
   * 布局方式
   */
  layout: String as PropType<CellLayout>,
  /**
   * 右侧内容对齐方式
   */
  valueAlign: String as PropType<CellValueAlign>,
  /**
   * 必填星号位置
   */
  asteriskPosition: String as PropType<CellAsteriskPosition>,
  /**
   * 是否隐藏必填星号
   */
  hideAsterisk: makeBooleanProp(false),
  /**
   * 右侧内容超出是否省略
   */
  ellipsis: makeBooleanProp(false)
}

export type FormProps = ExtractPropTypes<typeof formProps>

export type FormExpose = {
  /**
   * 校验表单
   */
  validate: (prop?: string | string[]) => Promise<{ valid: boolean; errors: ErrorMessage[] }>
  /**
   * 重置表单项的验证提示
   */
  reset: () => void
}

export type FormInstance = ComponentPublicInstance<FormProps, FormExpose>
