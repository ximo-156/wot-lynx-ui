/*
 * wd-picker-view — 选择器视图（原生优先重写版）
 *
 * Lynx 实现说明（相对既有后台线程实现的重写点）：
 * - **跟手走后台 touchmove 状态驱动**（2026-10-25 真机巡检回归）：列内容
 *   `@touchmove` 以「起点位移 + 手指位移」公式换算后写入 offsets（响应式），
 *   重渲染下发 transform；跟手期 transition 显式为 none（draggingCount>0，
 *   Style Funnel 两态都写同一键，CONVENTIONS §20）。此前版本的
 *   main-thread-bindtouch* worklet 跟手在真机出现列文字双份叠印 / 内嵌列
 *   空白（图四/图六缺陷，MT 事件绑定与渲染互扰），与 wot-ui 对齐退回纯
 *   后台跟手（wot 参考实现本就是逻辑层状态驱动）；
 * - **落定走同一公式**：touchend 由 changedTouches 坐标重算终值、对齐到
 *   最近列项后 commit（selectedIndex / offsets），并派发 pickend + change；
 * - **拖动期间选中态不被外部抢写**：dragging 标志守卫 offsets watch
 *   （外部选中索引变化不得在拖动期间抢位移）；
 * - **immediateChange**：按官方原生 picker-view 契约，true 在手指松开时
 *   提交 change，false 在 200ms 吸附过渡结束时提交；touchmove 不提交。
 *   pickend 在吸附结束后发出，外部改值、配置改变、卸载取消过时任务；
 * - **几何免度量**：itemHeight / 列项数均为渲染期已知量，处理器内直接
 *   计算，不调用 invoke / getRect；
 * - 数据逻辑（列格式化 / 选中索引 / 级联构建）在 composables/useSelection，
 *   本组件只负责触摸与渲染；
 * - 禁用项自动就近迁移（correctSelected）。
 * - **跟手帧零冗余样式下发**（2026-11-10 真机卡顿反馈排查）：@vue/runtime-core
 *   （3.5.43）patchElement 对 `patchFlag & STYLE` 的元素**无条件**调用
 *   hostPatchProp——没有 `prev !== next` 守卫（runtime-core.cjs.js:
 *   `if (patchFlag & 4) hostPatchProp(el, 'style', …)`），而 vue-lynx 的
 *   patchProp 会把整个 style 对象推成一条 SET_STYLE op 下发主线程。于是
 *   「后台响应式跟手」每帧重渲染时，列项 / 补位 / 遮罩 / 指示带这些**位移之外
 *   什么都不变**的元素也会各下发一次。双线程测试环境实测（一条 SET_STYLE
 *   对应真机一次原生样式应用，量级同构）：5 列日期时间选择器 167 op/帧，
 *   其中 157 个来自 147 个列项 + 10 个补位。对策：
 *     · 列项 / 整列 / 遮罩 / 指示带加 `v-memo`——withMemo 命中时返回**同一个
 *       vnode 对象**，patch 对 `n1 === n2` 直接早退，整段不 patch；
 *     · 列位移样式按列缓存（columnStyleOf），只有真正在拖的那列换新对象，
 *       列级 v-memo 才能把其余四列整体跳过；
 *     · v-memo 只能加在 v-for 元素本身或 v-for 之外的单元体上：加在 v-for
 *       内部的普通元素会共用同一个 `_withMemo` 缓存槽（编译器给的是模板常量
 *       index），多列会互相命中并把同一个元素复用成别列的子树。
 * - **内联样式一律对象语法**（CONVENTIONS §19）：列高、translateY 位移、
 *   指示带/遮罩尺寸全部依赖内联样式，字符串 :style 会被 vue-lynx 静默丢弃。
 * - **列项 view 不写行高/截断**（2026-10-25 真机巡检）：view 与内部 text
 *   双层同时带 line-height 时真机疑似双行盒各绘一遍（标签错行叠印），
 *   行高/字号/颜色只写在 `__column-label` 文本节点上（§8 text 不继承）。
 */
