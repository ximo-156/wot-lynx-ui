/*
 * wd-slider — 滑块（原生优先重写版）
 *
 * Lynx 实现说明（相对 wot-ui 2.3.2 的适配点）：
 * - **跟手走主线程（声明式 MTS）**：滑块的 touchmove 经
 *   `main-thread-bindtouchmove` 绑定 `'main thread'` worklet，触点经绝对
 *   定位公式换算后 `setStyleProperty` 直改进度条元素——零线程跨越，
 *   低端机跟手无滞后（CONVENTIONS §10）；
 * - **几何主线程自度量**：轨道矩形由 worklet 在轨道 touchstart（主线程）
 *   时经 `MainThread.Element.invoke('boundingClientRect')` 获取并缓入
 *   MainThreadRef——不在 touchmove 热路径重复度量（CONVENTIONS §16），
 *   也不依赖后台快照同步；
 * - **落定走后台**：滑块的 touchstart / touchend 为后台绑定（提交类
 *   逻辑），touchend 用同一套绝对公式由触点坐标重算终值并 commit；
 *   update:modelValue 与 dragmove 经轨道后台 touchmove 连续发出（isDragging
 *   守卫，仅拖动滑块时触发，与 wot-ui 语义一致）；
 * - **吞掉引擎补发的 tap**（真机 2026-10-27 修复「滑动松手回弹」）：Lynx 在
 *   touchend 之后还会补发一次 tap（同 wd-rate 的观测），而这次 tap 携带的是
 *   **按下时**的坐标。轨道的 @tap 是「点轨道跳转」，若不拦，拖动结束会被这次
 *   tap 按旧坐标重算一次值 —— 表现就是「怎么拖都弹回原位」。手势一旦提交过
 *   值（连续 dragmove 或 touchend 落定）就记下时间戳，紧跟其后 350ms 内的一次
 *   tap 直接吞掉（时间窗而非布尔标记：宿主不补发 tap 时不会误吞下一次真实点按）；
 *   干净点按（未拖动）不受影响，仍由 tap 走跳转；
 * - **几何兜底**（同轮修复）：后台 trackSize 在 onMounted 一次性测出，真机首帧
 *   可能量到 0 且此后不再重测，落定路径会因 trackSize<=0 直接 return（同样
 *   表现为回弹）。现在手势开始强制重测，touchend 落定时若仍无效则补测后再
 *   commit（与 wd-rate 的 refreshRects 兜底同思路）；
 * - **MT 触摸绑定不与 tap 同元素**（CONVENTIONS §19 真机差异 #4 / wd-rate 范本）：
 *   几何度量 worklet 挂在进度条 __line 上，不挂在带 @tap 的轨道 __bar 上，
 *   避免「需要 tap 的节点子树挂 MT 触摸绑定」引起的 tap 合成互扰；
 * - **范围模式边界**：左右滑块当前值经进度条元素属性 left-bound /
 *   right-bound 下发（Vue 属性绑定随重渲染更新），worklet 跟手时经
 *   `getAttribute` 实时读取，避免两滑块交叉；属性缺失时降级为仅
 *   min/max 钳制（后台落定仍按真实值钳制，终态正确）；
 * - min/max/step/vertical/range/disabled 经元素属性实时桥接，配置变化
 *   取消旧手势；拖动采用官方起值 + 位移，越过另一端后规范化排序；
 * - trackSize 为 0（度量失败）时 worklet 与后台同时守值：不写 NaN；
 * - wot-ui 的 `:first-child / :last-child` 与 `a + b` 兄弟选择器无 Lynx
 *   等价物，首尾刻度改用 v-for 索引类名 is-edge-start / is-edge-end；
 * - 滑块内置图标：wot-ui 用 multiple-horizontal，内置 iconfont 集无该字形，
 *   改用同语义的 drag；
 * - customStyle 经 parseStyle 归一为对象（CONVENTIONS §19）；
 *   activeColor / inactiveColor 为 prop 驱动的条件内联键，按 CONVENTIONS
 *   §20 的「低风险」类别处理。
 */
<script lang="ts" setup>
import './index.css'

import { computed, onMounted, ref, watch, useMainThreadRef } from 'vue-lynx'
import WdIcon from '../../primitives/wd-icon/wd-icon.vue'
import { sliderProps, type SliderEmits, type SliderExpose, type SliderMarks, type SliderPopoverVisible, type SliderValue } from './types'
import { deepClone, filterStyle, getRect, isArray, isDef, isEqual, parseStyle, uuid } from '../../common/util'
import { useFormDisabled } from '../../composables/useFormDisabled'
import { useAlive } from '../../composables/useAlive'

