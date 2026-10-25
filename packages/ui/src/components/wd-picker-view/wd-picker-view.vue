/*
 * wd-picker-view — 选择器视图（原生优先重写版）
 *
 * Lynx 实现说明（相对既有后台线程实现的重写点）：
 * - **跟手走主线程（声明式 MTS）**：列内容（`.wd-picker-view__column-content`）
 *   绑定 `main-thread-bindtouchmove` + `'main thread'` worklet，触点经
 *   「起点位移 + 手指位移」公式换算后 `setStyleProperty('transform')` 直改
 *   列内容——事件在主线程直接派发、节点样式直改，零线程跨越，低端机跟手
 *   无滞后（CONVENTIONS §10 / NATIVE-REWRITE §2）；
 * - **手势起点在主线程一次性记录**：列元素（父节点）绑定
 *   `main-thread-bindtouchstart` worklet（与 wd-slider 轨道度量同范式），
 *   经元素属性 `current-offset` / `max-offset` 读取该列当前位移与最大位移
 *   （渲染期已知量，免异步 invoke 度量，touchmove 热路径零查询，CONVENTIONS
 *   §16），连同触点 clientY 写入 MainThreadRef 跟手状态（按列分槽，支持
 *   多指各列同时拖动）；
 * - **落定走后台**：列内容的 `@touchstart` / `@touchend` 为后台绑定（提交类
 *   逻辑），touchend 用同一套公式由 changedTouches 坐标重算终值、对齐到
 *   最近列项后 commit（selectedIndex / offsets），并派发 pickend + change；
 * - **元素分工与真机冒泡语义**（对齐 wd-slider 范本）：
 *     · 列（父）`main-thread-bindtouchstart`（主线程记起点）+
 *       `@touchmove`（后台，仅 immediateChange 开启时绑定，跟手值落定）；
 *     · 列内容（子）`@touchstart`（后台记起点 + pickstart）+
 *       `main-thread-bindtouchmove`（主线程跟手直改）+
 *       `@touchend` / `@touchcancel`（后台落定 commit）；
 *     真机上触摸事件沿响应链冒泡且主线程/后台两条派发链互不拦截：内容上的
 *     后台 touchstart 上浮到列的主线程 touchstart（slider 滑块→轨道同向），
 *     内容上的主线程 touchmove 上浮到列的后台 touchmove（slider dragmove
 *     同向）；jsdom 不模拟冒泡，测试中直接派发到各绑定元素验证；
 * - **跟手期禁过渡**：列内容常驻 `transition`（落位吸附 0.2s），touchmove
 *     worklet 每次与 transform 同帧显式写 `transition: none`（Style Funnel：
 *     两态都写同一键，CONVENTIONS §20）；后台落定后 Vue 重渲染重新下发
 *     `transform + transition`，从 worklet 最后位置吸附到列项；
 * - **拖动期间零后台渲染**：touchstart 不改任何响应式状态（dragging 标志为
 *     非响应式普通数组，仅后台处理器与 offsets watch 守卫读取），避免 Vue
 *     重渲染把 worklet 直改的 transform 覆盖回去（vue-lynx 对带 STYLE
 *     patchFlag 的元素每次重渲染都会重新下发内联样式）；
 * - **immediateChange**：按官方原生 picker-view 契约，true 在手指松开时
 *   提交 change，false 在 200ms 吸附过渡结束时提交；touchmove 不提交。
 *   pickend 在吸附结束后发出，外部改值、配置改变、卸载取消过时任务；
 * - **几何免度量**：itemHeight / 列项数均为渲染期已知量，经元素属性向主线程
 *   下发，worklet 不调用 invoke / getRect；
 * - 数据逻辑（列格式化 / 选中索引 / 级联构建）在 composables/useSelection，
 *   本组件只负责触摸与渲染；
 * - 禁用项自动就近迁移（correctSelected）。
 * - **内联样式一律对象语法**（CONVENTIONS §19）：列高、translateY 位移、
 *   指示带/遮罩尺寸全部依赖内联样式，字符串 :style 会被 vue-lynx 静默丢弃。
 */
<script lang="ts" setup>
import './index.css'

import { computed, nextTick, onBeforeUnmount, ref, watch, useMainThreadRef } from 'vue-lynx'
import { pickerViewProps, type PickerOption, type PickerViewExpose } from './types'
import { useSelection } from '../../composables/useSelection'
import { useAlive } from '../../composables/useAlive'
import { addUnit, isArray, isDef, isEqual, isObj, parseStyle } from '../../common/util'