<script lang="ts" setup>
import './index.css'

import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue-lynx'
import { pickerViewProps, type PickerOption, type PickerViewExpose } from './types'
import { useSelection } from '../../composables/useSelection'
import { useAlive } from '../../composables/useAlive'
import { useLockScroll } from '../../composables/useLockScroll'
import { addUnit, isArray, isDef, isEqual, isObj, parseStyle } from '../../common/util'

// 外壳只 catch 冒泡，内容节点的 bind 跟手/落定先正常运行；不是 capture。
// 原生祖先的默认滚动仍由 Popup 的页面 scroll-enable 锁处理。
function stopColumnTouch() {}

const props = defineProps(pickerViewProps)
const emit = defineEmits(['change', 'pickstart', 'pickend', 'update:modelValue'])
const isAlive = useAlive()
const bgDragStart: Array<{ y: number; offset: number } | undefined> = []
const dragging: boolean[] = []
/** 拖动中的列数（>0 时列内容过渡显式为 none，Style Funnel 两态同键） */
const draggingCount = ref(0)
useLockScroll(() => draggingCount.value > 0)
// 每列 pickstart 是否已发出且 pickend 未落定：连续快速滑动时新手势接续
// 旧手势的 settle，必须视为同一段选择，pickstart/pickend 才能配对
const picking: boolean[] = []
const offsets = ref<number[]>([])
const settleTimers: Array<ReturnType<typeof setTimeout> | undefined> = []
let changeRequest = 0
function cancelGestures() {
  changeRequest++
  dragging.fill(false)
  if (draggingCount.value > 0) draggingCount.value = 0
  picking.fill(false)
  bgDragStart.fill(undefined)
  settleTimers.forEach((timer) => { if (timer !== undefined) clearTimeout(timer) })
  settleTimers.fill(undefined)
}
onBeforeUnmount(cancelGestures)

const {
  formatColumns,
  selectedIndex,
  selectedOptions,
  selectedValues,
  selectedLabels,
  selectWithValue,
  correctSelected,
  getChangeColumnIndex,
  getColumnIndex,
  getColumnData,
  getColumnsData,
  buildCascadeColumns,
  updateCascadeColumns,
  resetColumns
} = useSelection({
  get valueKey() { return props.valueKey },
  get labelKey() { return props.labelKey },
  get childrenKey() { return props.childrenKey },
  get cascade() { return props.cascade }
})

/**
 * 列数据格式化安全出口。
 *
 * `formatColumnsData` 对混用对象/原始值、缺少 valueKey/labelKey 的脏数据会
 * throw（对外 API 的既有契约）。但该调用发生在 watch 回调里，真机上抛错会
 * 变成未捕获异常并崩掉整张卡片。这里就地接住并降级为空列，保持页面可用。
 */
function safeResetColumns(columns: any) {
  try {
    resetColumns(columns)
  } catch (error) {
    console.error('[wd-picker-view] columns 数据不合法，已降级为空列（页面保持可用）：', error)
    formatColumns.value = []
    selectedIndex.value = []
  }
}

watch(
  () => JSON.stringify([props.columns, props.cascade, props.valueKey, props.labelKey, props.childrenKey]),
  () => {
    cancelGestures()
    safeResetColumns(props.columns)
    if (isCascadeTree() && isDef(props.modelValue)) {
      const values = isArray(props.modelValue) ? props.modelValue : [props.modelValue]
      formatColumns.value = buildCascadeColumns(props.columns as PickerOption[], values)
    }
    selectWithValue(props.modelValue)
  },
  { immediate: true }
)
watch(() => props.modelValue, (value) => {
  // A v-model acknowledgement is not a new interaction; an external replacement cancels settling.
  if (isEqual(value, selectedValues.value)) return
  cancelGestures()
  if (isCascadeTree() && isDef(value)) {
    formatColumns.value = buildCascadeColumns(props.columns as PickerOption[], isArray(value) ? value : [value])
  }
  selectWithValue(value)
}, { deep: true })
watch(() => props.itemHeight, cancelGestures, { flush: 'sync' })