const props = defineProps(sliderProps)
const emit = defineEmits<SliderEmits>()
const isDisabled = useFormDisabled(props)
const isAlive = useAlive()

const sliderId = ref<string>(`wd-slider-${uuid()}`)
const trackId = ref<string>(`${sliderId.value}-track`)
const touchIndex = ref<number>(0) // 当前正在拖动的滑块索引 (0 为左/单，1 为右)
const isDragging = ref<boolean>(false) // 是否正在拖动

/** 轨道长度 (水平为宽度，垂直为高度) —— 后台度量，供点击跳转与落定重算 */
const trackSize = ref<number>(0)
/** 轨道起点在页面中的坐标（水平取 left，垂直取 top） */
const trackStart = ref<number>(0)
const modelValue = ref<SliderValue>(getInitValue()) // 内部维护的滑块值

// ---------- 主线程（MTS）引用 ----------
/**
 * 主线程元素桩类型（worklet 内经 .current 取用）。
 * 与 @lynx-js/types 的 MainThread.Element 对齐的常用子集。
 */
interface MtElement {
  setStyleProperty(name: string, value: string): void
  getAttribute(name: string): string | null
  invoke(method: string, params?: any): Promise<any>
}

/** 进度条元素：跟手直改 width/left（或 height/top） */
const lineRef = useMainThreadRef<MtElement | null>(null)
/** 轨道元素：手势开始时主线程度量几何 */
const trackRef = useMainThreadRef<MtElement | null>(null)
/** 右滑块元素：worklet 经 currentTarget 判定拖动对象（范围模式） */
const dotRRef = useMainThreadRef<MtElement | null>(null)
/** 轨道几何快照 { size, start }（worklet 内 .current 活值） */
const geomRef = useMainThreadRef<{ size: number; start: number; pointer: number; left: number; right: number; version: string } | null>(null)
const gestureVersion = computed(() => JSON.stringify([props.min, props.max, props.step, props.vertical, props.range, isDisabled.value]))
let startPointer = 0
let startValue: SliderValue = deepClone(modelValue.value)
let dragMoved = false
/**
 * 本次手势提交过值的时间戳（0 表示没有待吞的补发 tap）。
 *
 * 真机引擎在 touchend 之后会补发一次 tap（见 wd-rate 的同类观测），而 tap 携带
 * 的是**按下时**的坐标：不拦的话「点轨道跳转」会在松手瞬间按旧坐标把值重算
 * 一遍，表现就是「怎么拖都弹回原位」。
 *
 * 用「时间窗 + 只吞一次」而不是布尔标记：宿主不一定补发 tap（Web 预览 / 测试
 * 环境），布尔标记会残留到下一次真实点按，把「点轨道跳转」吞掉。补发的 tap
 * 紧跟在 touchend 之后，350ms 足够覆盖，过期即自动失效。
 */
let tapSwallowAt = 0
/** 补发 tap 的识别窗口（毫秒）：紧跟 touchend，取远大于一帧、远小于人手二次点击 */
const TAP_SWALLOW_WINDOW = 350

let rectRequest = 0
let interactionRequest = 0
watch([isDisabled, () => props.min, () => props.max, () => props.step, () => props.range, () => props.vertical], () => { interactionRequest++; rectRequest++; isDragging.value = false; trackSize.value = 0 }, { flush: 'sync' })
// Measure the rendered orientation, not the obsolete setup-time horizontal track.
watch([isDisabled, () => props.min, () => props.max, () => props.step, () => props.range, () => props.vertical, () => props.theme, () => props.showExtremeValue, () => props.marks], () => initSlider(), { flush: 'post', deep: true })

/**
 * 计算滑块的取值范围大小
 */
const scope = computed(() => props.max - props.min)

// computed 必须保持纯函数：step<=0 时 calcByStep 会在 touchmove 热路径上反复
// 求值，原地 console.warn 会刷屏。告警移到 step 变化时触发一次（含首次），
// computed 只负责取值（与参考源取值行为一致）。
const validStep = computed(() => (props.step > 0 ? props.step : 1))

watch(
  () => props.step,
  (step) => {
    if (step <= 0) {
      console.warn('[wot ui] warning(wd-slider): step must be greater than 0')
    }
  },
  { immediate: true }
)

