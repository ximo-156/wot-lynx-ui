import { computed, ref, type Ref } from 'vue-lynx'
import { deepClone, getType, isArray, isDef, isObj } from '../common/util'
import type { Numeric } from '../common/props'
import type { PickerOption } from '../common/picker'

/** 将一维/二维选项归一为列；空数组不创建虚假的空列。 */
export function formatColumnsData(
  array: Array<string | number | PickerOption | Array<string | number | PickerOption>>,
  valueKey: string,
  labelKey: string
): PickerOption[][] {
  if (!isArray(array) || array.length === 0) return []
  let tempArray: Array<string | number | PickerOption | Array<string | number | PickerOption>> = array
  const firstLevelTypeList = new Set(array.map(getType))
  if (firstLevelTypeList.size !== 1 && firstLevelTypeList.has('object')) {
    throw new Error('The columns are correct')
  }
  if (!isArray(array[0])) tempArray = [tempArray as Array<string | number | PickerOption>]
  return (tempArray as Array<Array<string | number | PickerOption>>).map((col) =>
    col.map((row) => {
      if (!isObj(row)) return { [valueKey]: row, [labelKey]: row } as PickerOption
      // 不修改消费者选项：字段别名补齐只作用于本组件的格式化副本。
      const option = { ...(row as Record<string, any>) }
      if (!Object.prototype.hasOwnProperty.call(option, valueKey) && !Object.prototype.hasOwnProperty.call(option, labelKey)) {
        throw new Error("Can't find valueKey and labelKey in columns")
      }
      if (!Object.prototype.hasOwnProperty.call(option, labelKey)) option[labelKey] = option[valueKey]
      if (!Object.prototype.hasOwnProperty.call(option, valueKey)) option[valueKey] = option[labelKey]
      return option as PickerOption
    })
  )
}

export interface UseSelectionOptions {
  valueKey: string
  labelKey: string
  childrenKey?: string
  cascade?: boolean
}