/** 单列几何 */
const padHeight = computed(() => ((props.visibleItemCount - 1) / 2) * props.itemHeight)
const containerHeight = computed(() => props.itemHeight * props.visibleItemCount)

/**
 * 每列拖动起点（非响应式普通数组）：touchstart 写、touchmove / touchend 读。
 * 拖动期间 offsets 是唯一位移真源（跟手逐帧写入），起点仅作公式输入，
 * 不需要触发渲染，故不用 ref。
 *
 * 每列是否正在拖动（dragging，非响应式）：守卫 offsets watch（外部选中
 * 索引变化不得在拖动期间抢位移）与 touchmove / touchend 处理器；渲染层的
 * 过渡开关由响应式 draggingCount 承担。
 *
 * 每列当前位移（px，offsets）：Vue 状态，承担跟手渲染与落定后的样式下发、
 * 外部改值同步。
 */
watch(
  [selectedIndex, () => props.itemHeight],
  ([indexes]) => {
    indexes.forEach((idx, col) => {
      if (offsets.value[col] === undefined || Math.abs(offsets.value[col] - Math.max(0, idx) * props.itemHeight) > 0.5) {
        if (!dragging[col]) {
          offsets.value[col] = Math.max(0, idx) * props.itemHeight
        }
      }
    })
  },
  { immediate: true, deep: true }
)

const pickerViewStyle = computed(() => ({ height: addUnit(containerHeight.value) }))

/** 根节点样式（customStyle 为字符串，需 parseStyle 归一为对象，CONVENTIONS §19） */
const pickerStyle = computed(() => parseStyle(props.customStyle))

/**
 * 复用型样式对象：行高 / 上下留白 / 指示带在整列（乃至整组件）内是同一个值，
 * 提到 computed 后全列共用同一对象引用，避免每行每帧新建对象——3 列 × 60 行
 * 的渲染热路径上这是上百次分配（CONVENTIONS §16）。
 */
const itemHeightStyle = computed(() => ({ height: addUnit(props.itemHeight) }))
const padHeightStyle = computed(() => ({ height: addUnit(padHeight.value) }))
const indicatorStyle = computed(() => ({ top: addUnit(padHeight.value), height: addUnit(props.itemHeight) }))

/** 列落位过渡（与落位吸附时长一致；跟手期 draggingCount 驱动显式写 none） */
const COLUMN_TRANSITION = 'transform 0.2s cubic-bezier(0.645, 0.045, 0.355, 1)'

/**
 * 列内容位移与过渡（对象样式：字符串 :style 会被 vue-lynx 静默丢弃，CONVENTIONS §19）。
 *
 * 常驻下发落位吸附过渡；跟手期间（draggingCount>0）由后台 touchmove 逐帧
 * 写 offsets 触发重渲染，此时过渡必须显式为 none，否则吸附过渡会把每帧
 * 位移平滑成滞后轨迹（Style Funnel 两态都写同一键，CONVENTIONS §20）。
 *
 * **按列缓存**：只有「位移 + 过渡」签名变化的那列才换新对象。跟手帧里
 * offsets 只改一列，其余四列拿到的是同一个对象引用——列级 v-memo 以此为
 * 依赖即可把其余四列整段跳过（见文件头「跟手帧零冗余样式下发」）。
 */
const columnStyleCache: Array<Record<string, string>> = []
const columnStyleSign: string[] = []
function columnStyleOf(colIndex: number): Record<string, string> {
  const transition = draggingCount.value > 0 ? 'none' : COLUMN_TRANSITION
  const offset = offsets.value[colIndex] || 0
  const sign = `${offset}|${transition}`
  if (columnStyleSign[colIndex] !== sign) {
    columnStyleSign[colIndex] = sign
    columnStyleCache[colIndex] = {
      transform: `translateY(${-offset}px)`,
      transition
    }
  }
  return columnStyleCache[colIndex]
}