/**
 * 当前值始终返回 [left, right] 格式方便统一处理
 */
const currentValue = computed<[number, number]>(() => {
  if (props.range && isArray(modelValue.value)) {
    return normalizeRangeValues(modelValue.value as number[])
  }
  return [modelValue.value as number, 0]
})

/**
 * 是否有刻度标记
 */
const hasMarks = computed(() => isDef(props.marks))

/**
 * 刻度列表
 */
const scaleList = computed(() => {
  if (!props.marks) return []

  let markValues: number[] = []
  let markLabels: Record<number, string> = {}

  if (isArray(props.marks)) {
    markValues = props.marks as number[]
  } else {
    markValues = Object.keys(props.marks).map(Number)
    markLabels = props.marks as Record<number, string>
  }

  return markValues.map((val) => ({
    val,
    label: isDef(markLabels[val]) ? markLabels[val] : String(val),
    position: scope.value === 0 ? 0 : ((val - props.min) / scope.value) * 100
  }))
})

/**
 * 根类名计算
 */
const rootClass = computed(() => {
  const classes = ['wd-slider']
  classes.push(`wd-slider--theme-${props.theme}`)
  if (isDisabled.value) classes.push('is-disabled')
  if (props.vertical) {
    classes.push('wd-slider--vertical')
  } else {
    classes.push('wd-slider--horizontal')
  }
  if (hasMarks.value) classes.push('wd-slider--marks')
  if (props.showExtremeValue) classes.push('wd-slider--with-extreme')
  if (props.range) classes.push('is-range')
  if (props.customClass) classes.push(props.customClass)
  return classes.join(' ')
})

/**
 * 根节点样式
 */
const rootStyle = computed(() => parseStyle(props.customStyle))

/**
 * 轨道类名
 */
const barClass = computed(() => {
  const classes = ['wd-slider__bar', `wd-slider__bar--${props.theme}`]
  if (isDisabled.value) classes.push('is-disabled')
  return classes.join(' ')
})

/**
 * 轨道样式
 */
const barStyle = computed(() => ({ 'background-color': props.inactiveColor || '' }))

/**
 * 进度条类名
 */
const lineClass = computed(() => {
  const classes = ['wd-slider__line', `wd-slider__line--${props.theme}`]
  if (!props.range) classes.push('wd-slider__line--single')
  if (isDisabled.value) classes.push('is-disabled')
  return classes.join(' ')
})

/**
 * 进度条样式（落定后由 Vue 接管；跟手期间由 worklet 直改，值一致）
 */
const lineStyle = computed(() => {
  const style: Record<string, string> = { width: props.vertical ? '' : '0%', height: props.vertical ? '0%' : '', left: props.vertical ? '' : '0', top: props.vertical ? '0' : '', 'background-color': props.activeColor || '' }

  if (scope.value === 0) return style

  const prop = props.vertical ? 'height' : 'width'
  const startProp = props.vertical ? 'top' : 'left'

  if (props.range) {
    const [left, right] = currentValue.value
    const start = ((left - props.min) / scope.value) * 100
    const size = ((right - left) / scope.value) * 100
    style[startProp] = `${start}%`
    style[prop] = `${size}%`
  } else {
    const value = modelValue.value as number
    const size = ((value - props.min) / scope.value) * 100
    style[startProp] = '0'
    style[prop] = `${size}%`
  }

  return style
})

// ---------- 监听器 -----------

/**
 * 监听 modelValue 属性变化
 */
watch(
  () => props.modelValue,
  (newValue) => {
    if (!isEqual(newValue, modelValue.value)) {
      interactionRequest++
      isDragging.value = false
      modelValue.value = getInitValue()
    }
  },
  { deep: true }
)

/**
 * 向上发射模型值变化
 */
watch(modelValue, (newVal) => {
  emit('update:modelValue', newVal)
})

onMounted(() => {
  initSlider()
})

/**
 * 限制值在指定范围内
 */
function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

/**
 * 初始化滑块尺寸（后台：点击跳转与落定重算用）
 */
function initSlider() {
  const request = ++rectRequest
  const vertical = props.vertical
  getRect(`#${trackId.value}`, false, proxy).then((data) => {
    // 度量回调晚于卸载落地时丢弃（真机 9902 晚到 patch 家族）
    if (!isAlive() || request !== rectRequest || vertical !== props.vertical) return
    if (vertical) {
      trackSize.value = Number(data.height)
      trackStart.value = Number(data.top)
    } else {
      trackSize.value = Number(data.width)
      trackStart.value = Number(data.left)
    }
  })
}

