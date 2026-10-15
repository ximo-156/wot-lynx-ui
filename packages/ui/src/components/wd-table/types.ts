import type { ExtractPropTypes, PropType } from 'vue-lynx'
import { baseProps, makeArrayProp, makeBooleanProp, makeRequiredProp, makeStringProp } from '../../common/props'

export interface TableColumn {
  prop: string
  label: string
  width?: string | number
  fixed?: boolean
  align?: 'left' | 'center' | 'right'
  sortable?: boolean
}

export type TableSlotProps = {
  row: Record<string, any>
  column: TableColumn
  rowIndex: number
  columnIndex: number
  rowspan: number
  colspan: number
}

export const tableProps = {
  ...baseProps,
  /**
   * 表格数据
   */
  data: makeRequiredProp(Array as PropType<Record<string, any>[]>),
  /**
   * 列配置
   */
  columns: makeArrayProp<TableColumn>(),
  /**
   * 是否显示边框
   */
  border: makeBooleanProp(true),
  /**
   * 是否斑马纹
   */
  stripe: makeBooleanProp(false),
  /**
   * 空数据文字
   */
  emptyText: makeStringProp('暂无数据')
}

export type TableProps = ExtractPropTypes<typeof tableProps>