/** 行 class 常量：用字符串拼接替代「每行新建数组 + join」 */
const ITEM_CLASS = 'wd-picker-view__column-item'
const ITEM_CLASS_DISABLED = ' wd-picker-view__column-item--disabled'
const ITEM_CLASS_ACTIVE = ' wd-picker-view__column-item--active'

function getItemClass(disabled: boolean | undefined, colIndex: number, rowIndex: number): string {
  let className = ITEM_CLASS
  if (disabled) className += ITEM_CLASS_DISABLED
  if (selectedIndex.value[colIndex] === rowIndex) className += ITEM_CLASS_ACTIVE
  return className
}

/**
 * 列级 v-memo 依赖：必须覆盖列子树的**全部**动态输入，漏一个就是「状态变了
 * 画面不更新」的静默缺陷。当前列子树（列外壳 + 列内容 + 补位 + 列项）依赖：
 * - `col`：列数据本身——列重建、选项禁用变化都随新数组到来；
 * - `columnStyleOf(colIndex)`：位移 + 过渡，跟手帧唯一真变化；
 * - `selectedIndex[colIndex]`：选中项高亮（correctSelected 迁移后同样变化）；
 * - `itemHeightStyle` / `padHeightStyle`：行高与上下留白（itemHeight /
 *   visibleItemCount 变化）；
 * - `props.labelKey`：列项文本取值键。
 * 列项自身还有一行 v-memo（依赖 `[row, 是否选中, itemHeightStyle]`），两者
 * 互补：列级负责「整列要不要重画」，列项级负责「这一行要不要重画」。
 *
 * 事件处理器是 setup 作用域稳定引用，内联闭包按 v-for 位置缓存，不随渲染
 * 换 identity；`colIndex` 由 v-for key 固定，缓存槽与位置一一对应。
 */
function columnMemo(col: PickerOption[], colIndex: number): unknown[] {
  return [
    col,
    columnStyleOf(colIndex),
    selectedIndex.value[colIndex],
    itemHeightStyle.value,
    padHeightStyle.value,
    props.labelKey
  ]
}

/** 列内容最大位移 */
function maxOffset(colIndex: number): number {
  const count = formatColumns.value[colIndex]?.length || 0
  return Math.max(0, (count - 1) * props.itemHeight)
}

/**
 * 由位移反推索引：仅做 round + 边界钳制。
 * 禁用项的就近迁移不在此处做——统一由 correctSelected（经 selectedIndex
 * 变更链路）处理，避免同一修正出现两份逻辑。
 */
function offsetToIndex(colIndex: number, offset: number): number {
  const count = formatColumns.value[colIndex]?.length || 0
  if (count === 0) return 0
  let index = Math.round(offset / props.itemHeight)
  index = Math.min(Math.max(index, 0), count - 1)
  return index
}

/**
 * 触点纵坐标（touchend 取 changedTouches，touchmove 取 touches）。
 * 跟手与落定共用同一公式输入，保证两段位移连续无跳变。
 */
function pointerY(event: any, ended = false): number | null {
  const touch = ended ? event?.changedTouches?.[0] ?? event?.touches?.[0] : event?.touches?.[0] ?? event?.changedTouches?.[0]
  const raw = touch?.clientY ?? touch?.pageY ?? touch?.y ?? event?.detail?.y
  if (raw == null) return null
  const y = Number(raw)
  return Number.isFinite(y) ? y : null
}

/**
 * 级联模式且 columns 为树形数据（首项为带 children 的对象）时才需要
 * 在列变化后重建后续列；普通二维列数据无 children 可重建。
 */
function isCascadeTree(): boolean {
  if (!props.cascade) return false
  const first = (props.columns as any[])[0]
  return !isArray(first) && isObj(first)
}