import { getCurrentInstance } from 'vue-lynx'
const { proxy } = getCurrentInstance() as any

/**
 * 获取初始值
 * @returns {SliderValue} 初始化后的滑块值
 */
function getInitValue(): SliderValue {
  if (props.range) {
    if (isArray(props.modelValue)) {
      return normalizeRangeValues(props.modelValue as number[])
    }
    return [props.min, props.max]
  }
  return clamp(props.modelValue as number, props.min, props.max)
}

/**
 * 标准化范围值，确保 left <= right
 * @param {number[]} value 范围值
 * @returns {[number, number]} 格式化后的范围值
 */
function normalizeRangeValues(value: number[]): [number, number] {
  if (!Array.isArray(value) || value.length < 2) {
    console.warn('[wot ui] warning(wd-slider): range value should be an array with at least 2 elements')
    return [props.min, props.max]
  }

  const left = clamp(value[0], props.min, props.max)
  const right = clamp(value[1], props.min, props.max)

  return left > right ? [right, left] : [left, right]
}

/**
 * 将值对齐到最近的步长倍数
 * @param {number} value 原始值
 * @returns {number} 对齐步长后的值
 */
function calcByStep(value: number): number {
  value = clamp(value, props.min, props.max)
  const steps = Math.round((value - props.min) / validStep.value)
  return clamp(parseFloat((props.min + steps * validStep.value).toFixed(10)), props.min, props.max)
}

/**
 * 统一更新滑块值并触发事件
 * @param {SliderValue} value 新的滑块值
 */
function updateValue(value: SliderValue) {
  let newValue: SliderValue = deepClone(value)

  if (props.range && isArray(newValue)) {
    newValue = normalizeRangeValues(newValue as number[]).map((v) => calcByStep(v)) as [number, number]
  } else {
    newValue = calcByStep(newValue as number)
  }

  if (!isEqual(newValue, modelValue.value)) {
    modelValue.value = newValue
  }
}

/**
 * 保证轨道尺寸可用：无效时补测一次并返回 Promise（永不 reject）。
 *
 * 真机首帧的 onMounted 度量可能拿到 0（布局未完成），而旧实现只在 prop 变化时
 * 重测 —— trackSize 一旦为 0，dragmove 与落定都会被 `trackSize<=0` 守卫挡掉，
 * 表现为「跟手正常、松手回弹」。这里在落定前兜底补测（同 wd-rate refreshRects）。
 */
function ensureTrackSize(): Promise<number> {
  if (trackSize.value > 0 && Number.isFinite(trackSize.value)) return Promise.resolve(trackSize.value)
  const request = ++rectRequest
  const vertical = props.vertical
  return getRect(`#${trackId.value}`, false, proxy).then((data) => {
    if (!isAlive() || request !== rectRequest || vertical !== props.vertical) return trackSize.value
    const size = Number(vertical ? data.height : data.width)
    if (Number.isFinite(size) && size > 0) {
      trackSize.value = size
      trackStart.value = Number(vertical ? data.top : data.left)
    }
    return trackSize.value
  })
}

/**
 * 从触摸 / tap 事件里取触点主坐标（水平 clientX、垂直 clientY）。
 *
 * 三种载荷形态都要认：
 * - 触摸事件：`touches[0]` / `changedTouches[0]`（真机与 Web 同形）；
 * - Lynx tap：`touches` 为空，坐标在 `detail.x / detail.y`；
 * - Web 预览的 click（@tap 映射）：`detail` 是点击次数（数字），坐标在 `clientX/clientY`。
 * 都取不到返回 NaN —— 调用方必须降级，不能默认成 0（0 会被当成「点在轨道最左端」）。
 */
function readPointer(event: any): number {
  const touch = event?.changedTouches?.[0] ?? event?.touches?.[0]
  const raw = props.vertical
    ? touch?.clientY ?? event?.detail?.y ?? event?.clientY
    : touch?.clientX ?? event?.detail?.x ?? event?.clientX
  const value = Number(raw)
  return Number.isFinite(value) ? value : NaN
}

/**
 * 将「相对轨道起点的像素距离」转换为滑块值（点轨道跳转用）
 * @param {number} position 相对轨道起点的像素距离
 * @returns {number} 转换后的数值
 */
