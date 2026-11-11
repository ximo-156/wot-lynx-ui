/*
 * wd-slider — 滑块（原生优先）
 *
 * - 跟手使用声明式 MTS；后台维护 v-model、dragstart/move/end/change。
 * - consume-slide-event 仅拦截滑块轴向的原生手势，不持有页面/弹层滚动锁；
 *   Web 用 touch-action 放行交叉轴，MT/BG 同步判定手势方向。
 * - 原生 move/end/cancel 的 target 延续 start；轨道上的 end 仅作容错。
 * - 多指按 identifier/id 追踪；同一固定握把的单指流兼容原生临时 ID，
 *   两列表候选必须一致，出现多指后不再降级；未知目标不放宽归属校验。
 * - 手势内固定缓存几何；移动不做异步度量。落定查询与计时器均校验交互代次，
 *   旧回调不清理下一手势；终止 owner/revision 握手区分迟到 A 与更晚 B。
 * - MT 独立缓存视觉终值；1200ms timeout 结束当前段，合法同触点 move 可另起续拖段。
 * - 拖动/落定期间保留完整样式引用，避免后台 STYLE 覆盖 MTS 位置；松手后
 *   恢复完整百分比。受控值的旧回声与补发 tap 不能覆盖当前手势的终值。
 * - 气泡结构显隐、明确 top/left 锚点；文字排版直接声明在 text 上。
 */
<script lang="ts" setup>
import './index.css'

import { computed, onBeforeUnmount, onMounted, ref, watch, useMainThreadRef } from 'vue-lynx'
import WdIcon from '@wot-lynx/primitives/wd-icon'
import { sliderProps, type SliderEmits, type SliderExpose, type SliderPopoverVisible, type SliderValue } from './types'
import { deepClone, filterStyle, getRect, isArray, isDef, isEqual, parseStyle, uuid } from '@wot-lynx/core/common/util'
import { useFormDisabled } from '@wot-lynx/core/composables/useFormDisabled'
import { useAlive } from '@wot-lynx/core/composables/useAlive'
import { useGlobalConfig } from '@wot-lynx/core/composables/useGlobalConfig'
import { COOLGREY } from '@wot-lynx/core/common/theme'

const props = defineProps(sliderProps)
const emit = defineEmits<SliderEmits>()
const isDisabled = useFormDisabled(props)
const isAlive = useAlive()
const globalConfig = useGlobalConfig()

const gripIconColor = computed(() => (globalConfig.value.theme === 'dark' ? COOLGREY[5] : COOLGREY[6]))
const sliderId = ref<string>(`wd-slider-${uuid()}`)
const trackId = ref<string>(`${sliderId.value}-track`)
const touchIndex = ref(0)
const isDragging = ref(false)
// 落定仅保留 MTS 样式所有权，不阻止页面滚动，也不保持正常模式的气泡。
const isSettling = ref(false)
// 原生握把的 MTS 位置所有权跨正常 end/idle 保留，旧 BG A 不能覆盖更晚 MT B。
// 直接 BG 容错、无初始几何、轨道 tap 和真实外部/配置替换才交还后台。
const bgOwnsLinePose = ref(true)

/** 官方局部原生手势仲裁：角度由 atan2(dy, dx) 决定；禁用时全方向放行。
 * https://lynxjs.org/api/elements/built-in/view.md#consume-slide-event
 */
const consumeSlideEvent = computed(() => isDisabled.value ? [] : props.vertical
  ? [[-135, -45], [45, 135]]
  : [[-180, -135], [-45, 45], [135, 180]])

const trackSize = ref(0)
const trackStart = ref(0)
const modelValue = ref<SliderValue>(getInitValue())
const dragTrackSize = ref(0)
const gestureSize = computed(() => (isDragging.value || isSettling.value) ? dragTrackSize.value : trackSize.value)

interface MtElement {
  setStyleProperty(name: string, value: string): void
  setStyleProperties?(style: Record<string, string>): void
  getAttribute(name: string): string | null
}

type GestureEndReason = 'end' | 'cancel' | 'axis' | 'timeout' | 'replaced'
interface GestureOwner {
  revision: number
  startedAt?: number
  touchId?: string
  /** 单指流的固定命中目标；不可用时仍严格按 ID 匹配。 */
  target?: string
  pointer: number
  crossPointer?: number
  index: number
}
interface BgGestureStart {
  owner: GestureOwner
  physicalOwner: GestureOwner
  version: string
  pointer: number
  crossPointer?: number
  values: SliderValue
  size: number
  resumedFrom?: { owner: GestureOwner; physicalOwner: GestureOwner; version: string }
}
interface RetiredGesture {
  owner: GestureOwner
  physicalOwner: GestureOwner
  version: string
  endingVersion: string
  request: number
  config: string
  context: number
  visual: number
  pointer: number
  crossPointer: number
  values: SliderValue
  size: number
  lastTime?: number
  moved: boolean
  multiTouchSeen: boolean
  axisClaimed: boolean
}
interface MtVisual {
  config: string
  context: string
  visual: string
  left: number
  right: number
  closedStartFloor: number
}
interface MtGesture {
  owner: GestureOwner
  physicalOwner: GestureOwner
  pointer: number
  crossPointer: number
  left: number
  right: number
  size: number
  index: number
  version: string
  config: string
  context: string
  visual: string
  startRevisionFloor: number
  ackRevision: number
  timestamp?: number
  axisClaimed: boolean
  moved: boolean
  multiTouchSeen: boolean
  activeSeen: boolean
  pendingResume: boolean
  write(event: any, phase: 'move' | 'end' | 'cancel'): boolean
}

const lineRef = useMainThreadRef<MtElement | null>(null)
const geomRef = useMainThreadRef<MtGesture | null>(null)
// 独立于后台回写的最近一次主线程视觉值；不在 BG 命令式访问主线程 ref。
const visualRef = useMainThreadRef<MtVisual | null>(null)
const modelRevision = ref(0)
// 真实外部模型/配置取消是硬边界；普通拖动回声与正常结束不能重置此上下文。
const contextRevision = ref(0)
// 轨道 tap / MT 无法计算的零尺寸落定另行废弃视觉缓存，不冒充外部模型改变。
const visualResetRevision = ref(0)
const startRevision = ref(0)
const bgStart = ref<BgGestureStart | null>(null)
const lastEnded = ref<{
  owner: GestureOwner; physicalOwner: GestureOwner; version: string;
  reason: GestureEndReason; timestamp?: number
} | null>(null)
const retiredGesture = ref<RetiredGesture | null>(null)
const gestureConfigVersion = computed(() => JSON.stringify([props.min, props.max, props.step, props.vertical, props.range, isDisabled.value, props.theme, props.showExtremeValue, props.marks]))
const gestureVersion = computed(() => JSON.stringify([gestureConfigVersion.value, modelRevision.value]))
let activeTouchId: string | undefined
let gestureEventTime: number | undefined
let gestureStartTime: number | undefined
let startPointer = 0
let startCrossPointer = NaN
let startValue: SliderValue = deepClone(modelValue.value)
let dragMoved = false
let multiTouchSeen = false
let axisClaimed = false
let pendingSettlement: { request: number; owner: GestureOwner } | undefined
const pendingModelEchoes = new Set<string>()
let tapSwallowUntil = 0
const TAP_SWALLOW_WINDOW = 350
const DIRECTION_THRESHOLD = 10
let rectRequest = 0
let interactionRequest = 0