/** 级联重建：变化列之后的子列按参考实现重建并写回（含自动选中首个可用项） */
function rebuildCascadeColumns(columnIndex: number) {
  if (!isCascadeTree()) return
  const rebuilt = updateCascadeColumns(props.columns as PickerOption[], columnIndex)
  formatColumns.value = rebuilt.columns
  selectedIndex.value = rebuilt.selectedIndex
}

/**
 * 列内容触摸开始（后台：记录起点、发 pickstart）。
 *
 * 只写提交类状态（dragging 标志 + pickstart 事件），跟手位移由
 * onTouchMove 写 offsets 驱动重渲染。
 */
function onTouchStart(event: any, colIndex: number) {
  if (!formatColumns.value[colIndex]?.length || props.itemHeight <= 0) return
  const y = pointerY(event)
  if (y === null) return
  changeRequest++
  if (settleTimers[colIndex] !== undefined) clearTimeout(settleTimers[colIndex])
  // pickstart/pickend 配对：上一手势 settle 未落定（pickend 未发）就再次
  // 触摸时不再重复发 pickstart，否则消费方按配对计数会失配
  if (!picking[colIndex]) {
    picking[colIndex] = true
    emit('pickstart')
  }
  if (!dragging[colIndex]) {
    dragging[colIndex] = true
    draggingCount.value++
  }
  bgDragStart[colIndex] = { y, offset: offsets.value[colIndex] || 0 }
}

/**
 * 列内容跟手移动（后台）：位移公式与落定完全一致，写入 offsets 触发重渲染。
 *
 * 不提交 change（官方契约：immediateChange 也只在松手时提交）。
 * 边缘越界只阻尼不钳制（阻尼后的越界值在 touchend 落定时收敛），与
 * 原跟手公式一致，保证阻尼手感连续。
 */
function onTouchMove(event: any, colIndex: number) {
  if (!dragging[colIndex]) return
  const max = maxOffset(colIndex)
  const start = bgDragStart[colIndex]
  const y = pointerY(event)
  if (!start || y === null) return
  let offset = start.offset + (start.y - y)
  if (offset < 0) offset = offset * 0.3
  if (offset > max) offset = max + (offset - max) * 0.3
  offsets.value[colIndex] = offset
}

/**
 * 列内容触摸结束（后台：同一公式重算终值并 commit）。
 */
function onTouchEnd(event: any, colIndex: number) {
  if (!dragging[colIndex]) return
  dragging[colIndex] = false
  draggingCount.value = Math.max(0, draggingCount.value - 1)
  const max = maxOffset(colIndex)
  const start = bgDragStart[colIndex]
  const y = pointerY(event, true)
  let offset = start && y !== null ? start.offset + (start.y - y) : offsets.value[colIndex] || 0
  // 边缘阻尼 + 钳制（与 touchmove 同一公式；阻尼值越界后由钳制收敛）
  if (offset < 0) offset = offset * 0.3
  if (offset > max) offset = max + (offset - max) * 0.3
  offset = Math.min(Math.max(offset, 0), max)
  const index = offsetToIndex(colIndex, offset)
  offsets.value[colIndex] = index * props.itemHeight

  const origin = [...selectedIndex.value]
  const next = [...selectedIndex.value]
  next[colIndex] = index
  selectedIndex.value = correctSelected(next)
  // 禁用项迁移后位移跟随
  offsets.value[colIndex] = Math.max(0, selectedIndex.value[colIndex]) * props.itemHeight
  // 级联模式：父列变化后重建后续子列
  rebuildCascadeColumns(colIndex)
  const columnIndex = getChangeColumnIndex(selectedIndex.value, origin)
  const request = changeRequest
  if (props.immediateChange) emitChange(columnIndex)
  settleTimers[colIndex] = setTimeout(() => {
    settleTimers[colIndex] = undefined
    if (!isAlive()) return
    if (dragging[colIndex]) return
    if (request === changeRequest && !props.immediateChange) emitChange(columnIndex)
    // pickend 无条件配对发出（即便代次已被外部更新失效），
    // 消费方按 pickstart/pickend 配对消费才能闭环
    picking[colIndex] = false
    nextTick(() => { if (isAlive()) emit('pickend') })
  }, 200)
}