function positionToValue(position: number): number {
  if (trackSize.value <= 0 || !Number.isFinite(trackSize.value)) return props.min
  return (position / trackSize.value) * scope.value + props.min
}

/**
 * 将「触点主坐标」转换为滑块值（拖动 / 落定用：起值 + 位移）
 * @param {number} pointer 触点 clientX / clientY
 * @param {number} index 滑块索引
 * @returns {number} 转换后的数值
 */
function pointerToValue(pointer: number, index: number): number {
  if (trackSize.value <= 0 || !Number.isFinite(trackSize.value) || !Number.isFinite(pointer)) return props.min
  const value = props.range && isArray(startValue) ? startValue[index] : (startValue as number)
  return value + ((pointer - startPointer) / trackSize.value) * scope.value
}

/** 范围拖动始终保留另一端；所有 drag 事件与 v-model 使用同一种值形状。 */
function dragValue(pointer: number): SliderValue {
  const value = pointerToValue(pointer, touchIndex.value)
  if (!props.range) return value
  const values: [number, number] = [...(startValue as [number, number])]
  values[touchIndex.value] = value
  return values
}

/**
 * 计算刻度项类名
 * @param {number} val 刻度对应的值
 * @param {number} index 刻度索引
 */
function scaleItemClass(val: number, index: number): string {
  const classes = ['wd-slider__scale-item', `wd-slider__scale-item--${props.theme}`]

  const isActive = Array.isArray(modelValue.value) ? val >= modelValue.value[0] && val <= modelValue.value[1] : val <= (modelValue.value as number)

  if (isActive) classes.push('is-active')
  if (isDisabled.value) classes.push('is-disabled')
  // Lynx 适配：wot-ui 用 :first-child / :last-child 让胶囊首尾刻度透明，
  // Lynx 无伪类选择器，改用 v-for 索引类名
  if (props.theme === 'capsule') {
    if (index === 0) classes.push('is-edge-start')
    if (index === scaleList.value.length - 1) classes.push('is-edge-end')
  }

  return classes.join(' ')
}

/**
 * 计算刻度项定位样式
 * @param {number} position 刻度在轨道上的百分比位置
 */
function scaleItemStyle(position: number): Record<string, string> {
  return props.vertical ? { top: `${position}%` } : { left: `${position}%` }
}

/**
 * 获取指定滑块上方气泡显示值
 * @param {number} index 滑块索引
 */
function dotDisplayValue(index: number): number {
  if (!props.range) {
    return modelValue.value as number
  }
  const values = currentValue.value
  return isDef(values[index]) ? values[index] : values[0]
}

/**
 * 控制气泡显示隐藏
 * @param {number} index dot 索引 (0 = 左/单滑块，1 = 右滑块)
 */
function showDotPopover(index: number): boolean {
  const mode = props.popoverVisible as SliderPopoverVisible
  if (mode === 'always') return true
  if (mode === 'normal') return isDragging.value && touchIndex.value === index
  return false
}

/**
 * 滑块触摸开始（后台：记录索引、发 dragstart）
 * @param event 触摸事件
 * @param {number} index 滑块索引
 */
function onTouchStart(event: any, index: number) {
  if (isDisabled.value) return

  touchIndex.value = index
  startValue = deepClone(modelValue.value)
  const pointer = readPointer(event)
  startPointer = Number.isFinite(pointer) ? pointer : 0
  dragMoved = false
  tapSwallowAt = 0
  isDragging.value = true
  // 几何兜底：真机首帧可能量到 0 且此后不再重测，手势开始强制重测一次
  // （每个手势一次，不在 touchmove 热路径上，CONVENTIONS §16）
  initSlider()
  emit('dragstart', { value: modelValue.value })
}

/**
 * 滑块触摸结束（后台：绝对公式重算终值并 commit）
 *
 * 三条路径：
 * 1. 拖动中已由 dragmove 连续提交 → 只补 dragend/change；
 * 2. 宿主没派发后台 touchmove（dragMoved 为假）→ 用 touchend 坐标落定；
 * 3. 几何缺失（trackSize 为 0）→ 补测后再落定，绝不静默丢值。
 *
 * 只要本次手势提交过值（或即将提交），就记录 tapSwallowAt，让引擎在 touchend
 * 后补发的那一次 tap 被 @tap 处理器吞掉——否则「点轨道跳转」会按**按下时**的
 * 坐标把值重算一遍，表现为松手回弹（真机 2026-10-27 缺陷）。
 */