/** 选择器数据处理。options 可以是响应式对象或属性 getter，不在 setup 拍快照。 */
export function useSelection(options: UseSelectionOptions) {
  const formatColumns: Ref<PickerOption[][]> = ref([])
  const selectedIndex = ref<number[]>([])
  const selectedOptions = computed(() =>
    selectedIndex.value.map((row, col) => formatColumns.value[col]?.[row] ?? ({} as PickerOption))
  )
  const selectedValues = computed(() =>
    selectedIndex.value.map((row, col) => formatColumns.value[col]?.[row]?.[options.valueKey] as Numeric)
  )
  const selectedLabels = computed(() =>
    selectedIndex.value.map((row, col) => {
      const option = formatColumns.value[col]?.[row]
      return String(isDef(option?.[options.labelKey]) ? option[options.labelKey] : '')
    })
  )

  function selectWithValue(value: Numeric | Numeric[]) {
    if (formatColumns.value.length === 0) {
      selectedIndex.value = []
      return
    }
    const normalized: Numeric[] = !isDef(value) || (isArray(value) && value.length === 0)
      ? formatColumns.value.map((col) => col[0]?.[options.valueKey] as Numeric)
      : isArray(value) ? value as Numeric[] : [value as Numeric]
    const values = normalized.slice(0, formatColumns.value.length)
    let selected: number[] = []
    values.forEach((target, col) => {
      const column = formatColumns.value[col]
      const row = column.findIndex((option) => String(option[options.valueKey]) === String(target))
      selected = correctSelectedIndex(col, row < 0 ? 0 : row, selected)
    })
    selectedIndex.value = selected.slice(0, values.length)
  }

  function correctSelected(value: number[]): number[] {
    let selected = value.slice(0, formatColumns.value.length)
    selected.forEach((row, col) => {
      const column = formatColumns.value[col]
      const corrected = column.length ? Math.min(Math.max(row, 0), column.length - 1) : -1
      selected = correctSelectedIndex(col, corrected, selected)
    })
    return selected
  }

  /** 空列用 -1 表示无选择，保持列索引对齐，不能遗留以前的非空选择。 */
  function correctSelectedIndex(columnIndex: number, rowIndex: number, selected: number[]): number[] {
    const col = formatColumns.value[columnIndex]
    const select = [...selected]
    if (!col || col.length === 0) {
      select[columnIndex] = -1
      return select
    }
    if (!col[rowIndex]) {
      console.error(`[wd-picker-view] The value to select with Col:${columnIndex} Row:${rowIndex} is incorrect`)
      return select
    }
    select[columnIndex] = rowIndex
    if (col[rowIndex].disabled) {
      const prev = col.slice(0, rowIndex).reverse().findIndex((item) => !item.disabled)
      const next = col.slice(rowIndex + 1).findIndex((item) => !item.disabled)
      if (prev !== -1) select[columnIndex] = rowIndex - 1 - prev
      else if (next !== -1) select[columnIndex] = rowIndex + 1 + next
    }
    return select
  }

  function getChangeColumnIndex(now: number[], origin: number[]): number {
    return now && origin ? now.findIndex((row, index) => row !== origin[index]) : -1
  }
  function getColumnIndex(columnIndex: number): number { return selectedIndex.value[columnIndex] }
  function getColumnData(columnIndex: number): PickerOption[] { return formatColumns.value[columnIndex] }
  function getColumnsData(): PickerOption[][] { return deepClone(formatColumns.value) }

  function buildCascadeColumns(data: PickerOption[], values: Numeric[]): PickerOption[][] {
    const result: PickerOption[][] = []
    let currentLevel = data || []
    const childrenKey = options.childrenKey || 'children'
    if (currentLevel.length > 0) result.push(currentLevel)
    for (const value of values || []) {
      const selected = currentLevel.find((item) => String(item[options.valueKey]) === String(value))
      const children = selected?.[childrenKey]
      if (isArray(children) && children.length > 0) {
        currentLevel = children as PickerOption[]
        result.push(currentLevel)
      } else break
    }
    return result
  }

  /** 重建变化列之后的各列，优先选择首个非禁用项。 */
  function updateCascadeColumns(
    rootData: PickerOption[], changedColumnIndex: number
  ): { columns: PickerOption[][]; selectedIndex: number[] } {
    if (!rootData?.length) return { columns: [], selectedIndex: [] }
    const columns: PickerOption[][] = [rootData]
    const nextSelectedIndex: number[] = []
    const childrenKey = options.childrenKey || 'children'
    let currentLevel = rootData
    for (let col = 0; col <= changedColumnIndex && col < selectedIndex.value.length; col++) {
      const index = selectedIndex.value[col]
      const selected = currentLevel[index]
      nextSelectedIndex.push(index)
      const children = selected?.[childrenKey]
      if (isArray(children) && children.length > 0) {
        currentLevel = children as PickerOption[]
        columns.push(currentLevel)
      } else return { columns, selectedIndex: nextSelectedIndex }
    }
    while (currentLevel.length > 0) {
      const firstEnabled = currentLevel.findIndex((item) => !item.disabled)
      const index = firstEnabled < 0 ? 0 : firstEnabled
      const selected = currentLevel[index]
      nextSelectedIndex.push(index)
      const children = selected?.[childrenKey]
      if (isArray(children) && children.length > 0) {
        currentLevel = children as PickerOption[]
        columns.push(currentLevel)
      } else break
    }
    return { columns, selectedIndex: nextSelectedIndex }
  }

  function resetColumns(columns: any) {
    formatColumns.value = formatColumnsData(columns, options.valueKey, options.labelKey)
  }

  return {
    formatColumns, selectedIndex, selectedOptions, selectedValues, selectedLabels,
    selectWithValue, correctSelected, correctSelectedIndex, getChangeColumnIndex,
    getColumnIndex, getColumnData, getColumnsData, buildCascadeColumns, updateCascadeColumns, resetColumns
  }
}