// 丢失结束信号的受限兜底。静默不等于抬指：新单指 start 可立即接管旧手势；
// 只认当前触点的有效帧，异号 end / 无效 move / 旧查询不能取消或续命此计时器。
const STUCK_DRAG_MS = 1200
let stuckDragTimer: ReturnType<typeof setTimeout> | undefined

function clearStuckDragWatch() {
  if (stuckDragTimer !== undefined) {
    clearTimeout(stuckDragTimer)
    stuckDragTimer = undefined
  }
}

function armStuckDragWatch() {
  clearStuckDragWatch()
  const request = interactionRequest
  stuckDragTimer = setTimeout(() => {
    if (request !== interactionRequest || !isAlive() || !isDragging.value) return
    stuckDragTimer = undefined
    onTouchEnd({ changedTouches: [] }, true, 'timeout')
  }, STUCK_DRAG_MS)
}

onBeforeUnmount(() => {
  // 所有退休上下文只属于当前挂载；销毁不保留下一帧的续拖资格。
  const needsEnd = isDragging.value || isSettling.value
  interactionRequest++
  clearStuckDragWatch()
  retiredGesture.value = null
  pendingSettlement = undefined
  isDragging.value = false
  isSettling.value = false
  if (needsEnd) emit('dragend', { value: modelValue.value })
})

function invalidateGestureContext(resetGeometry = false) {
  bgOwnsLinePose.value = true
  const needsEnd = isDragging.value || isSettling.value
  const value = deepClone(modelValue.value)
  interactionRequest++
  contextRevision.value++
  modelRevision.value++
  clearStuckDragWatch()
  retiredGesture.value = null
  pendingSettlement = undefined
  bgStart.value = null
  lastEnded.value = null
  isDragging.value = false
  isSettling.value = false
  activeTouchId = undefined
  gestureEventTime = undefined
  gestureStartTime = undefined
  dragTrackSize.value = 0
  if (resetGeometry) {
    rectRequest++
    trackSize.value = 0
  }
  pendingModelEchoes.clear()
  // 只平衡交互生命周期；外部覆盖/配置改变不再发一个旧值 change 干扰调用方。
  if (needsEnd) emit('dragend', { value })
}
watch(gestureConfigVersion, () => invalidateGestureContext(true), { flush: 'sync' })
watch(gestureConfigVersion, () => initSlider(), { flush: 'post' })

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
 *
 * 默认主题下轨道盒本身不承载视觉：2px 视觉条下沉到 __track-line（真机
 * 2026-11-03），因此自定义 inactiveColor 落到 __track-line 上；胶囊主题
 * 仍由轨道盒自身着色。
 *
 * ⚠️ 空串不能直接下发（真机 2026-11-03 缺陷）：Lynx 原生内联通道把
 * `background-color: ''` 当作无效值写入元素属性表，会把 CSS 类里的令牌色
 * 一起顶掉 —— 轨道与进度条双双透明，整条滑块看起来「消失」。这里统一经
 * filterStyle 剔除空值，未自定义颜色时让 CSS 令牌继续生效。
 */
const barStyle = computed(() => filterStyle({
  'background-color': props.theme === 'capsule' ? props.inactiveColor : '',
  // Web 的原生事件监听是 passive；不能用 stopPropagation 代替默认手势仲裁。
  'touch-action': isDisabled.value ? 'auto' : props.vertical ? 'pan-x' : 'pan-y'
}))

/**
 * 轨道视觉样式（仅默认主题承载 inactiveColor）
 */
const trackStyle = computed(() => filterStyle({ 'background-color': props.theme === 'default' ? props.inactiveColor : '' }))

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
 * 静止/落定时输出完整且合法的定位键。
 *
 * 拖动与异步落定时保留同一个完整样式对象，并用 FULL_PROPS 逐值比较避免
 * 向宿主重发 style。不能依赖 SET_STYLE 的省略键合并：实际宿主会把 width
 * 清掉；也不能让编译器的 STYLE 快速路径每帧无条件重写 MTS 刚画的位置。
 */
let committedLineStyle: Record<string, string> | undefined
const lineStyle = computed(() => {
  if ((!bgOwnsLinePose.value || isDragging.value || isSettling.value) && committedLineStyle) return committedLineStyle

  const style: Record<string, string> = props.vertical
    ? { width: '100%', height: '0%', left: '0', top: '0', transition: 'none' }
    : { width: '0%', height: '100%', left: '0', top: '0', transition: 'none' }

  committedLineStyle = style
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
    style[startProp] = '0%'
    style[prop] = `${size}%`
  }

  return style
})

/** 进度条视觉条类名（胶囊主题线宽不同） */
const fillClass = computed(() => `wd-slider__line-fill wd-slider__line-fill--${props.theme}`)

/** 进度条视觉条样式（activeColor 在此下发；空值不下发，见 barStyle 注释） */
const fillStyle = computed(() => filterStyle({ 'background-color': props.activeColor }))

// ---------- 监听器 -----------

/**
 * 监听 modelValue 属性变化
 */