function onTouchEnd(event: any) {
  if (!isDragging.value) return
  isDragging.value = false
  if (isDisabled.value) return

  // 坐标必须同步取出：落定可能异步（补测几何），届时事件对象已被引擎回收
  const pointer = readPointer(event)
  const finish = () => {
    emit('dragend', { value: modelValue.value })
    emit('change', modelValue.value)
  }

  if (dragMoved) {
    tapSwallowAt = Date.now()
    finish()
    return
  }
  if (!Number.isFinite(pointer)) {
    finish()
    return
  }

  tapSwallowAt = Date.now()
  if (trackSize.value > 0 && Number.isFinite(trackSize.value)) {
    updateValue(dragValue(pointer))
    finish()
    return
  }
  ensureTrackSize().then((size) => {
    if (!isAlive() || isDisabled.value || size <= 0) return
    updateValue(dragValue(pointer))
    finish()
  })
}

/**
 * 轨道触摸开始（后台）：只负责复位「本次手势已提交过值」标记。
 *
 * 引擎补发的 tap 紧跟 touchend；但宿主不一定补发（Web 预览 / 测试环境），
 * 标记一旦残留，会把**下一次真正点轨道跳转**的 tap 吞掉。点按必然先有
 * touchstart，在这里复位即可（同 wd-rate 的做法）。滑块自身的 touchstart
 * 会先冒泡到本节点之前执行，两处都置 false，顺序无副作用。
 */
function onBarTouchStartBg() {
  tapSwallowAt = 0
}

/**
 * 轨道触摸移动（后台：仅拖动滑块时经冒泡收到，发 dragmove）
 *
 * 滑块上的 main-thread-bindtouchmove 不拦截冒泡，事件继续上浮到轨道；
 * isDragging 守卫保证只有「拖动滑块」才派发，与 wot-ui 语义一致。
 */
function onBarTouchMove(event: any) {
  if (isDisabled.value || !isDragging.value || trackSize.value <= 0 || !Number.isFinite(trackSize.value)) return
  const pointer = readPointer(event)
  if (!Number.isFinite(pointer)) return
  dragMoved = true
  updateValue(dragValue(pointer))
  emit('dragmove', { value: modelValue.value })
}

/**
 * 点击轨道跳转
 * @param event 点击事件
 */
function onBarClick(event: any) {
  // 引擎在 touchend 之后会补发一次 tap，且坐标是**按下时**的位置：
  // 本次手势刚提交过值时必须吞掉，否则拖动结果会被拉回起点（回弹）。
  if (tapSwallowAt && Date.now() - tapSwallowAt < TAP_SWALLOW_WINDOW) {
    tapSwallowAt = 0
    return
  }
  tapSwallowAt = 0
  if (isDisabled.value) return

  const request = ++interactionRequest
  const vertical = props.vertical
  // 坐标同步取出（异步度量后事件对象可能已被回收），且不能用 0 兜底——
  // 0 会被当成「点在轨道最左端」，直接把值打到 min
  const pointer = readPointer(event)
  if (!Number.isFinite(pointer)) return
  // 基于可滑动有效轨道换算点击位置，避免主题内边距造成偏差
  getRect(`#${trackId.value}`, false, proxy).then((data) => {
    // 度量回调晚于卸载落地时丢弃（真机 9902 晚到 patch 家族）
    if (!isAlive() || isDisabled.value || request !== interactionRequest || vertical !== props.vertical) return
    trackSize.value = Number(props.vertical ? data.height : data.width)
    trackStart.value = Number(props.vertical ? data.top : data.left)
    handleBarClickAt(pointer - trackStart.value)
  })
}

/**
 * 处理轨道点击跳转具体逻辑
 * @param {number} position 相对起始点的点击位置
 */
function handleBarClickAt(position: number) {
  if (trackSize.value <= 0 || !Number.isFinite(trackSize.value)) return
  const clickValue = calcByStep(positionToValue(position))

  if (props.range) {
    const [left, right] = currentValue.value
    const distLeft = Math.abs(clickValue - left)
    const distRight = Math.abs(clickValue - right)
    const newValue = [...(modelValue.value as number[])]

    if (distLeft <= distRight) {
      newValue[0] = clickValue
    } else {
      newValue[1] = clickValue
    }
    updateValue(newValue)
  } else {
    updateValue(clickValue)
  }

  emit('change', modelValue.value)
}

