import type { ExtractPropTypes, PropType } from 'vue-lynx'
import { baseProps, makeBooleanProp, numericProp } from '../../common/props'
import type { CellLayout, CellSize, CellValueAlign } from '../../composables/useCell'
import { CELL_GROUP_KEY } from '../../composables/useCell'

// 兼容历史从 wd-cell-group/types 深度导入的用法
export { CELL_GROUP_KEY }
export type { CellLayout, CellSize, CellValueAlign }

export const cellGroupProps = {
  ...baseProps,
  /**
   * 分组标题
   * 类型: string
   */
  title: String,
  /**
   * 分组右侧内容
   * 类型: string
   */
  value: String,
  /**
   * 是否展示外边框
   * 类型: boolean
   * 默认值: false
   */
  border: makeBooleanProp(false),
  /**
   * 是否展示为圆角卡片风格
   * 类型: boolean
   * 默认值: false
   */
  insert: makeBooleanProp(false),
  /**
   * 是否使内容垂直居中
   * 类型: boolean
   * 默认值: false
   */
  center: makeBooleanProp(false),
  /**
   * 单元格大小
   * 类型: CellSize
   * 可选值: 'large'
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
  valueAlign: String as PropType<CellValueAlign>
}

export type CellGroupProps = ExtractPropTypes<typeof cellGroupProps>
