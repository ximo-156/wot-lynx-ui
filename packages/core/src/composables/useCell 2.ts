import { computed, type InjectionKey } from 'vue-lynx'
import { useParent } from './useParent'

/** 单元格布局方式 */
export type CellLayout = 'horizontal' | 'vertical'

/** 单元格右侧内容对齐方式 */
export type CellValueAlign = 'left' | 'right' | 'center'

/** 单元格尺寸 */
export type CellSize = 'large'

/** WdCellGroup 向下提供的上下文（props 快照） */
export type CellGroupProvide = {
  props: {
    /** 是否显示边框线 */
    border?: boolean
    /** 是否使内容垂直居中 */
    center?: boolean
    /** 单元格大小 */
    size?: CellSize
    /** 左侧标题宽度 */
    titleWidth?: string | number
    /** 单元格布局方式 */
    layout?: CellLayout
    /** 右侧内容对齐方式 */
    valueAlign?: CellValueAlign
  }
}

export const CELL_GROUP_KEY: InjectionKey<CellGroupProvide> = Symbol('wd-cell-group')

export function useCell() {
  const { parent: cellGroup, index } = useParent(CELL_GROUP_KEY)

  const border = computed(() => {
    return cellGroup?.value && cellGroup.value.props.border && index.value
  })

  const center = computed(() => {
    return cellGroup.value?.props.center
  })

  const size = computed<CellSize | undefined>(() => {
    return cellGroup.value?.props.size
  })

  const titleWidth = computed(() => {
    return cellGroup.value?.props.titleWidth
  })

  const layout = computed<CellLayout | undefined>(() => {
    return cellGroup.value?.props.layout || undefined
  })

  const valueAlign = computed<CellValueAlign | undefined>(() => {
    return cellGroup.value?.props.valueAlign || undefined
  })

  return { border, center, size, titleWidth, layout, valueAlign }
}
