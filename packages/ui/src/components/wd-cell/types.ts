import type { ExtractPropTypes, PropType } from 'vue-lynx'
import { baseProps, makeBooleanProp, makeStringProp, makeNumericProp, numericProp } from '../../common/props'
import type { CellLayout, CellSize, CellValueAlign } from '../../composables/useCell'

// 兼容历史从 wd-cell/types 深度导入的用法
export type { CellLayout, CellSize, CellValueAlign }

/**
 * 必填星号位置
 * 可选值: 'start' | 'end'
 */
export type CellAsteriskPosition = 'start' | 'end'

/**
 * 箭头方向
 * 可选值: 'left' | 'up' | 'down' | 'right'
 */
export type CellArrowDirection = 'left' | 'up' | 'down' | 'right'

export const cellProps = {
  ...baseProps,
  /**
   * 左侧标题
   * 类型: string
   */
  title: String,
  /**
   * 右侧内容
   * 类型: string | number
   */
  value: makeNumericProp(''),
  /**
   * 占位内容
   * 类型: string
   */
  placeholder: String,
  /**
   * 前置图标名称
   * 类型: string
   */
  prefixIcon: String,
  /**
   * 后置图标名称
   * 类型: string
   */
  suffixIcon: String,
  /**
   * 图标大小
   * 类型: string | number
   */
  iconSize: numericProp,
  /**
   * 图标类名前缀
   * 类型: string
   */
  iconPrefix: String,
  /**
   * CSS 图标类名
   * 类型: boolean | string
   * 默认值: false
   */
  cssIcon: {
    type: [Boolean, String],
    default: false
  },
  /**
   * 标题下方的描述
   * 类型: string
   */
  label: String,
  /**
   * 点击后跳转的页面地址（经 uni 兼容层下发）
   * 类型: string
   */
  to: String,
  /**
   * 跳转时是否替换当前页面
   * 类型: boolean
   * 默认值: false
   */
  replace: makeBooleanProp(false),
  /**
   * 是否可点击
   * 类型: boolean
   * 默认值: false
   */
  clickable: makeBooleanProp(false),
  /**
   * 是否展示右侧箭头
   * 类型: boolean
   * 默认值: false
   */
  isLink: makeBooleanProp(false),
  /**
   * 单元格大小
   * 类型: CellSize
   * 可选值: 'large'
   */
  size: String as PropType<CellSize>,
  /**
   * 是否显示边框线（默认取 cell-group 配置）
   * 类型: boolean
   */
  border: makeBooleanProp(void 0),
  /**
   * 左侧标题宽度
   * 类型: string | number
   */
  titleWidth: numericProp,
  /**
   * 是否使内容垂直居中（默认取 cell-group 配置）
   * 类型: boolean
   */
  center: makeBooleanProp(void 0),
  /**
   * 是否显示必填星号
   * 类型: boolean
   * 默认值: false
   */
  required: makeBooleanProp(false),
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
   * 右侧内容超出是否省略
   * 类型: boolean
   * 默认值: false
   */
  ellipsis: makeBooleanProp(false),
  /**
   * 是否使用 title 插槽
   * 类型: boolean
   * 默认值: true
   */
  useTitleSlot: makeBooleanProp(true),
  /**
   * 是否使用 label 插槽
   * 类型: boolean
   * 默认值: true
   */
  useLabelSlot: makeBooleanProp(true),
  /**
   * 必填星号位置
   * 类型: CellAsteriskPosition
   * 可选值: 'start' | 'end'
   * 默认值: 'start'
   */
  asteriskPosition: makeStringProp<CellAsteriskPosition>('start'),
  /**
   * 是否隐藏必填星号
   * 类型: boolean
   * 默认值: false
   */
  hideAsterisk: makeBooleanProp(false),
  /**
   * 箭头方向
   * 类型: CellArrowDirection
   * 可选值: 'left' | 'up' | 'down' | 'right'
   * 默认值: 'right'
   */
  arrowDirection: makeStringProp<CellArrowDirection>('right'),
  /**
   * 前置图标自定义类名
   * 类型: string
   */
  customPrefixClass: makeStringProp(''),
  /**
   * 后置图标自定义类名
   * 类型: string
   */
  customSuffixClass: makeStringProp(''),
  /**
   * label 自定义类名
   * 类型: string
   */
  customLabelClass: makeStringProp(''),
  /**
   * value 自定义类名
   * 类型: string
   */
  customValueClass: makeStringProp(''),
  /**
   * title 自定义类名
   * 类型: string
   */
  customTitleClass: makeStringProp('')
}

export type CellProps = ExtractPropTypes<typeof cellProps>