defineExpose<SliderExpose>({
  initSlider
})

// ---------- 主线程 worklet（跟手，零线程跨越） ----------

/**
 * 触摸开始（主线程）：一次性度量轨道几何并缓存。
 *
 * 绑在进度条 __line（而不是带 @tap 的轨道 __bar）：MT 触摸绑定与 tap 同元素
 * 会互相干扰（CONVENTIONS §19 差异 #4）。滑块是 __line 的后代，touchstart
 * 冒泡到这里；度量目标仍是 __track，语义不变。
 */
const onBarTouchStart = (event: any) => {
  'main thread'
  const track = trackRef.current
  const line = lineRef.current
  geomRef.current = null
  if (!track || !line || line.getAttribute('gesture-disabled') === 'true' || typeof track.invoke !== 'function') return
  const vertical = line.getAttribute('gesture-vertical') === 'true'
  const version = line.getAttribute('gesture-version') || ''
  const touch = event.touches && event.touches[0]
  if (!touch) return
  const pointer = vertical ? touch.clientY : touch.clientX
  const left = Number(line.getAttribute('left-bound'))
  const right = Number(line.getAttribute('right-bound'))
  track.invoke('boundingClientRect').then((rect: any) => {
    if (trackRef.current !== track || lineRef.current !== line || line.getAttribute('gesture-version') !== version) return
    geomRef.current = {
      size: vertical ? rect.height : rect.width,
      start: vertical ? rect.top : rect.left,
      pointer, left, right, version
    }
  })
}

/**
 * 滑块跟手移动（主线程）：绝对定位公式 + 进度条样式直改。
 *
 * 范围模式下经 currentTarget 与右滑块引用比对判定拖动对象，边界值经
 * 进度条元素属性 left-bound / right-bound 实时读取（后台随重渲染更新）。
 */
const onDotTouchMove = (event: any) => {
  'main thread'
  const line = lineRef.current
  const geom = geomRef.current
  if (!line || !geom || !Number.isFinite(geom.size) || geom.size <= 0 || line.getAttribute('gesture-disabled') === 'true' || geom.version !== line.getAttribute('gesture-version')) return
  const cfgMin = Number(line.getAttribute('gesture-min'))
  const cfgMax = Number(line.getAttribute('gesture-max'))
  const cfgStep = Number(line.getAttribute('gesture-step')) || 1
  const cfgVertical = line.getAttribute('gesture-vertical') === 'true'
  const cfgRange = line.getAttribute('gesture-range') === 'true'
  const touch = event.touches && event.touches[0]
  if (!touch) return

  const scopeV = cfgMax - cfgMin
  if (scopeV === 0) return

  const pointer = cfgVertical ? touch.clientY : touch.clientX
  const dotR = dotRRef.current
  const isRight = !!dotR && !!event.currentTarget && (event.currentTarget as unknown) === dotR
  const initial = cfgRange && isRight ? geom.right : geom.left
  let value = initial + ((pointer - geom.pointer) / geom.size) * scopeV
  value = cfgMin + Math.round((value - cfgMin) / cfgStep) * cfgStep
  value = Math.min(Math.max(value, cfgMin), cfgMax)

  const sizeProp = cfgVertical ? 'height' : 'width'
  const startProp = cfgVertical ? 'top' : 'left'

  if (cfgRange) {
    const leftV = geom.left
    const rightV = geom.right
    const hasLeft = !isNaN(leftV)
    const hasRight = !isNaN(rightV)
    // 拖动对象判定：currentTarget 即右滑块则为右滑块，否则左/单滑块
    if (isRight) {
      const endPct = ((Math.max(value, leftV) - cfgMin) / scopeV) * 100
      const startPct = hasLeft ? ((Math.min(value, leftV) - cfgMin) / scopeV) * 100 : endPct
      line.setStyleProperty(startProp, `${startPct}%`)
      line.setStyleProperty(sizeProp, `${Math.max(0, endPct - startPct)}%`)
    } else {
      const startPct = ((Math.min(value, rightV) - cfgMin) / scopeV) * 100
      const endPct = hasRight ? ((Math.max(value, rightV) - cfgMin) / scopeV) * 100 : startPct
      line.setStyleProperty(startProp, `${startPct}%`)
      line.setStyleProperty(sizeProp, `${Math.max(0, endPct - startPct)}%`)
    }
  } else {
    const pct = ((value - cfgMin) / scopeV) * 100
    line.setStyleProperty(startProp, '0')
    line.setStyleProperty(sizeProp, `${Math.max(0, pct)}%`)
  }
}
</script>