function emitChange(columnIndex: number) {
  if (isEqual(selectedValues.value, props.modelValue)) return
  const request = changeRequest
  const payload = {
    selectedValues: [...selectedValues.value], selectedOptions: [...selectedOptions.value],
    selectedLabels: [...selectedLabels.value], selectedIndexes: [...selectedIndex.value], columnIndex
  }
  emit('update:modelValue', payload.selectedValues)
  nextTick(() => {
    if (isAlive() && request === changeRequest) emit('change', payload)
  })
}

/** 级联：外部 columns 为树形时由使用方驱动，此处仅保留数据出口 */
function getSelectedIndex(): number[] {
  return selectedIndex.value
}

defineExpose<PickerViewExpose>({
  getSelectedOptions: () => selectedOptions.value as PickerOption[],
  getSelectedValues: () => selectedValues.value,
  getColumnsData,
  getColumnData,
  getColumnIndex,
  getSelectedLabels: () => selectedLabels.value,
  getSelectedIndex,
  // 对外重置列数据入口；内部走 safeResetColumns（脏数据降级为空列，不抛错崩卡片）
  resetColumns: safeResetColumns
})
</script>

<template>
  <view :class="`wd-picker-view ${customClass}`" :style="pickerStyle">
    <view class="wd-picker-view__main" :style="pickerViewStyle">
      <!-- 上下遮罩（盖在文字上形成渐隐；须排在列之前，见下方注释） -->
      <view class="wd-picker-view__mask wd-picker-view__mask--top" :style="padHeightStyle" v-memo="[padHeightStyle]" />
      <view class="wd-picker-view__mask wd-picker-view__mask--bottom" :style="padHeightStyle" v-memo="[padHeightStyle]" />

      <!-- 内容先 bind 跟手/落定，列外壳再 catch 冒泡，不能用 capture 截断子列。 -->
      <view
        v-for="(col, colIndex) in formatColumns"
        :key="colIndex"
        class="wd-picker-view__column"
        v-memo="columnMemo(col, colIndex)"
        @touchstart.stop="stopColumnTouch"
        @touchmove.stop="stopColumnTouch"
        @touchend.stop="stopColumnTouch"
        @touchcancel.stop="stopColumnTouch"
      >
        <!-- 列内容（子）：后台 touchstart / touchmove（跟手写 offsets）/
             touchend（落定 commit） -->
        <view
          class="wd-picker-view__column-content"
          :style="columnStyleOf(colIndex)"
          @touchstart="onTouchStart($event, colIndex)"
          @touchmove="onTouchMove($event, colIndex)"
          @touchend="onTouchEnd($event, colIndex)"
          @touchcancel="onTouchEnd($event, colIndex)"
        >
          <view class="wd-picker-view__column-pad" :style="padHeightStyle" />
          <view
            v-for="(row, rowIndex) in col"
            :key="rowIndex"
            v-memo="[row, selectedIndex[colIndex] === rowIndex, itemHeightStyle]"
            :class="getItemClass(row['disabled'], colIndex, rowIndex)"
            :style="itemHeightStyle"
          >
            <text class="wd-picker-view__column-label">{{ row[labelKey] }}</text>
          </view>
          <view class="wd-picker-view__column-pad" :style="padHeightStyle" />
        </view>
      </view>

      <!-- 选中指示带（对齐参考源 indicator-class：roller）：必须排在列之后 +
           z-index 低于列。Web 预览的绘制不遵循 z-index（按 DOM 逆序绘制），
           排在最前会连底色带文字一起盖掉；真机按 z-index 绘制，
           roller(0) < column(2) 同样在下方。 -->
      <view class="wd-picker-view__roller" :style="indicatorStyle" v-memo="[indicatorStyle]" />
    </view>
  </view>
</template>