const props = defineProps(pickerViewProps)
const emit = defineEmits(['change', 'pickstart', 'pickend', 'update:modelValue'])
const isAlive = useAlive()
const bgDragStart: Array<{ y: number; offset: number } | undefined> = []
const dragging: boolean[] = []
// 每列 pickstart 是否已发出且 pickend 未落定：连续快速滑动时新手势接续
// 旧手势的 settle，必须视为同一段选择，pickstart/pickend 才能配对
const picking: boolean[] = []
const offsets = ref<number[]>([])
const settleTimers: Array<ReturnType<typeof setTimeout> | undefined> = []
let changeRequest = 0
const dataVersion = ref(0)
function cancelGestures() {
  changeRequest++
  dataVersion.value++
  dragging.fill(false)
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
 * 每列后台拖动起点（非响应式）。
 *
 * 仅后台 touchstart 写、touchend / touchmove 读：拖动期间不得触发 Vue 重渲染
 * （重渲染会重新下发内联样式，把 worklet 直改的 transform 覆盖回去），故用
 * 普通数组而非 ref。
 */
/**
 * 每列是否正在拖动（非响应式）。
 *
 * 守卫 offsets watch（外部选中索引变化不得在拖动期间抢位移）与后台
 * touchmove / touchend 处理器；普通数组读取即最新值，无需响应式。
 */
/**
 * 每列当前位移（px）——Vue 状态，承担落定后的样式下发与外部改值同步。
 *
 * 跟手期间 worklet 直改节点样式、不写此状态（避免拖动期间重渲染把直改值
 * 覆盖回去）；touchend 落定 / 外部 modelValue 变化时由本状态驱动重渲染。
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

/** 列落位过渡（与落位吸附时长一致；跟手期由 worklet 显式写 none 覆盖） */
const COLUMN_TRANSITION = 'transform 0.2s cubic-bezier(0.645, 0.045, 0.355, 1)'

/**
 * 列内容位移（对象样式：字符串 :style 会被 vue-lynx 静默丢弃，CONVENTIONS §19）。
 *
 * transition 常驻下发（落位吸附由 Vue 侧重渲染承担）；跟手期间 worklet 经
 * setStyleProperty 直改 transform 并显式写 `transition: none`，两态都写同一
 * 键—— Lynx 的 SetStyle 是逐属性合并语义，省略键不会清除已应用的过渡
 * （CONVENTIONS §20，wd-swipe-action / wd-picker-view 同款教训）。
 *
 * 提为 computed 数组：仅在 offsets / formatColumns 变化时重算一次，避免无关
 * 重渲染（选中索引变化、父级更新）时每列重复建对象。
 */
const columnStyles = computed<Array<Record<string, string>>>(() =>
  formatColumns.value.map((_, colIndex) => ({
    transform: `translateY(${-(offsets.value[colIndex] || 0)}px)`,
    transition: COLUMN_TRANSITION
  }))
)

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
 * 与 worklet 内公式同源：后台落定用同一套输入重算，保证跟手与落定一致。
 */
function pointerY(event: any): number {
  return Number(event.changedTouches?.[0]?.clientY ?? event.touches?.[0]?.clientY ?? event.detail?.y ?? 0)
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
 * 与 worklet 的起点记录分工：本处理器只做提交类状态（dragging 标志 +
 * pickstart 事件），跟手几何由列元素上的主线程 touchstart worklet 记录。
 */
function onTouchStart(event: any, colIndex: number) {
  if (!formatColumns.value[colIndex]?.length || props.itemHeight <= 0) return
  changeRequest++
  if (settleTimers[colIndex] !== undefined) clearTimeout(settleTimers[colIndex])
  // pickstart/pickend 配对：上一手势 settle 未落定（pickend 未发）就再次
  // 触摸时不再重复发 pickstart，否则消费方按配对计数会失配
  if (!picking[colIndex]) {
    picking[colIndex] = true
    emit('pickstart')
  }
  dragging[colIndex] = true
  bgDragStart[colIndex] = { y: pointerY(event), offset: offsets.value[colIndex] || 0 }
}

/**
 * 列内容触摸结束（后台：同一公式重算终值并 commit）。
 *
 * worklet 跟手期间只直改样式、不写 Vue 状态，故此处必须由触点坐标重算：
 * 起点取后台 touchstart 记录的 bgDragStart，公式与 worklet 完全一致
 * （位移 = 起点位移 + 起点纵坐标 - 当前纵坐标，边缘阻尼后钳制到
 * [0, maxOffset]，round 到最近列项）。
 */
function onTouchEnd(event: any, colIndex: number) {
  if (!dragging[colIndex]) return
  dragging[colIndex] = false
  const max = maxOffset(colIndex)
  const start = bgDragStart[colIndex]
  let offset = start ? start.offset + (start.y - pointerY(event)) : offsets.value[colIndex] || 0
  // 边缘阻尼 + 钳制（与 worklet 同一公式；阻尼值越界后由钳制收敛）
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

// ---------- 主线程 worklet（跟手，零线程跨越） ----------

/**
 * 主线程元素桩类型（worklet 内经 currentTarget 取用）。
 * 与 @lynx-js/types 的 MainThread.Element 对齐的常用子集。
 */
interface MtElement {
  setStyleProperty(name: string, value: string): void
  getAttribute(name: string): string | null
  invoke(method: string, params?: any): Promise<any>
}

/** 单列跟手状态（主线程） */
interface ColumnDragState {
  startY: number
  startOffset: number
  maxOffset: number
  version: string | null
}

/**
 * 跟手状态（按列分槽）。
 *
 * 与 wd-slider 的 geomRef 同范式：useMainThreadRef 作主线程数据通道，
 * touchstart worklet 写、touchmove worklet 读；按列索引分槽以支持多指同时
 * 拖动不同列。后台线程不可写 .current（真机拒绝），故起点只能在主线程
 * touchstart 里记录。
 */
const dragStatesRef = useMainThreadRef<Record<number, ColumnDragState> | null>(null)

/**
 * 列触摸开始（主线程）：一次性记录该列跟手状态。
 *
 * 绑定在列元素（父节点）上而非列内容：滑块的 touchstart 是后台绑定
 * （发 pickstart），同名事件不能在同一元素同时挂主线程与后台两个处理器；
 * 列与列内容是父子元素，触摸列内容时事件沿响应链上浮到此处，语义等价
 * （wd-slider 轨道 touchstart 度量同范式）。
 *
 * 几何经元素属性读取（current-offset / max-offset，渲染期已知量随重渲染
 * 更新），不调用 invoke / getRect——热路径零节点查询（CONVENTIONS §16）。
 */
const onColumnDragStart = (event: any) => {
  'main thread'
  const column = event.currentTarget as MtElement | undefined
  const touch = event.touches && event.touches[0]
  if (!column || !touch) return
  const colIndex = Number(column.getAttribute('col-index'))
  if (isNaN(colIndex)) return
  const states = dragStatesRef.current || (dragStatesRef.current = {})
  states[colIndex] = {
    startY: touch.clientY,
    startOffset: Number(column.getAttribute('current-offset')) || 0,
    maxOffset: Number(column.getAttribute('max-offset')) || 0,
    version: column.getAttribute('gesture-version')
  }
}

/**
 * 列内容跟手移动（主线程）：位移公式 + 列内容 transform 直改。
 *
 * 被操作元素经 event.currentTarget 寻址（绑定 main-thread-bindtouchmove
 * 的列内容节点本身，wd-slider 范围模式拖动对象判定同范式）；跟手状态按
 * 列属性 col-index 取槽，多指拖动不同列互不干扰。
 */
const onColumnDragMove = (event: any) => {
  'main thread'
  const content = event.currentTarget as MtElement | undefined
  const states = dragStatesRef.current
  if (!content || !states) return
  const touch = event.touches && event.touches[0]
  if (!touch) return
  const colIndex = Number(content.getAttribute('col-index'))
  const drag = states[colIndex]
  if (!drag || drag.version !== content.getAttribute('gesture-version')) return

  let offset = drag.startOffset + (drag.startY - touch.clientY)
  // 边缘阻尼（与后台落定公式一致）
  if (offset < 0) offset = offset * 0.3
  if (offset > drag.maxOffset) offset = drag.maxOffset + (offset - drag.maxOffset) * 0.3

  content.setStyleProperty('transform', `translateY(${-offset}px)`)
  // 跟手期禁过渡：v-model 回写等重渲染会重新下发常驻 transition，此处逐帧
  // 显式写 none 保证跟手不被过渡平滑（Style Funnel，CONVENTIONS §20）
  content.setStyleProperty('transition', 'none')
}
</script>

<template>
  <view :class="`wd-picker-view ${customClass}`" :style="pickerStyle">
    <view class="wd-picker-view__main" :style="pickerViewStyle">
      <!-- 上下遮罩（盖在文字上形成渐隐；须排在列之前，见下方注释） -->
      <view class="wd-picker-view__mask wd-picker-view__mask--top" :style="padHeightStyle" />
      <view class="wd-picker-view__mask wd-picker-view__mask--bottom" :style="padHeightStyle" />

      <!-- 列（父）：主线程 touchstart 记跟手起点；后台 touchmove 仅
           immediateChange 开启时绑定（跟手值落定，经列内容冒泡上来） -->
      <view
        v-for="(col, colIndex) in formatColumns"
        :key="colIndex"
        class="wd-picker-view__column"
        :col-index="String(colIndex)"
        :gesture-version="String(dataVersion)"
        :current-offset="String(offsets[colIndex] || 0)"
        :max-offset="String(maxOffset(colIndex))"
        :main-thread-bindtouchstart="onColumnDragStart"
      >
        <!-- 列内容（子）：后台 touchstart / touchend（提交类）+ 主线程
             touchmove（跟手直改）；col-index 属性供 worklet 取跟手状态槽位 -->
        <view
          class="wd-picker-view__column-content"
          :style="columnStyles[colIndex]"
          :col-index="String(colIndex)"
          :gesture-version="String(dataVersion)"
          @touchstart="onTouchStart($event, colIndex)"
          :main-thread-bindtouchmove="onColumnDragMove"
          @touchend="onTouchEnd($event, colIndex)"
          @touchcancel="onTouchEnd($event, colIndex)"
        >
          <view class="wd-picker-view__column-pad" :style="padHeightStyle" />
          <view
            v-for="(row, rowIndex) in col"
            :key="rowIndex"
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
      <view class="wd-picker-view__roller" :style="indicatorStyle" />
    </view>
  </view>
</template>