<template>
  <view :class="rootClass" :style="rootStyle">
    <!-- 最小值文本 -->
    <view v-if="showExtremeValue" class="wd-slider__value wd-slider__value--min">
      <text>{{ min }}</text>
    </view>

    <!-- 轨道 -->
    <view
      :id="sliderId"
      :class="barClass"
      :style="barStyle"
      @touchstart="onBarTouchStartBg"
      @touchmove="onBarTouchMove"
      @tap.stop="onBarClick"
    >
      <!-- 可滑动有效轨道（用于尺寸测量与 marks 定位） -->
      <view :id="trackId" :main-thread-ref="trackRef" class="wd-slider__track">
        <template v-if="hasMarks">
          <view
            v-for="(mark, index) in scaleList"
            :key="index"
            :class="scaleItemClass(mark.val, index)"
            :style="scaleItemStyle(mark.position)"
          >
            <view
              v-if="mark.label"
              :class="`wd-slider__scale-desc ${props.theme === 'capsule' ? 'wd-slider__scale-desc--capsule' : 'wd-slider__scale-desc--default'}`"
            >
              <text>{{ mark.label }}</text>
            </view>
          </view>
        </template>
      </view>

      <!-- 进度条 + 滑块（main-thread-ref 供 worklet 跟手直改；
           left-bound / right-bound 属性向主线程下发范围边界。
           几何度量的 MT touchstart 挂在本节点：轨道 __bar 上有 @tap（点轨道跳转），
           而「需要 tap 的节点子树不挂 MT 触摸绑定」是 CONVENTIONS §19 差异 #4
           的硬规则（wd-picker-view / wd-fab 曾因此回退）。滑块是 __line 的后代，
           touchstart 会冒泡到这里，度量目标仍是同一条轨道。 -->
      <view
        :main-thread-ref="lineRef"
        :class="lineClass"
        :style="lineStyle"
        :main-thread-bindtouchstart="onBarTouchStart"
        :gesture-min="String(min)"
        :gesture-max="String(max)"
        :gesture-step="String(validStep)"
        :gesture-vertical="String(vertical)"
        :gesture-range="String(range)"
        :gesture-disabled="String(isDisabled)"
        :gesture-version="gestureVersion"
        :left-bound="String(currentValue[0])"
        :right-bound="String(currentValue[1])"
      >
        <!-- 单滑块 / 双滑块左侧 -->
        <view
          :class="`wd-slider__dot ${range ? 'wd-slider__dot--left' : ''}`"
          @touchstart="(e: any) => onTouchStart(e, 0)"
          :main-thread-bindtouchmove="onDotTouchMove"
          @touchend="onTouchEnd"
          @touchcancel="onTouchEnd"
        >
          <view v-if="popoverVisible !== 'never'" class="wd-slider__dot-popover" :class="{ 'is-visible': showDotPopover(0) }">
            <text class="wd-slider__dot-popover-text">{{ dotDisplayValue(0) }}</text>
            <view class="wd-slider__dot-popover-arrow" />
          </view>
          <view class="wd-slider__dot-slider">
            <WdIcon name="multiple-horizontal" size="14px" color="#868a9c" />
          </view>
        </view>

        <!-- 双滑块右侧 -->
        <view
          v-if="range"
          :main-thread-ref="dotRRef"
          :class="`wd-slider__dot wd-slider__dot--right`"
          @touchstart="(e: any) => onTouchStart(e, 1)"
          :main-thread-bindtouchmove="onDotTouchMove"
          @touchend="onTouchEnd"
          @touchcancel="onTouchEnd"
        >
          <view v-if="popoverVisible !== 'never'" class="wd-slider__dot-popover" :class="{ 'is-visible': showDotPopover(1) }">
            <text class="wd-slider__dot-popover-text">{{ dotDisplayValue(1) }}</text>
            <view class="wd-slider__dot-popover-arrow" />
          </view>
          <view class="wd-slider__dot-slider">
            <WdIcon name="multiple-horizontal" size="14px" color="#868a9c" />
          </view>
        </view>
      </view>
    </view>

    <!-- 最大值文本 -->
    <view v-if="showExtremeValue" class="wd-slider__value wd-slider__value--max">
      <text>{{ max }}</text>
    </view>
  </view>
</template>