watch(
  () => props.modelValue,
  (newValue) => {
    if (isEqual(newValue, modelValue.value)) {
      if (!isDragging.value && !isSettling.value && !retiredGesture.value) pendingModelEchoes.clear()
      return
    }
    // 已发出的旧值是受控回声，不能终止手势；真正的新外部值仍按原 API 替换。
    if (pendingModelEchoes.has(JSON.stringify(newValue))) return
    invalidateGestureContext()
    modelValue.value = getInitValue()
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
/** 原生 layoutchange 提供已布局后的矩形，更新同一份轨道缓存。 */
function onTrackLayoutChange(event: any) {
  if (!isAlive()) return
  const data = event?.detail?.layout ?? event?.detail
  if (!data) return
  const size = Number(props.vertical ? data.height : data.width)
  if (!Number.isFinite(size) || size <= 0) return
  trackSize.value = size
  // layoutchange 的坐标空间因宿主而异；tap 起点仍由 boundingClientRect 提供。
  if ((isDragging.value || isSettling.value) && dragTrackSize.value <= 0) dragTrackSize.value = size
}

function initSlider() {
  const request = ++rectRequest
  const vertical = props.vertical
  getRect(`#${trackId.value}`).then((data) => {
    // 度量回调晚于卸载落地时丢弃（真机 9902 晚到 patch 家族）
    if (!isAlive() || request !== rectRequest || vertical !== props.vertical) return
    const size = Number(vertical ? data.height : data.width)
    const start = Number(vertical ? data.top : data.left)
    if (!Number.isFinite(size) || size <= 0 || !Number.isFinite(start)) return
    trackSize.value = size
    trackStart.value = start
    if ((isDragging.value || isSettling.value) && dragTrackSize.value <= 0) dragTrackSize.value = size
  })
}

import { getCurrentInstance } from 'vue-lynx'
const { proxy } = getCurrentInstance() as any

/**
 * 获取初始值
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

/** 将值对齐到最近的步长倍数。 */
function calcByStep(value: number): number {
  value = clamp(value, props.min, props.max)
  const steps = Math.round((value - props.min) / validStep.value)
  return clamp(parseFloat((props.min + steps * validStep.value).toFixed(10)), props.min, props.max)
}

/** 统一更新滑块值并触发事件。 */
function updateValue(value: SliderValue) {
  let newValue: SliderValue = deepClone(value)
  if (props.range && isArray(newValue)) {
    newValue = normalizeRangeValues(newValue as number[]).map((v) => calcByStep(v)) as [number, number]
  } else {
    newValue = calcByStep(newValue as number)
  }
  if (!isEqual(newValue, modelValue.value)) {
    if (isDragging.value || isSettling.value) pendingModelEchoes.add(JSON.stringify(newValue))
    modelValue.value = newValue
  }
}

/**
 * 保证轨道尺寸可用：无效时补测一次并返回 Promise（永不 reject）。
 * 真机首帧的 onMounted 度量可能拿到 0，落定前补测，不在 move 度量。
 */
function ensureTrackSize(): Promise<number> {
  if (trackSize.value > 0 && Number.isFinite(trackSize.value)) return Promise.resolve(trackSize.value)
  const request = ++rectRequest
  const vertical = props.vertical
  return getRect(`#${trackId.value}`).then((data) => {
    if (!isAlive() || request !== rectRequest || vertical !== props.vertical) return trackSize.value
    const size = Number(vertical ? data.height : data.width)
    const start = Number(vertical ? data.top : data.left)
    if (Number.isFinite(size) && size > 0 && Number.isFinite(start)) {
      trackSize.value = size
      trackStart.value = start
      if ((isDragging.value || isSettling.value) && dragTrackSize.value <= 0) dragTrackSize.value = size
    }
    return trackSize.value
  })
}

/** 原生 touch identifier 与部分宿主的 id 都是触点标识，不依赖 touches 顺序。 */
function touchId(touch: any): string | undefined {
  const id = touch?.identifier ?? touch?.id
  return id == null ? undefined : String(id)
}

function touchTarget(event: any): string | undefined {
  const target = event?.target
  const id = typeof target?.id === 'string' && target.id !== ''
    ? target.id : typeof target?.getAttribute === 'function' ? target.getAttribute('gesture-target') || target.getAttribute('id') : undefined
  return typeof id === 'string' && id !== '' ? id : undefined
}

function observeTouchCount(event: any) {
  const currentId = touchId(event?.touches?.[0])
  const changedId = touchId(event?.changedTouches?.[0])
  if (event?.touches?.length > 1 || event?.changedTouches?.length > 1 ||
      (currentId !== undefined && changedId !== undefined && currentId !== changedId)) {
    multiTouchSeen = true
    if (retiredGesture.value) retiredGesture.value.multiTouchSeen = true
  }
}

/** 同一命中目标、两列表各最多一指且互相一致，才允许单指 ID 漂移。 */
function singleTouchForTarget(event: any, target?: string): any {
  if (!target || touchTarget(event) !== target || event?.touches?.length > 1 || event?.changedTouches?.length > 1) return
  const current = event?.touches?.[0]
  const changed = event?.changedTouches?.[0]
  if (current && changed && touchId(current) !== touchId(changed)) return
  const candidate = changed ?? current
  return candidate && typeof candidate === 'object' && !Array.isArray(candidate) ? candidate : undefined
}

function eventTime(event: any): number | undefined {
  const raw = event?.timestamp ?? event?.timeStamp
  if (raw == null || raw === '') return undefined
  const time = Number(raw)
  return Number.isFinite(time) ? time : undefined
}

function readTouch(event: any, id?: string, changedFirst = false, singleTarget?: string): any {
  const lists = changedFirst ? [event?.changedTouches, event?.touches] : [event?.touches, event?.changedTouches]
  for (const list of lists) {
    if (!list?.length) continue
    if (id === undefined) return list[0]
    for (let i = 0; i < list.length; i++) if (touchId(list[i]) === id) return list[i]
    if (list.length === 1 && touchId(list[0]) === undefined && (!event?.touches?.length || event.touches.length === 1)) return list[0]
  }
  return singleTouchForTarget(event, singleTarget)
}

/** 多指仍按 ID；同目标单指不把 native 临时 identifier 误判为其他手指。 */
function isOtherTouch(event: any, id = activeTouchId, singleTarget?: string): boolean {
  if (singleTouchForTarget(event, singleTarget)) return false
  const changed = event?.changedTouches
  if (id === undefined || !changed?.length) return false
  for (let i = 0; i < changed.length; i++) {
    const changedId = touchId(changed[i])
    if (changedId === undefined || changedId === id) return false
  }
  return true
}

/** 坐标缺失/非有限数不能转成 0；client/page 优先于宿主兼容的 x/y。 */
function readPointer(event: any, id?: string, changedFirst = false, vertical = props.vertical, singleTarget?: string): number {
  const primary = changedFirst ? event?.changedTouches : event?.touches
  const secondary = changedFirst ? event?.touches : event?.changedTouches
  const candidatesList = primary?.length ? primary : secondary
  if (id === undefined && candidatesList?.length > 1) return NaN
  const touch = readTouch(event, id, changedFirst, singleTarget)
  if ((touch != null && (typeof touch !== 'object' || Array.isArray(touch))) || (id !== undefined && !touch)) return NaN
  const candidates = vertical
    ? [touch?.clientY, touch?.pageY, touch?.y, event?.detail?.y, event?.clientY, event?.pageY, event?.y]
    : [touch?.clientX, touch?.pageX, touch?.x, event?.detail?.x, event?.clientX, event?.pageX, event?.x]
  for (const raw of candidates) {
    if (raw == null || raw === '') continue
    const value = Number(raw)
    if (Number.isFinite(value)) return value
  }
  return NaN
}

/** 相对轨道像素距离转值。 */
function positionToValue(position: number): number {
  if (trackSize.value <= 0 || !Number.isFinite(trackSize.value)) return props.min
  return (position / trackSize.value) * scope.value + props.min
}

/** 起值 + 指针位移。 */
function pointerToValue(pointer: number, index: number): number {
  const size = dragTrackSize.value
  if (size <= 0 || !Number.isFinite(size) || !Number.isFinite(pointer)) return props.min
  const value = props.range && isArray(startValue) ? startValue[index] : (startValue as number)
  return value + ((pointer - startPointer) / size) * scope.value
}

/** 范围拖动始终保留另一端。 */
function dragValue(pointer: number): SliderValue {
  const value = pointerToValue(pointer, touchIndex.value)
  if (!props.range) return value
  const values: [number, number] = [...(startValue as [number, number])]
  values[touchIndex.value] = value
  return values
}

function scaleItemClass(val: number, index: number): string {
  const classes = ['wd-slider__scale-item', `wd-slider__scale-item--${props.theme}`]
  const isActive = Array.isArray(modelValue.value) ? val >= modelValue.value[0] && val <= modelValue.value[1] : val <= (modelValue.value as number)
  if (isActive) classes.push('is-active')
  if (isDisabled.value) classes.push('is-disabled')
  if (props.theme === 'capsule') {
    if (index === 0) classes.push('is-edge-start')
    if (index === scaleList.value.length - 1) classes.push('is-edge-end')
  }
  return classes.join(' ')
}

function scaleItemStyle(position: number): Record<string, string> {
  return props.vertical ? { top: `${position}%` } : { left: `${position}%` }
}

function dotDisplayValue(index: number): number {
  if (!props.range) return modelValue.value as number
  const values = currentValue.value
  return isDef(values[index]) ? values[index] : values[0]
}

function showDotPopover(index: number): boolean {
  const mode = props.popoverVisible as SliderPopoverVisible
  if (mode === 'always') return true
  if (mode === 'normal') return isDragging.value && touchIndex.value === index
  return false
}

/** 查询被下一次交互抢占时，也必须平衡已开始但尚未落定的上一段。 */
function abandonSettlement() {
  if (!pendingSettlement) return
  pendingSettlement = undefined
  isSettling.value = false
  activeTouchId = undefined
  gestureEventTime = undefined
  gestureStartTime = undefined
  emit('dragend', { value: modelValue.value })
  emit('change', modelValue.value)
}

function publishGestureStart(owner: GestureOwner, physicalOwner: GestureOwner, resumedFrom?: BgGestureStart['resumedFrom']) {
  bgStart.value = {
    owner, physicalOwner, version: gestureVersion.value,
    pointer: startPointer,
    crossPointer: Number.isFinite(startCrossPointer) ? startCrossPointer : undefined,
    values: deepClone(startValue), size: dragTrackSize.value, resumedFrom
  }
}

/** BG start 的 owner 与 MT 握把 start 取同一事件字段；revision 只作有序确认。 */
function onTouchStart(event: any, index: number) {
  if (isDisabled.value || !isAlive()) return
  observeTouchCount(event)
  const touch = readTouch(event, undefined, true)
  const id = touchId(touch)
  const pointer = readPointer(event, id, true)
  const time = eventTime(event)
  if (!Number.isFinite(pointer) || event?.touches?.length > 1 || event?.changedTouches?.length > 1) return
  const context = contextRevision.value
  if (isDragging.value) {
    if (event?.touches?.length !== 1 || touchId(event.touches[0]) !== id) return
    if (time !== undefined && gestureEventTime !== undefined && time < gestureEventTime) return
    // MT 已经记录更晚 B；结束 A 的 owner 随版本下发，B 可因果迁移，A 不可复活。
    onTouchEnd({ changedTouches: [], timestamp: time }, true, 'replaced')
  }
  abandonSettlement()
  if (!isAlive() || isDisabled.value || context !== contextRevision.value) return
  retiredGesture.value = null
  interactionRequest++
  touchIndex.value = index
  activeTouchId = id
  gestureEventTime = time
  gestureStartTime = time
  startValue = deepClone(modelValue.value)
  startPointer = pointer
  startCrossPointer = readPointer(event, id, true, !props.vertical)
  dragTrackSize.value = trackSize.value
  dragMoved = false
  multiTouchSeen = false
  axisClaimed = false
  const target = event?.target
  const bound = event?.currentTarget
  // 明确的 dot id 让正常握把子树与直接到 wrapper 的 BG 容错可区分。
  const throughGrip = target && bound && typeof bound.id === 'string' && bound.id !== '' && target.id !== bound.id
  bgOwnsLinePose.value = !(throughGrip && Number.isFinite(dragTrackSize.value) && dragTrackSize.value > 0)
  pendingModelEchoes.add(JSON.stringify(modelValue.value))
  tapSwallowUntil = 0
  isSettling.value = false
  isDragging.value = true
  const owner: GestureOwner = {
    revision: ++startRevision.value, startedAt: time, touchId: id, target: touchTarget(event),
    pointer, crossPointer: Number.isFinite(startCrossPointer) ? startCrossPointer : undefined, index
  }
  publishGestureStart(owner, owner)
  initSlider()
  armStuckDragWatch()
  emit('dragstart', { value: modelValue.value })
}

/** 真正 end/cancel 与静默 timeout 是不同原因；只有 timeout 留下续拖上下文。 */
function onTouchEnd(event: any, canceled = false, reason: GestureEndReason = canceled ? 'cancel' : 'end') {
  const time = eventTime(event)
  observeTouchCount(event)
  if (!isDragging.value) {
    const retired = retiredGesture.value
    if (!retired || isOtherTouch(event, retired.owner.touchId, retired.multiTouchSeen ? undefined : retired.owner.target)) return
    if (time !== undefined && retired.owner.startedAt !== undefined && time < retired.owner.startedAt) return
    // 退休期间真实抬指也会到达：不能因 isDragging=false 而保留续拖资格。
    retiredGesture.value = null
    modelRevision.value++
    lastEnded.value = {
      owner: retired.owner, physicalOwner: retired.physicalOwner,
      version: gestureVersion.value, reason, timestamp: time
    }
    return
  }
  const singleTarget = multiTouchSeen ? undefined : bgStart.value?.owner.target
  if (isOtherTouch(event, activeTouchId, singleTarget)) return
  if (time !== undefined && gestureStartTime !== undefined && time < gestureStartTime) return
  const start = bgStart.value
  if (!start) return
  clearStuckDragWatch()
  const request = interactionRequest
  const oldVersion = gestureVersion.value
  const pointer = readPointer(event, activeTouchId, true, props.vertical, singleTarget)
  const cross = readPointer(event, activeTouchId, true, !props.vertical, singleTarget)
  if (!axisClaimed && Number.isFinite(cross) && Number.isFinite(startCrossPointer)) {
    const distance = Math.abs(cross - startCrossPointer)
    if (distance > DIRECTION_THRESHOLD && distance > Math.abs(pointer - startPointer)) {
      canceled = true
      reason = 'axis'
    }
  }
  const hasIdentifiedEndpoint = activeTouchId !== undefined && !!event?.changedTouches?.length
  // 一个属于本段但比最新 move 旧的终点只收尾，不反向提交旧坐标。
  const olderEndpoint = time !== undefined && gestureEventTime !== undefined && time < gestureEventTime
  tapSwallowUntil = Date.now() + TAP_SWALLOW_WINDOW
  isSettling.value = true
  isDragging.value = false
  const noInitialMtGeometry = !Number.isFinite(start.size) || start.size <= 0
  const directTerminal = (reason === 'end' || reason === 'cancel') && event?.target && event?.currentTarget &&
    typeof event.currentTarget.id === 'string' && event.currentTarget.id !== '' && event.target.id === event.currentTarget.id
  if (noInitialMtGeometry || directTerminal) {
    bgOwnsLinePose.value = true
    visualResetRevision.value++
  }
  modelRevision.value++
  lastEnded.value = {
    owner: start.owner, physicalOwner: start.physicalOwner,
    version: gestureVersion.value, reason, timestamp: time
  }
  retiredGesture.value = reason === 'timeout' ? {
    owner: deepClone(start.owner), physicalOwner: deepClone(start.physicalOwner),
    version: oldVersion, endingVersion: gestureVersion.value, request,
    config: gestureConfigVersion.value, context: contextRevision.value, visual: visualResetRevision.value,
    pointer: startPointer, crossPointer: startCrossPointer, values: deepClone(startValue),
    size: dragTrackSize.value, lastTime: gestureEventTime, moved: dragMoved, multiTouchSeen, axisClaimed
  } : null
  pendingSettlement = { request, owner: start.owner }
  const finish = () => {
    if (!isAlive() || request !== interactionRequest || pendingSettlement?.request !== request) return
    pendingSettlement = undefined
    isSettling.value = false
    activeTouchId = undefined
    gestureEventTime = undefined
    gestureStartTime = undefined
    tapSwallowUntil = Date.now() + TAP_SWALLOW_WINDOW
    if (!retiredGesture.value && isEqual(props.modelValue, modelValue.value)) pendingModelEchoes.clear()
    emit('dragend', { value: modelValue.value })
    emit('change', modelValue.value)
  }
  if (canceled || olderEndpoint || !Number.isFinite(pointer) || (dragMoved && !hasIdentifiedEndpoint)) {
    finish()
    return
  }
  if (dragTrackSize.value > 0 && Number.isFinite(dragTrackSize.value)) {
    updateValue(dragValue(pointer))
    finish()
    return
  }
  ensureTrackSize().then((size) => {
    if (!isAlive() || request !== interactionRequest || pendingSettlement?.request !== request) return
    if (!isDisabled.value && size > 0 && Number.isFinite(size)) {
      // 此段起始没有可用 MT 几何，结果以 BG 为准；下一次 MT 不读旧视觉缓存。
      visualResetRevision.value++
      dragTrackSize.value = size
      updateValue(dragValue(pointer))
    }
    finish()
  })
}

/** 新的轨道 start 不保留退休上下文；来自 dot 的 start 已被自己的 BG handler 消费。 */
function onBarTouchStartBg(event: any) {
  observeTouchCount(event)
  if (isDragging.value) return
  abandonSettlement()
  retiredGesture.value = null
  bgStart.value = null
  interactionRequest++
  clearStuckDragWatch()
  isSettling.value = false
  tapSwallowUntil = 0
}

/** 退休上下文只用于同一物理触点继续移动；不做任何 native 查询/重新度量。 */
function resumeTimedOutGesture(event: any): boolean {
  const retired = retiredGesture.value
  if (!retired || retired.request !== interactionRequest || retired.config !== gestureConfigVersion.value ||
      retired.context !== contextRevision.value || retired.visual !== visualResetRevision.value ||
      isOtherTouch(event, retired.owner.touchId, retired.multiTouchSeen ? undefined : retired.owner.target)) return false
  if (retired.owner.touchId === undefined && event?.touches?.length > 1) return false
  const time = eventTime(event)
  if (time !== undefined && retired.lastTime !== undefined && time < retired.lastTime) return false
  const singleTarget = retired.multiTouchSeen ? undefined : retired.owner.target
  const pointer = readPointer(event, retired.owner.touchId, false, props.vertical, singleTarget)
  if (!Number.isFinite(pointer)) return false
  const cross = readPointer(event, retired.owner.touchId, false, !props.vertical, singleTarget)
  if (!retired.axisClaimed && Number.isFinite(cross) && Number.isFinite(retired.crossPointer)) {
    const crossDistance = Math.abs(cross - retired.crossPointer)
    if (crossDistance > Math.abs(pointer - retired.pointer)) {
      if (crossDistance > DIRECTION_THRESHOLD) retiredGesture.value = null
      return false
    }
  }
  // 映射仍以最初未排序的范围起值为准；当前段的 source time/pointer 则换成续拖帧。
  interactionRequest++
  startValue = deepClone(retired.values)
  startPointer = retired.pointer
  startCrossPointer = retired.crossPointer
  dragTrackSize.value = retired.size > 0 ? retired.size : trackSize.value
  touchIndex.value = retired.owner.index
  activeTouchId = retired.owner.touchId
  gestureStartTime = time
  gestureEventTime = time
  dragMoved = retired.moved
  multiTouchSeen = retired.multiTouchSeen
  axisClaimed = retired.axisClaimed
  retiredGesture.value = null
  isSettling.value = false
  isDragging.value = true
  tapSwallowUntil = 0
  const owner: GestureOwner = {
    revision: ++startRevision.value, startedAt: time, touchId: activeTouchId, target: retired.owner.target,
    pointer, crossPointer: Number.isFinite(cross) ? cross : undefined, index: touchIndex.value
  }
  publishGestureStart(owner, retired.physicalOwner, {
    owner: retired.owner, physicalOwner: retired.physicalOwner, version: retired.version
  })
  pendingModelEchoes.add(JSON.stringify(modelValue.value))
  armStuckDragWatch()
  emit('dragstart', { value: modelValue.value })
  return isAlive() && isDragging.value && !isDisabled.value
}

function onBarTouchMove(event: any) {
  if (isDisabled.value || !isAlive()) return
  observeTouchCount(event)
  if (!isDragging.value && !resumeTimedOutGesture(event)) return
  const singleTarget = multiTouchSeen ? undefined : bgStart.value?.owner.target
  if (isOtherTouch(event, activeTouchId, singleTarget)) return
  const time = eventTime(event)
  if (time !== undefined && gestureEventTime !== undefined && time < gestureEventTime) return
  const pointer = readPointer(event, activeTouchId, false, props.vertical, singleTarget)
  if (!Number.isFinite(pointer)) return
  if (time !== undefined) gestureEventTime = time
  armStuckDragWatch()
  const cross = readPointer(event, activeTouchId, false, !props.vertical, singleTarget)
  if (!axisClaimed && Number.isFinite(cross) && Number.isFinite(startCrossPointer)) {
    const mainDistance = Math.abs(pointer - startPointer)
    const crossDistance = Math.abs(cross - startCrossPointer)
    if (crossDistance > mainDistance) {
      if (crossDistance > DIRECTION_THRESHOLD) onTouchEnd(event, true, 'axis')
      return
    }
    if (mainDistance > DIRECTION_THRESHOLD) axisClaimed = true
  }
  if (dragTrackSize.value <= 0 || !Number.isFinite(dragTrackSize.value)) return
  dragMoved = true
  updateValue(dragValue(pointer))
  emit('dragmove', { value: modelValue.value })
}

function onBarClick(event: any) {
  if (Date.now() < tapSwallowUntil || isDragging.value || isSettling.value) return
  tapSwallowUntil = 0
  if (isDisabled.value) return
  retiredGesture.value = null
  const request = ++interactionRequest
  const vertical = props.vertical
  const pointer = readPointer(event)
  if (!Number.isFinite(pointer)) return
  getRect(`#${trackId.value}`).then((data) => {
    if (!isAlive() || isDisabled.value || request !== interactionRequest || vertical !== props.vertical) return
    const size = Number(props.vertical ? data.height : data.width)
    const start = Number(props.vertical ? data.top : data.left)
    if (!Number.isFinite(size) || size <= 0 || !Number.isFinite(start)) return
    trackSize.value = size
    trackStart.value = start
    handleBarClickAt(pointer - start)
  })
}

function handleBarClickAt(position: number) {
  if (trackSize.value <= 0 || !Number.isFinite(trackSize.value)) return
  bgOwnsLinePose.value = true
  visualResetRevision.value++
  const clickValue = calcByStep(positionToValue(position))
  if (props.range) {
    const [left, right] = currentValue.value
    const distLeft = Math.abs(clickValue - left)
    const distRight = Math.abs(clickValue - right)
    const newValue = [...(modelValue.value as number[])]
    if (distLeft <= distRight) newValue[0] = clickValue
    else newValue[1] = clickValue
    updateValue(newValue)
  } else {
    updateValue(clickValue)
  }
  emit('change', modelValue.value)
}

defineExpose<SliderExpose>({ initSlider })

// ---------- 主线程 worklet（唯一 start 工厂；后续 worklet 只调用状态成员） ----------
const onGripTouchStart = (event: any) => {
  'main thread'
  const line = lineRef.current
  const grip = event.currentTarget
  if (!line || line.getAttribute('gesture-disabled') === 'true' || !grip || typeof grip.getAttribute !== 'function') return
  const currentStartId = event.touches?.[0]?.identifier ?? event.touches?.[0]?.id
  const changedStartId = event.changedTouches?.[0]?.identifier ?? event.changedTouches?.[0]?.id
  if (event.touches?.length > 1 || event.changedTouches?.length > 1 ||
      (currentStartId != null && changedStartId != null && String(currentStartId) !== String(changedStartId))) {
    if (geomRef.current) geomRef.current.multiTouchSeen = true
    return
  }
  const config = line.getAttribute('gesture-config') || ''
  const context = line.getAttribute('gesture-context') || ''
  const visual = line.getAttribute('gesture-visual') || ''
  const version = line.getAttribute('gesture-version') || ''
  const rawTime = event.timestamp ?? event.timeStamp
  const time = rawTime != null && rawTime !== '' && Number.isFinite(Number(rawTime)) ? Number(rawTime) : undefined
  const previous = geomRef.current
  if (previous && previous.config === config && previous.context === context) {
    if (event.touches?.length !== 1) return
    if (time !== undefined && previous.timestamp !== undefined && time < previous.timestamp) return
  }
  const vertical = line.getAttribute('gesture-vertical') === 'true'
  const range = line.getAttribute('gesture-range') === 'true'
  const index = range && Number(grip.getAttribute('gesture-index')) === 1 ? 1 : 0
  const touch = event.changedTouches?.[0] ?? event.touches?.[0]
  if (touch != null && (typeof touch !== 'object' || Array.isArray(touch))) return
  const read = (item: any, e: any, axisVertical: boolean) => {
    const candidates = axisVertical
      ? [item?.clientY, item?.pageY, item?.y, e.detail?.y, e.clientY, e.pageY, e.y]
      : [item?.clientX, item?.pageX, item?.x, e.detail?.x, e.clientX, e.pageX, e.x]
    for (const raw of candidates) {
      if (raw == null || raw === '') continue
      const value = Number(raw)
      if (Number.isFinite(value)) return value
    }
    return NaN
  }
  const readTarget = (e: any): string | undefined => {
    const target = e?.target
    const id = typeof target?.id === 'string' && target.id !== ''
    ? target.id : typeof target?.getAttribute === 'function' ? target.getAttribute('gesture-target') || target.getAttribute('id') : undefined
    return typeof id === 'string' && id !== '' ? id : undefined
  }
  const pointer = read(touch, event, vertical)
  if (!Number.isFinite(pointer)) return
  const cross = read(touch, event, !vertical)
  const rawId = touch?.identifier ?? touch?.id
  const id = rawId == null ? undefined : String(rawId)
  const cache = visualRef.current
  const useCache = cache && cache.config === config && cache.context === context && cache.visual === visual
  const left = useCache ? cache.left : Number(line.getAttribute('left-bound'))
  const right = useCache ? cache.right : Number(line.getAttribute('right-bound'))
  if (!Number.isFinite(left) || (range && !Number.isFinite(right))) return
  const min = Number(line.getAttribute('gesture-min'))
  const max = Number(line.getAttribute('gesture-max'))
  const step = Number(line.getAttribute('gesture-step')) || 1
  const scopeValue = max - min
  const owner: GestureOwner = {
    revision: 0, startedAt: time, touchId: id, target: readTarget(event), pointer,
    crossPointer: Number.isFinite(cross) ? cross : undefined, index
  }
  let startFloor = Number(line.getAttribute('gesture-start-revision')) || 0
  if (useCache) startFloor = Math.max(startFloor, cache.closedStartFloor)
  if (previous && previous.config === config && previous.context === context) {
    // 接受新的单指 start 也关闭未收到 terminal 的旧物理触摸；排队 A 的 BG start
    // 不能冒充未知时间戳 B 的确认。floor 只消费已闭合段，不作为帧时间猜测。
    startFloor = Math.max(startFloor, previous.startRevisionFloor + 1, previous.ackRevision)
  }
  const state: MtGesture = {
    owner, physicalOwner: owner, pointer, crossPointer: cross, left, right, index,
    size: Number(line.getAttribute('gesture-size')), version, config, context, visual,
    startRevisionFloor: startFloor,
    ackRevision: 0, timestamp: time, axisClaimed: false, moved: false, multiTouchSeen: false,
    activeSeen: false, pendingResume: false, write: () => false
  }
  visualRef.current = { config, context, visual, left, right, closedStartFloor: startFloor }
  const matchesOwner = (a: any, b: any) => {
    if (!a || !b || a.index !== b.index || a.pointer !== b.pointer) return false
    // 同一原生 start 给 MT/BG 各自构造参数，临时 ID 不一定相等。
    if (a.touchId !== b.touchId && !(!state.multiTouchSeen && a.target && a.target === b.target)) return false
    if (a.startedAt !== undefined && b.startedAt !== undefined && a.startedAt !== b.startedAt) return false
    return true
  }
  const decode = (name: string): any => {
    const raw = line.getAttribute(name)
    if (!raw) return null
    try { return JSON.parse(raw) } catch { return null }
  }
  const align = (value: number) => {
    const clamped = Math.min(Math.max(value, min), max)
    const stepped = parseFloat((min + Math.round((clamped - min) / step) * step).toFixed(10))
    return Math.min(Math.max(stepped, min), max)
  }
  const write = (e: any, phase: 'move' | 'end' | 'cancel'): boolean => {
    const element = lineRef.current
    if (!element) return phase !== 'move'
    const raw = e.timestamp ?? e.timeStamp
    const timestamp = raw != null && raw !== '' && Number.isFinite(Number(raw)) ? Number(raw) : undefined
    // 旧/异号 terminal 不能清当前 geom；归属判断先于版本迁移与所有状态写入。
    if (timestamp !== undefined && state.owner.startedAt !== undefined && timestamp < state.owner.startedAt) return false
    if (phase === 'move' && timestamp !== undefined && state.timestamp !== undefined && timestamp < state.timestamp) return false
    const currentSingle = e.touches?.[0]
    const changedSingle = e.changedTouches?.[0]
    const currentId = currentSingle?.identifier ?? currentSingle?.id
    const changedId = changedSingle?.identifier ?? changedSingle?.id
    if (e.touches?.length > 1 || e.changedTouches?.length > 1 ||
        (currentId != null && changedId != null && String(currentId) !== String(changedId))) state.multiTouchSeen = true
    const soleCandidate = changedSingle ?? currentSingle
    const compatibleSingle = !state.multiTouchSeen && state.owner.target && readTarget(e) === state.owner.target &&
      soleCandidate && typeof soleCandidate === 'object' && !Array.isArray(soleCandidate) &&
      !(currentSingle && changedSingle && (currentSingle.identifier ?? currentSingle.id) !== (changedSingle.identifier ?? changedSingle.id))
      ? soleCandidate : undefined
    if (!compatibleSingle && state.owner.touchId !== undefined && e.changedTouches?.length) {
      let allOther = true
      for (const changed of e.changedTouches) {
        const changedId = changed?.identifier ?? changed?.id
        if (changedId == null || String(changedId) === state.owner.touchId) { allOther = false; break }
      }
      if (allOther) return false
    }
    const currentGrip = e.currentTarget
    if (currentGrip && typeof currentGrip.getAttribute === 'function' &&
        Number(currentGrip.getAttribute('gesture-index')) !== state.index) return false
    if (element.getAttribute('gesture-disabled') === 'true' ||
        state.config !== element.getAttribute('gesture-config') ||
        state.context !== element.getAttribute('gesture-context')) return phase !== 'move'
    // 真实 cancel 只清当前段，不按取消事件的坐标提交新值。
    if (phase === 'cancel') return true
    let currentTouch: any
    const lists = phase === 'end' ? [e.changedTouches, e.touches] : [e.touches, e.changedTouches]
    const activeCandidates = lists[0]?.length ? lists[0] : lists[1]
    if (state.owner.touchId === undefined && activeCandidates?.length > 1) return phase !== 'move'
    for (const list of lists) {
      if (!list?.length) continue
      if (state.owner.touchId === undefined) { currentTouch = list[0]; break }
      for (let i = 0; i < list.length; i++) {
        const candidateId = list[i]?.identifier ?? list[i]?.id
        if (candidateId != null && String(candidateId) === state.owner.touchId) { currentTouch = list[i]; break }
      }
      if (!currentTouch && list.length === 1 && (list[0]?.identifier ?? list[0]?.id) == null && (!e.touches?.length || e.touches.length === 1)) currentTouch = list[0]
      if (currentTouch) break
    }
    if (!currentTouch) currentTouch = compatibleSingle
    if (currentTouch != null && (typeof currentTouch !== 'object' || Array.isArray(currentTouch))) return phase !== 'move'
    const point = state.owner.touchId !== undefined && !currentTouch ? NaN : read(currentTouch, e, vertical)
    if (!Number.isFinite(point)) return phase !== 'move'
    const crossPoint = read(currentTouch, e, !vertical)
    const currentVersion = element.getAttribute('gesture-version') || ''
    const currentVisual = element.getAttribute('gesture-visual') || ''
    const startInfo = decode('gesture-start')
    const ended = decode('gesture-ended')
    const retired = decode('gesture-resume')
    const active = element.getAttribute('gesture-dragging') === 'true'
    const newerConfirmedStart = active && startInfo && startInfo.version === currentVersion &&
      startInfo.owner.revision > state.startRevisionFloor &&
      (!ended || startInfo.owner.revision > ended.owner.revision)
    const confirmedThisStart = newerConfirmedStart && matchesOwner(startInfo.owner, state.owner)
    const confirmedResume = newerConfirmedStart && startInfo.resumedFrom &&
      startInfo.resumedFrom.version === state.version &&
      matchesOwner(startInfo.resumedFrom.owner, state.owner) &&
      matchesOwner(startInfo.resumedFrom.physicalOwner, state.physicalOwner)
    const timeoutForThisOwner = phase === 'move' && retired && retired.version === state.version &&
      retired.endingVersion === currentVersion && retired.config === state.config &&
      String(retired.context) === state.context && String(retired.visual) === state.visual &&
      matchesOwner(retired.owner, state.owner) && matchesOwner(retired.physicalOwner, state.physicalOwner)
    // 缺时间的退休帧先等 BG 新 start/revision 确认，不能猜测一个同 id 的旧上下文。
    const immediateResume = timeoutForThisOwner && timestamp !== undefined &&
      state.owner.startedAt !== undefined && retired.owner.startedAt === state.owner.startedAt
    const closedEarlierEnd = phase === 'end' && ended && ended.owner.revision > 0 &&
      ended.owner.revision <= state.startRevisionFloor &&
      !(ended.reason !== 'timeout' && state.physicalOwner.revision > 0 &&
        ended.physicalOwner.revision === state.physicalOwner.revision) &&
      (ended.timestamp === undefined || state.owner.startedAt === undefined || ended.timestamp <= state.owner.startedAt)
    // 本地 MT 已闭合的先前物理段也能证明 terminal 属于 B，而非排队的 A；
    // 只用于真实 MT end 的终点缓存，不能用猜测的无时间 move 复活旧段。
    const earlierEndedOwner = ended && ended.version === currentVersion && (closedEarlierEnd || (
      state.owner.startedAt !== undefined && ended.owner.startedAt !== undefined &&
      ended.owner.startedAt < state.owner.startedAt &&
      !matchesOwner(ended.physicalOwner, state.physicalOwner) &&
      (ended.timestamp === undefined || ended.timestamp <= state.owner.startedAt)))
    if (currentVisual !== state.visual) {
      // BG-only tap/落定的缓存重置只可由明确的本次 BG start 重新确认；旧 geom 不猜起值。
      if (!confirmedThisStart && !confirmedResume) return phase !== 'move'
      state.visual = currentVisual
      state.pointer = startInfo.pointer
      state.crossPointer = startInfo.crossPointer ?? NaN
      state.left = Array.isArray(startInfo.values) ? startInfo.values[0] : startInfo.values
      state.right = Array.isArray(startInfo.values) ? startInfo.values[1] : 0
      state.size = startInfo.size
    }
    if (currentVersion !== state.version) {
      if (immediateResume) {
        state.version = currentVersion
        state.physicalOwner = retired.physicalOwner
        state.owner = {
          revision: 0, startedAt: timestamp, touchId: state.owner.touchId, target: state.owner.target,
          pointer: point, crossPointer: Number.isFinite(crossPoint) ? crossPoint : undefined, index: state.index
        }
        state.startRevisionFloor = retired.owner.revision
        state.activeSeen = false
        state.pendingResume = true
      } else if (confirmedResume) {
        state.version = currentVersion
        state.physicalOwner = startInfo.physicalOwner
        state.owner = startInfo.owner
        state.startRevisionFloor = startInfo.resumedFrom.owner.revision
        state.activeSeen = false
        state.pendingResume = false
      } else if (earlierEndedOwner || confirmedThisStart) {
        state.version = currentVersion
        state.activeSeen = false
      } else return phase !== 'move'
    }
    const ownsActiveStart = confirmedThisStart || confirmedResume ||
      (active && startInfo && startInfo.version === currentVersion &&
       state.ackRevision === startInfo.owner.revision && matchesOwner(startInfo.owner, state.owner))
    if (ownsActiveStart) {
      if (state.ackRevision !== startInfo.owner.revision) {
        state.ackRevision = startInfo.owner.revision
        state.physicalOwner = startInfo.physicalOwner
        // 到达确切 B 的确认后，以 B 的固定 BG 起点校准；例如未知时序中 MT
        // 未能消费 B 最后一帧，下一 C 不能永久沿用缓存中的 B 旧值。
        state.pointer = startInfo.pointer
        state.crossPointer = startInfo.crossPointer ?? NaN
        state.left = Array.isArray(startInfo.values) ? startInfo.values[0] : startInfo.values
        state.right = Array.isArray(startInfo.values) ? startInfo.values[1] : 0
        const size = Number(element.getAttribute('gesture-size'))
        state.size = Number.isFinite(size) && size > 0 ? size : startInfo.size
      }
      state.activeSeen = true
      state.pendingResume = false
    } else if (!active && state.activeSeen && !state.pendingResume) return phase !== 'move'
    if (!state.axisClaimed && Number.isFinite(crossPoint) && Number.isFinite(state.crossPointer)) {
      const mainDistance = Math.abs(point - state.pointer)
      const crossDistance = Math.abs(crossPoint - state.crossPointer)
      if (crossDistance > mainDistance) {
        if (crossDistance > DIRECTION_THRESHOLD) {
          const cache = visualRef.current
          if (cache && cache.config === state.config && cache.context === state.context && cache.visual === state.visual) {
            visualRef.current = { ...cache, closedStartFloor: Math.max(cache.closedStartFloor, state.startRevisionFloor + 1, state.ackRevision) }
          }
          geomRef.current = null
        }
        return phase !== 'move'
      }
      if (mainDistance > DIRECTION_THRESHOLD) state.axisClaimed = true
    }
    if (phase === 'end' && ((timestamp !== undefined && state.timestamp !== undefined && timestamp < state.timestamp) ||
        (state.moved && !(state.owner.touchId !== undefined && e.changedTouches?.length)))) return true
    if (!Number.isFinite(state.size) || state.size <= 0) {
      // 零尺寸可消费后来 BG 缓存的长度；绝不在 touchmove 调查询。
      const size = Number(element.getAttribute('gesture-size'))
      if (Number.isFinite(size) && size > 0) state.size = size
    }
    if (!Number.isFinite(state.size) || state.size <= 0 || !Number.isFinite(scopeValue) || scopeValue <= 0 || step <= 0) return phase !== 'move'
    const initial = state.index === 1 ? state.right : state.left
    if (!Number.isFinite(initial)) return phase !== 'move'
    const value = align(initial + ((point - state.pointer) / state.size) * scopeValue)
    const other = range ? align(state.index === 1 ? state.left : state.right) : 0
    if (range && !Number.isFinite(other)) return phase !== 'move'
    const leftValue = range ? Math.min(value, other) : value
    const rightValue = range ? Math.max(value, other) : 0
    const sizeProp = vertical ? 'height' : 'width'
    const startProp = vertical ? 'top' : 'left'
    const styles = {
      [startProp]: range ? `${((leftValue - min) / scopeValue) * 100}%` : '0%',
      [sizeProp]: `${((range ? rightValue - leftValue : value - min) / scopeValue) * 100}%`
    }
    if (typeof element.setStyleProperties === 'function') element.setStyleProperties(styles)
    else {
      element.setStyleProperty(startProp, styles[startProp])
      element.setStyleProperty(sizeProp, styles[sizeProp])
    }
    visualRef.current = {
      config: state.config, context: state.context, visual: state.visual, left: leftValue, right: rightValue,
      closedStartFloor: phase === 'end' ? Math.max(state.startRevisionFloor + 1, state.ackRevision) : state.startRevisionFloor
    }
    if (timestamp !== undefined) state.timestamp = timestamp
    if (phase === 'move') state.moved = true
    return true
  }
  state.write = write
  geomRef.current = state
}

const onGripTouchMove = (event: any) => {
  'main thread'
  const state = geomRef.current
  if (state) state.write(event, 'move')
}

const onGripTouchEnd = (event: any) => {
  'main thread'
  const state = geomRef.current
  if (!state || !state.write(event, 'end')) return
  const cache = visualRef.current
  if (cache && cache.config === state.config && cache.context === state.context && cache.visual === state.visual) {
    visualRef.current = { ...cache, closedStartFloor: Math.max(cache.closedStartFloor, state.startRevisionFloor + 1, state.ackRevision) }
  }
  geomRef.current = null
}

const onGripTouchCancel = (event: any) => {
  'main thread'
  const state = geomRef.current
  if (!state || !state.write(event, 'cancel')) return
  const cache = visualRef.current
  if (cache && cache.config === state.config && cache.context === state.context && cache.visual === state.visual) {
    visualRef.current = { ...cache, closedStartFloor: Math.max(cache.closedStartFloor, state.startRevisionFloor + 1, state.ackRevision) }
  }
  geomRef.current = null
}

const lineBindings = computed(() => ({
  class: lineClass.value,
  style: lineStyle.value,
  'main-thread-ref': lineRef,
  'gesture-active': String(isDragging.value || isSettling.value),
  'gesture-dragging': String(isDragging.value),
  'gesture-config': gestureConfigVersion.value,
  'gesture-context': String(contextRevision.value),
  'gesture-visual': String(visualResetRevision.value),
  'gesture-start-revision': String(startRevision.value),
  'gesture-start': JSON.stringify(bgStart.value),
  'gesture-ended': JSON.stringify(lastEnded.value),
  'gesture-resume': JSON.stringify(retiredGesture.value),
  'gesture-size': String(gestureSize.value),
  'gesture-min': String(props.min),
  'gesture-max': String(props.max),
  'gesture-step': String(validStep.value),
  'gesture-vertical': String(props.vertical),
  'gesture-range': String(props.range),
  'gesture-disabled': String(isDisabled.value),
  'gesture-version': gestureVersion.value,
  'left-bound': String(currentValue.value[0]),
  'right-bound': String(currentValue.value[1])
}))
</script>

<template>
  <view :class="rootClass" :style="rootStyle">
    <view v-if="showExtremeValue" class="wd-slider__value wd-slider__value--min">
      <text class="wd-slider__value-text" text-maxline="1">{{ min }}</text>
    </view>
    <view
      :id="sliderId"
      :class="barClass"
      :style="barStyle"
      :flatten="false"
      :consume-slide-event="consumeSlideEvent"
      @touchstart="onBarTouchStartBg"
      @touchmove="onBarTouchMove"
      @touchend="onTouchEnd"
      @touchcancel="(e: any) => onTouchEnd(e, true)"
      @tap.stop="onBarClick"
    >
      <view :id="trackId" class="wd-slider__track" @layoutchange="onTrackLayoutChange">
        <view v-if="props.theme === 'default'" class="wd-slider__track-line" :style="trackStyle" />
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
              <text class="wd-slider__scale-desc-text" text-maxline="1">{{ mark.label }}</text>
            </view>
          </view>
        </template>
      </view>
      <!-- 握把 MT 先处理，外层 dot BG 再沿同一原生事件冒泡；line 只负责样式/ref。 -->
      <view v-bind="lineBindings">
        <view :class="fillClass" :style="fillStyle" />
        <view
          :id="`${sliderId}-dot-0`"
          :class="`wd-slider__dot ${range ? 'wd-slider__dot--left' : ''}`"
          gesture-index="0"
          @touchstart="(e: any) => onTouchStart(e, 0)"
          @touchend="onTouchEnd"
          @touchcancel="(e: any) => onTouchEnd(e, true)"
        >
          <view v-if="showDotPopover(0)" class="wd-slider__dot-popover is-visible">
            <text class="wd-slider__dot-popover-text" text-maxline="1">{{ dotDisplayValue(0) }}</text>
            <view class="wd-slider__dot-popover-arrow" />
          </view>
          <view
            :id="`${sliderId}-grip-0`"
            :gesture-target="`${sliderId}-grip-0`"
            :flatten="false"
            class="wd-slider__dot-slider"
            gesture-index="0"
            :main-thread-bindtouchstart="onGripTouchStart"
            :main-thread-bindtouchmove="onGripTouchMove"
            :main-thread-bindtouchend="onGripTouchEnd"
            :main-thread-bindtouchcancel="onGripTouchCancel"
          >
            <WdIcon name="multiple-horizontal" size="14px" :color="gripIconColor" :user-interaction-enabled="false" :custom-style="{ 'pointer-events': 'none' }" />
          </view>
        </view>
        <view
          v-if="range"
          :id="`${sliderId}-dot-1`"
          gesture-index="1"
          :class="`wd-slider__dot wd-slider__dot--right`"
          @touchstart="(e: any) => onTouchStart(e, 1)"
          @touchend="onTouchEnd"
          @touchcancel="(e: any) => onTouchEnd(e, true)"
        >
          <view v-if="showDotPopover(1)" class="wd-slider__dot-popover is-visible">
            <text class="wd-slider__dot-popover-text" text-maxline="1">{{ dotDisplayValue(1) }}</text>
            <view class="wd-slider__dot-popover-arrow" />
          </view>
          <view
            :id="`${sliderId}-grip-1`"
            :gesture-target="`${sliderId}-grip-1`"
            :flatten="false"
            class="wd-slider__dot-slider"
            gesture-index="1"
            :main-thread-bindtouchstart="onGripTouchStart"
            :main-thread-bindtouchmove="onGripTouchMove"
            :main-thread-bindtouchend="onGripTouchEnd"
            :main-thread-bindtouchcancel="onGripTouchCancel"
          >
            <WdIcon name="multiple-horizontal" size="14px" :color="gripIconColor" :user-interaction-enabled="false" :custom-style="{ 'pointer-events': 'none' }" />
          </view>
        </view>
      </view>
    </view>
    <view v-if="showExtremeValue" class="wd-slider__value wd-slider__value--max">
      <text class="wd-slider__value-text" text-maxline="1">{{ max }}</text>
    </view>
  </view>
</template>
