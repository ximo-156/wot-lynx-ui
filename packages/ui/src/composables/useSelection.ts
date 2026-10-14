import { computed, ref, watch, type Ref } from 'vue-lynx'
import { deepClone, getType, isArray, isDef, isObj } from '../common/util'
import type { Numeric } from '../common/props'
import type { PickerOption } from '../components/wd-picker-view/types'

/**
 * 列数据格式化：统一为二维 PickerOption 数组。
 */
export function formatColumnsData(
  array: Array<string | number | PickerOption | Array<string | number | PickerOption>>,
  valueKey: string,
  labelKey: string
): PickerOption[][] {
  let tempArray: Array<string | number | PickerOption | Array<string | number | PickerOption>> = isArray(array) ? array : [array]
  const firstLevelTypeList = new Set(array.map(getType))
  if (firstLevelTypeList.size !== 1 && firstLevelTypeList.has('object')) {
    throw new Error('The columns are correct')
  }
  if (!isArray(array[0])) {
    tempArray = [tempArray as Array<string | number | PickerOption>]
  }
  return (tempArray as Array<Array<string | number | PickerOption>>).map((col) =>
    col.map((row) => {
      if (!isObj(row)) {
        return { [valueKey]: row, [labelKey]: row } as PickerOption
      }
      const option = row as Record<string, any>
      if (!Object.prototype.hasOwnProperty.call(option, valueKey) && !Object.prototype.hasOwnProperty.call(option, labelKey)) {
        throw new Error("Can't find valueKey and labelKey in columns")
      }
      if (!Object.prototype.hasOwnProperty.call(option, labelKey)) {
        option[labelKey] = option[valueKey]
      }
      if (!Object.prototype.hasOwnProperty.call(option, valueKey)) {
        option[valueKey] = option[labelKey]
      }
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

/**
 * 选择器数据处理：列数据、选中索引、级联构建。
 */
export function useSelection(options: UseSelectionOptions) {
  const { valueKey, labelKey, childrenKey = 'children', cascade = false } = options

  const formatColumns: Ref<PickerOption[][]> = ref<PickerOption[][]>([])
  const selectedIndex = ref<number[]>([])

  const selectedOptions = computed(() => selectedIndex.value.map((row, col) => formatColumns.value[col][row]))

  const selectedValues = computed(() =>
    selectedIndex.value.map((row, col) => formatColumns.value[col][row][valueKey] as Numeric)
  )

  const selectedLabels = computed(() =>
    selectedIndex.value.map((row, col) =>
      String(isDef(formatColumns.value[col][row][labelKey]) ? formatColumns.value[col][row][labelKey] : '')
    )
  )

  /** 根据 value 选中 */
  function selectWithValue(value: Numeric | Numeric[]) {
    if (formatColumns.value.length === 0) {
      selectedIndex.value = []
      return
    }
    let normalizedValue: Numeric[]
    if (!isDef(value) || (isArray(value) && value.length === 0)) {
      normalizedValue = formatColumns.value.map((col) => col[0][valueKey] as Numeric)
    } else {
      normalizedValue = isArray(value) ? (value as Numeric[]) : [value as Numeric]
    }
    const slicedValue = normalizedValue.slice(0, formatColumns.value.length)
    let selected: number[] = [...selectedIndex.value]
    slicedValue.forEach((target, col) => {
      let row = formatColumns.value[col].findIndex((r) => r[valueKey]?.toString() === target.toString())
      row = row === -1 ? 0 : row
      selected = correctSelectedIndex(col, row, selected)
    })
    selectedIndex.value = selected.slice(0, slicedValue.length)
  }

  function correctSelected(value: number[]): number[] {
    let selected = [...value]
    value.forEach((row, col) => {
      row = Math.min(Math.max(row, 0), formatColumns.value[col].length - 1)
      selected = correctSelectedIndex(col, row, selected)
    })
    return selected
  }

  /** 修正指定列行：禁用项自动就近迁移 */
  function correctSelectedIndex(columnIndex: number, rowIndex: number, selected: number[]): number[] {
    const col = formatColumns.value[columnIndex]
    if (!col || !col[rowIndex]) {
      console.error(`[wd-picker-view] The value to select with Col:${columnIndex} Row:${rowIndex} is incorrect`)
      return selected
    }
    const select = [...selected]
    select[columnIndex] = rowIndex
    if (col[rowIndex].disabled) {
      const prev = col.slice(0, rowIndex).reverse().findIndex((s) => !s.disabled)
      const next = col.slice(rowIndex + 1).findIndex((s) => !s.disabled)
      if (prev !== -1) {
        select[columnIndex] = rowIndex - 1 - prev
      } else if (next !== -1) {
        select[columnIndex] = rowIndex + 1 + next
      } else {
        select[columnIndex] = rowIndex
      }
    }
    return select
  }

  function getChangeColumnIndex(now: number[], origin: number[]): number {
    if (!now || !origin) return -1
    return now.findIndex((row, index) => row !== origin[index])
  }

  function getColumnIndex(columnIndex: number): number {
    return selectedIndex.value[columnIndex]
  }

  function getColumnData(columnIndex: number): PickerOption[] {
    return formatColumns.value[columnIndex]
  }

  function getColumnsData(): PickerOption[][] {
    return deepClone(formatColumns.value)
  }

  /** 从树形数据构建多列 */
  function buildCascadeColumns(data: PickerOption[], selectedValues: Numeric[]): PickerOption[][] {
    const result: PickerOption[][] = []
    let currentLevel = data
    if (currentLevel.length > 0) {
      result.push(currentLevel)
    }
    for (let i = 0; i < selectedValues.length; i++) {
      const value = selectedValues[i]
      const selected = currentLevel.find((item) => item[valueKey]?.toString() === value.toString())
      if (selected && selected[childrenKey] && (selected[childrenKey] as PickerOption[]).length > 0) {
        currentLevel = selected[childrenKey] as PickerOption[]
        result.push(currentLevel)
      } else {
        break
      }
    }
    return result
  }

  /** 级联模式下列变化时重建后续列 */
  function updateCascadeColumns(rootData: PickerOption[], changedColumnIndex: number): PickerOption[][] {
    const result: PickerOption[][] = []
    let currentLevel = rootData
    for (let col = 0; col <= changedColumnIndex; col++) {
      result.push(currentLevel)
      const selectedValue = selectedIndex.value[col]
      const selected = currentLevel.find((item, index) => index === selectedValue)
      if (selected && selected[childrenKey] && (selected[childrenKey] as PickerOption[]).length > 0) {
        currentLevel = selected[childrenKey] as PickerOption[]
      } else {
        break
      }
    }
    return result
  }

  function resetColumns(columns: any) {
    formatColumns.value = formatColumnsData(columns as any, valueKey, labelKey)
  }

  return {
    formatColumns,
    selectedIndex,
    selectedOptions,
    selectedValues,
    selectedLabels,
    selectWithValue,
    correctSelected,
    correctSelectedIndex,
    getChangeColumnIndex,
    getColumnIndex,
    getColumnData,
    getColumnsData,
    buildCascadeColumns,
    updateCascadeColumns,
    resetColumns
  }
}
