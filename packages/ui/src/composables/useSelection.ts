import { computed, ref, watch, type Ref } from 'vue-lynx'
import { deepClone, getType, isArray, isDef, isObj } from '../common/util'
import type { Numeric } from '../common/props'
// 类型来自 L2（common），不得反向 import 组件（INV-1 / ARCHITECTURE §2.3）
import type { PickerOption } from '../common/picker'

/**
 * 列数据格式化：统一为二维 PickerOption 数组。
 *
 * 空数组（columns: [] / 不传 options）直接返回 []——不能包成 [[]]：
 * 空列会让 selectedIndex 之类逻辑在 col[0] 上取到 undefined
 * （wd-cascader 不传 options 打开即崩的根因）。
 */
export function formatColumnsData(
  array: Array<string | number | PickerOption | Array<string | number | PickerOption>>,
  valueKey: string,
  labelKey: string
): PickerOption[][] {
  if (!isArray(array) || array.length === 0) return []
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

  // 取值一律经可选链：columns 缩减 / 清空时 selectedIndex 可能短暂残留旧下标，
  // 直接两段下标会在渲染或 expose 取值时抛 TypeError（真机整卡崩溃）。
  const selectedOptions = computed(() =>
    selectedIndex.value.map((row, col) => formatColumns.value[col]?.[row] ?? ({} as PickerOption))
  )

  const selectedValues = computed(() =>
    selectedIndex.value.map((row, col) => formatColumns.value[col]?.[row]?.[valueKey] as Numeric)
  )

  const selectedLabels = computed(() =>
    selectedIndex.value.map((row, col) => {
      const option = formatColumns.value[col]?.[row]
      return String(isDef(option?.[labelKey]) ? option[labelKey] : '')
    })
  )

  /** 根据 value 选中 */
  function selectWithValue(value: Numeric | Numeric[]) {
    if (formatColumns.value.length === 0) {
      selectedIndex.value = []
      return
    }
    let normalizedValue: Numeric[]
    if (!isDef(value) || (isArray(value) && value.length === 0)) {
      // 空列（columns: [[]]）时 col[0] 为 undefined，可选链避免 TypeError
      normalizedValue = formatColumns.value.map((col) => col[0]?.[valueKey] as Numeric)
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

  /**
   * 级联模式下列变化时重建后续列。
   *
   * 与 wot-ui 对齐：重建范围覆盖「变化列及其后所有列」——变化列之后的每一列
   * 自动选中首个可用（非禁用）项。因此返回值同时包含新列数据与新的选中索引，
   * 由调用方显式写回 formatColumns / selectedIndex（本 composable 的函数只
   * 返回值、不自身赋值，保持纯函数语义）。
   *
   * @param rootData 根级（树形）数据
   * @param changedColumnIndex 发生变化的列索引
   * @returns columns 重建后的列数据；selectedIndex 重建后的选中索引
   */
  function updateCascadeColumns(
    rootData: PickerOption[],
    changedColumnIndex: number
  ): { columns: PickerOption[][]; selectedIndex: number[] } {
    const columns: PickerOption[][] = [rootData]
    const nextSelectedIndex: number[] = []
    let currentLevel = rootData

    // 重建到变化列（含变化列）：沿用当前各列选中索引
    for (let col = 0; col <= changedColumnIndex && col < selectedIndex.value.length; col++) {
      const index = selectedIndex.value[col]
      const selected = currentLevel[index]
      nextSelectedIndex.push(index)
      if (selected && selected[childrenKey] && (selected[childrenKey] as PickerOption[]).length > 0) {
        currentLevel = selected[childrenKey] as PickerOption[]
        columns.push(currentLevel)
      } else {
        break
      }
    }

    // 继续构建变化列之后的列：每列自动选中首个可用项（非禁用）
    while (currentLevel.length > 0) {
      const firstEnabled = currentLevel.findIndex((item) => !item.disabled)
      const index = firstEnabled !== -1 ? firstEnabled : 0
      const selected = currentLevel[index]
      if (selected && selected[childrenKey] && (selected[childrenKey] as PickerOption[]).length > 0) {
        nextSelectedIndex.push(index)
        currentLevel = selected[childrenKey] as PickerOption[]
        columns.push(currentLevel)
      } else {
        // 末列没有子级时仍需记录其选中索引
        if (columns.length > nextSelectedIndex.length) {
          nextSelectedIndex.push(index)
        }
        break
      }
    }

    return { columns, selectedIndex: nextSelectedIndex }
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
