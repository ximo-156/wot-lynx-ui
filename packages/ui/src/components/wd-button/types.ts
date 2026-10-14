import type { ExtractPropTypes, PropType } from 'vue-lynx'
import { baseProps, makeBooleanProp, makeNumberProp, makeStringProp } from '../../common/props'
import type { LoadingProps } from '../wd-loading/types'
import type { ButtonSize, ButtonType, ButtonVariant } from '../../composables/global-config'

// 兼容历史从 wd-button/types 深度导入的用法
export type { ButtonSize, ButtonType, ButtonVariant }

export const buttonProps = {
  ...baseProps,
  /**
   * 是否圆角
   * 类型: boolean
   * 默认值: false
   */
  round: makeBooleanProp(false),
  /**
   * 是否禁用
   * 类型: boolean
   * 默认值: false
   */
  disabled: makeBooleanProp(false),
  /**
   * 是否为细线（plain / dashed 变体下 1ppx 描边）
   * 类型: boolean
   * 默认值: false
   */
  hairline: makeBooleanProp(false),
  /**
   * 是否撑满父容器
   * 类型: boolean
   * 默认值: false
   */
  block: makeBooleanProp(false),
  /**
   * 类型
   * 类型: ButtonType
   * 可选值: 'primary' | 'success' | 'info' | 'warning' | 'danger'
   * 默认值: 'primary'
   */
  type: makeStringProp<ButtonType>('primary'),
  /**
   * 尺寸
   * 类型: ButtonSize
   * 可选值: 'mini' | 'small' | 'medium' | 'large'
   * 默认值: 'medium'
   */
  size: makeStringProp<ButtonSize>('medium'),
  /**
   * 图标名称（wd-icon 的 name）
   * 类型: string
   */
  icon: String,
  /**
   * 图标类名前缀
   * 类型: string
   * 默认值: wd-icon
   */
  classPrefix: makeStringProp('wd-icon'),
  /**
   * CSS 图标类名（配合 UnoCSS 等）
   * 类型: boolean | string
   * 默认值: false
   */
  cssIcon: {
    type: [Boolean, String],
    default: false
  },
  /**
   * 是否加载中
   * 类型: boolean
   * 默认值: false
   */
  loading: makeBooleanProp(false),
  /**
   * 加载指示器颜色（默认继承按钮文字色）
   * 类型: string
   */
  loadingColor: String,
  /**
   * 加载配置项（透传给 wd-loading）
   * 类型: object
   */
  loadingProps: Object as PropType<Partial<LoadingProps>>,
  /**
   * 按钮文字
   * 类型: string
   */
  text: String,
  /**
   * 变体
   * 类型: ButtonVariant
   * 可选值: 'base' | 'plain' | 'dashed' | 'soft' | 'subtle' | 'text'
   * 默认值: 'base'
   */
  variant: makeStringProp<ButtonVariant>('base')
}

export type ButtonProps = ExtractPropTypes<typeof buttonProps>
