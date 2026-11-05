/*
 * wd-slider — 滑块（原生优先重写版）
 *
 * Lynx 实现说明：
 * - 默认轨道保留圆点尺寸的定位盒，细线使用常规流 flex 居中；层序按 DOM 顺序。
 * - 跟手保留声明式 MTS，提交仍走后台 dragstart / dragmove / dragend / change。
 *   原生事件的 Element 包装器不是 ref 包装器，滑块身份取稳定的 gesture-index；
 *   触点按 identifier / id 追踪，坐标优先 client / page，再兼容 x / y，缺失不当 0。
 * - 几何只有一个后台缓存来源，经 gesture-size 属性提供给主线程；每次手势固定
 *   有效长度，首次零尺寸可在开始/落定时补测，不在 touchmove 度量或独立异步 MT 查询。
 * - 拖动/异步落定时缓存完整样式引用，进度条采用单一属性绑定，避免 Vue
 *   每帧重发 STYLE 覆盖主线程位置；不依赖宿主对省略样式键的合并或替换语义。
 *   落定后明确更新完整百分比，文案与属性在拖动期间仍正常更新。
 * - 父 v-model 的拖动回写不取消手势；落定前的旧值回声不覆盖本次手势的当前值。
 *   轨道 tap 查询与零几何落定都带交互代次，旧回调不能提交到下一次手势。
 * - touchend / touchcancel 后的补发 tap 在短窗内全部忽略；下一次真实 touchstart
 *   立即解除抑制。范围排序、步长与 dragend 在 change 前的事件时序保持一致。
 * - customStyle 归一为对象；首尾刻度用索引类名代替 Lynx 不支持的结构伪类。
 */
<script lang="ts" setup>
import './index.css'

import { computed, onMounted, ref, watch, useMainThreadRef } from 'vue-lynx'
import WdIcon from '../../primitives/wd-icon/wd-icon.vue'
import { sliderProps, type SliderEmits, type SliderExpose, type SliderMarks, type SliderPopoverVisible, type SliderValue } from './types'
import { deepClone, filterStyle, getRect, isArray, isDef, isEqual, parseStyle, uuid } from '../../common/util'
import { useFormDisabled } from '../../composables/useFormDisabled'
import { useAlive } from '../../composables/useAlive'
import { useLockScroll } from '../../composables/useLockScroll'

const props = defineProps(sliderProps)
const emit = defineEmits<SliderEmits>()
const isDisabled = useFormDisabled(props)
const isAlive = useAlive()

const sliderId = ref<string>(`wd-slider-${uuid()}`)
const trackId = ref<string>(`${sliderId.value}-track`)
const touchIndex = ref<number>(0) // 当前正在拖动的滑块索引 (0 为左/单，1 为右)
const isDragging = ref<boolean>(false) // 是否正在拖动
const isSettling = ref(false) // 零几何异步落定期间仍保留 MTS 的样式所有权
useLockScroll(() => isDragging.value || isSettling.value)

/** 轨道长度 (水平为宽度，垂直为高度) —— 后台度量，供点击跳转与落定重算 */
const trackSize = ref<number>(0)
/** 轨道起点在页面中的坐标（水平取 left，垂直取 top） */
const trackStart = ref<number>(0)
const modelValue = ref<SliderValue>(getInitValue()) // 内部维护的滑块值

/** 缓存轨道长度；一次有效手势内固定长度，MT/BG 均消费 gestureSize。 */
const dragTrackSize = ref(0)
const gestureSize = computed(() => (isDragging.value || isSettling.value) ? dragTrackSize.value : trackSize.value)

// ---------- 主线程（MTS）引用 ----------
interface MtElement {
  setStyleProperty(name: string, value: string): void
  getAttribute(name: string): string | null
}

const lineRef = useMainThreadRef<MtElement | null>(null)
const geomRef = useMainThreadRef<{ pointer: number; touchId?: string; left: number; right: number; version: string } | null>(null)
const modelRevision = ref(0)
// 按配置内容比较：父渲染重建相同 marks 数组不能取消拖动或每帧重新度量。
const gestureConfigVersion = computed(() => JSON.stringify([props.min, props.max, props.step, props.vertical, props.range, isDisabled.value, props.theme, props.showExtremeValue, props.marks]))
const gestureVersion = computed(() => JSON.stringify([gestureConfigVersion.value, modelRevision.value]))
let activeTouchId: string | undefined
let startPointer = 0
let startValue: SliderValue = deepClone(modelValue.value)
let dragMoved = false
/** 尚未收到最终受控值回写时，识别上一手势已发出的旧值回声。 */
const pendingModelEchoes = new Set<string>()
/** 补发 tap 短窗：新的真实 touchstart 立即清除，不在首个补 tap 后提前解除。 */
let tapSwallowUntil = 0
const TAP_SWALLOW_WINDOW = 350

let rectRequest = 0
let interactionRequest = 0
watch(gestureConfigVersion, () => {
  interactionRequest++
  rectRequest++
  isDragging.value = false
  isSettling.value = false
  activeTouchId = undefined
  dragTrackSize.value = 0
  trackSize.value = 0
  pendingModelEchoes.clear()
}, { flush: 'sync' })
// Measure after an actual layout/configuration change, not equal inline-prop replacements.
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
const barStyle = computed(() => filterStyle({ 'background-color': props.theme === 'capsule' ? props.inactiveColor : '' }))

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
  if ((isDragging.value || isSettling.value) && committedLineStyle) return committedLineStyle

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
      if (!isDragging.value && !isSettling.value) pendingModelEchoes.clear()
      return
    }
    // 已发出的旧值是受控回声，不能终止手势；真正的新外部值仍按原 API 替换。
    if (pendingModelEchoes.has(JSON.stringify(newValue))) return
    pendingModelEchoes.clear()
    interactionRequest++
    modelRevision.value++ // 声明式属性使 MT 的旧手势同步失效，无命令式 ref 派发。
    isDragging.value = false
    isSettling.value = false
    activeTouchId = undefined
    dragTrackSize.value = 0
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
  getRect(`#${trackId.value}`, false, proxy).then((data) => {
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
    if (isDragging.value || isSettling.value) pendingModelEchoes.add(JSON.stringify(newValue))
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

function readTouch(event: any, id?: string, changedFirst = false): any {
  const lists = changedFirst ? [event?.changedTouches, event?.touches] : [event?.touches, event?.changedTouches]
  for (const list of lists) {
    if (!list?.length) continue
    if (id === undefined) return list[0]
    for (let i = 0; i < list.length; i++) if (touchId(list[i]) === id) return list[i]
  }
}

/** 坐标缺失/非有限数不能转成 0；client/page 优先于宿主兼容的 x/y。 */
function readPointer(event: any, id?: string, changedFirst = false): number {
  const touch = readTouch(event, id, changedFirst)
  if (id !== undefined && !touch && (event?.touches?.length || event?.changedTouches?.length)) return NaN
  const candidates = props.vertical
    ? [touch?.clientY, touch?.pageY, touch?.y, event?.detail?.y, event?.clientY, event?.pageY, event?.y]
    : [touch?.clientX, touch?.pageX, touch?.x, event?.detail?.x, event?.clientX, event?.pageX, event?.x]
  for (const raw of candidates) {
    if (raw == null || raw === '') continue
    const value = Number(raw)
    if (Number.isFinite(value)) return value
  }
  return NaN
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
  const size = dragTrackSize.value
  if (size <= 0 || !Number.isFinite(size) || !Number.isFinite(pointer)) return props.min
  const value = props.range && isArray(startValue) ? startValue[index] : (startValue as number)
  return value + ((pointer - startPointer) / size) * scope.value
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
  if (isDisabled.value || isDragging.value) return
  const touch = readTouch(event, undefined, true)
  const id = touchId(touch)
  const pointer = readPointer(event, id, true)
  if (!Number.isFinite(pointer)) return

  interactionRequest++ // 取消较早的轨道 tap / 异步落定
  touchIndex.value = index
  activeTouchId = id
  startValue = deepClone(modelValue.value)
  startPointer = pointer
  dragTrackSize.value = trackSize.value
  dragMoved = false
  // 快速开始下一手势时仍可能收到上一手势的父级回声，保留到最新值被确认。
  pendingModelEchoes.add(JSON.stringify(modelValue.value))
  tapSwallowUntil = 0
  isSettling.value = false
  isDragging.value = true
  // 每个手势一次；有效长度不在拖动中变化，零尺寸则等本次结果补齐。
  initSlider()
  emit('dragstart', { value: modelValue.value })
}

/** 同一触点的 end 可补齐未派发的最后一帧；取消、无标识或缺失终点守住当前值。 */
function onTouchEnd(event: any, canceled = false) {
  if (!isDragging.value) return
  // 第二根手指抬起不能结束第一根手指的拖动。
  if (activeTouchId !== undefined && event?.changedTouches?.length && !readTouch({ changedTouches: event.changedTouches }, activeTouchId, true)) return
  const request = interactionRequest
  const pointer = readPointer(event, activeTouchId, true)
  tapSwallowUntil = Date.now() + TAP_SWALLOW_WINDOW
  isSettling.value = true
  isDragging.value = false

  const finish = () => {
    if (!isAlive() || isDisabled.value || request !== interactionRequest) return
    isSettling.value = false
    activeTouchId = undefined
    tapSwallowUntil = Date.now() + TAP_SWALLOW_WINDOW
    if (isEqual(props.modelValue, modelValue.value)) pendingModelEchoes.clear()
    emit('dragend', { value: modelValue.value })
    emit('change', modelValue.value)
  }
  const hasIdentifiedEndpoint = activeTouchId !== undefined && !!event?.changedTouches?.length
  if (canceled || !Number.isFinite(pointer) || (dragMoved && !hasIdentifiedEndpoint)) {
    finish()
    return
  }
  if (dragTrackSize.value > 0 && Number.isFinite(dragTrackSize.value)) {
    updateValue(dragValue(pointer))
    finish()
    return
  }
  ensureTrackSize().then((size) => {
    if (!isAlive() || isDisabled.value || request !== interactionRequest) return
    if (size > 0 && Number.isFinite(size)) {
      dragTrackSize.value = size
      updateValue(dragValue(pointer))
    }
    finish()
  })
}

/** 新的真实轨道点按解除补 tap 抑制；第二触点不能重置正在进行的手势。 */
function onBarTouchStartBg() {
  if (isDragging.value) return
  interactionRequest++
  isSettling.value = false
  tapSwallowUntil = 0
}

/** MT move 不拦冒泡，后台只提交当前滑块/触点的连续值。 */
function onBarTouchMove(event: any) {
  if (isDisabled.value || !isDragging.value || dragTrackSize.value <= 0 || !Number.isFinite(dragTrackSize.value)) return
  const pointer = readPointer(event, activeTouchId)
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
  // 不在第一个补 tap 后清除：同一手势的重复 tap 都不能覆盖终值。
  if (Date.now() < tapSwallowUntil || isDragging.value || isSettling.value) return
  tapSwallowUntil = 0
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
    const size = Number(props.vertical ? data.height : data.width)
    const start = Number(props.vertical ? data.top : data.left)
    if (!Number.isFinite(size) || size <= 0 || !Number.isFinite(start)) return
    trackSize.value = size
    trackStart.value = start
    handleBarClickAt(pointer - start)
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

/** 主线程只记录起点/起值；长度消费后台唯一缓存，不再独立 invoke 度量。 */
const onBarTouchStart = (event: any) => {
  'main thread'
  const line = lineRef.current
  if (!line || line.getAttribute('gesture-disabled') === 'true') return
  const previous = geomRef.current
  const version = line.getAttribute('gesture-version') || ''
  if (previous && previous.version === version && line.getAttribute('gesture-active') === 'true') return
  geomRef.current = null
  const vertical = line.getAttribute('gesture-vertical') === 'true'
  const touch = event.changedTouches?.[0] ?? event.touches?.[0]
  const candidates = vertical
    ? [touch?.clientY, touch?.pageY, touch?.y, event.detail?.y, event.clientY, event.pageY, event.y]
    : [touch?.clientX, touch?.pageX, touch?.x, event.detail?.x, event.clientX, event.pageX, event.x]
  let pointer = NaN
  for (const raw of candidates) {
    if (raw == null || raw === '') continue
    const value = Number(raw)
    if (Number.isFinite(value)) { pointer = value; break }
  }
  if (!Number.isFinite(pointer)) return
  const id = touch?.identifier ?? touch?.id
  geomRef.current = {
    pointer,
    touchId: id == null ? undefined : String(id),
    left: Number(line.getAttribute('left-bound')),
    right: Number(line.getAttribute('right-bound')),
    version
  }
}

/** 稳定滑块属性 + 固定触点 ID；MT/BG 使用相同起值、长度和舍入公式。 */
const onDotTouchMove = (event: any) => {
  'main thread'
  const line = lineRef.current
  const geom = geomRef.current
  if (!line || !geom || line.getAttribute('gesture-disabled') === 'true' || geom.version !== line.getAttribute('gesture-version')) return
  const size = Number(line.getAttribute('gesture-size'))
  if (!Number.isFinite(size) || size <= 0) return
  const cfgMin = Number(line.getAttribute('gesture-min'))
  const cfgMax = Number(line.getAttribute('gesture-max'))
  const cfgStep = Number(line.getAttribute('gesture-step')) || 1
  const vertical = line.getAttribute('gesture-vertical') === 'true'
  const range = line.getAttribute('gesture-range') === 'true'
  const scopeV = cfgMax - cfgMin
  if (!Number.isFinite(scopeV) || scopeV <= 0 || cfgStep <= 0) return

  let touch: any
  for (const list of [event.touches, event.changedTouches]) {
    if (!list?.length) continue
    if (geom.touchId === undefined) { touch = list[0]; break }
    for (let i = 0; i < list.length; i++) {
      const id = list[i]?.identifier ?? list[i]?.id
      if (id != null && String(id) === geom.touchId) { touch = list[i]; break }
    }
    if (touch) break
  }
  if (geom.touchId !== undefined && !touch && (event.touches?.length || event.changedTouches?.length)) return
  const candidates = vertical
    ? [touch?.clientY, touch?.pageY, touch?.y, event.detail?.y, event.clientY, event.pageY, event.y]
    : [touch?.clientX, touch?.pageX, touch?.x, event.detail?.x, event.clientX, event.pageX, event.x]
  let pointer = NaN
  for (const raw of candidates) {
    if (raw == null || raw === '') continue
    const value = Number(raw)
    if (Number.isFinite(value)) { pointer = value; break }
  }
  if (!Number.isFinite(pointer)) return
  // 原生运行时每次事件新建 Element 包装器，禁止与 MainThreadRef 做 === 比较。
  const target = event.currentTarget
  const isRight = range && target && typeof target.getAttribute === 'function' && target.getAttribute('gesture-index') === '1'
  const initial = isRight ? geom.right : geom.left
  if (!Number.isFinite(initial)) return
  const align = (value: number) => {
    const clamped = Math.min(Math.max(value, cfgMin), cfgMax)
    const stepped = parseFloat((cfgMin + Math.round((clamped - cfgMin) / cfgStep) * cfgStep).toFixed(10))
    return Math.min(Math.max(stepped, cfgMin), cfgMax)
  }
  const value = align(initial + ((pointer - geom.pointer) / size) * scopeV)
  const sizeProp = vertical ? 'height' : 'width'
  const startProp = vertical ? 'top' : 'left'
  if (range) {
    const other = align(isRight ? geom.left : geom.right)
    if (!Number.isFinite(other)) return
    const left = Math.min(value, other)
    const right = Math.max(value, other)
    line.setStyleProperty(startProp, `${((left - cfgMin) / scopeV) * 100}%`)
    line.setStyleProperty(sizeProp, `${((right - left) / scopeV) * 100}%`)
  } else {
    line.setStyleProperty(startProp, '0%')
    line.setStyleProperty(sizeProp, `${((value - cfgMin) / scopeV) * 100}%`)
  }
}

/** 主线程终止相同触点；后台 end 在子节点，避免同一元素同名绑定互相覆盖。 */
const onDotTouchEnd = (event: any) => {
  'main thread'
  const geom = geomRef.current
  if (!geom) return
  if (geom.touchId !== undefined && event.changedTouches?.length) {
    let matches = false
    for (const touch of event.changedTouches) {
      const id = touch?.identifier ?? touch?.id
      if (id != null && String(id) === geom.touchId) { matches = true; break }
    }
    if (!matches) return
  }
  geomRef.current = null
}

// 单一 v-bind 不走 mergeProps 的 style 拷贝；完整样式引用不变时，FULL_PROPS
// 不调用 hostPatchProp('style')，而数值文案、gesture 属性仍正常更新。
const lineBindings = computed(() => ({
  class: lineClass.value,
  style: lineStyle.value,
  'main-thread-ref': lineRef,
  'gesture-active': String(isDragging.value || isSettling.value),
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
      <!-- 可滑动有效轨道（用于尺寸测量与 marks 定位；默认主题下 2px 视觉轨道
           由内部的 __track-line 承载，见 index.scss 的 __bar--default 注释） -->
      <view :id="trackId" class="wd-slider__track" @layoutchange="onTrackLayoutChange">
        <!-- 2px 视觉轨道（真机 2026-11-03）：常规流子节点 + 父级 display:flex
             居中，不依赖 top:50% / transform，也不参与 z-index 层序。
             胶囊主题的轨道底色由 __bar 自身承担，故只在默认主题渲染。 -->
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
              <text>{{ mark.label }}</text>
            </view>
          </view>
        </template>
      </view>

      <!-- MTS 的 start/end 在 __line，move 在滑块；后台 start/end 在滑块，
           move 在 __bar。相同元素不重复注册同名 MT/BG 事件，tap 留在 __bar。 -->
      <view v-bind="{
        ...lineBindings,
        'main-thread-bindtouchstart': onBarTouchStart,
        'main-thread-bindtouchend': onDotTouchEnd,
        'main-thread-bindtouchcancel': onDotTouchEnd
      }">
        <!-- 进度条视觉条（真机 2026-11-01：着色从 __line 下沉到这里，
             让 __line 变成能容纳 24px 圆点的定位盒） -->
        <view :class="fillClass" :style="fillStyle" />

        <!-- 单滑块 / 双滑块左侧 -->
        <view
          :class="`wd-slider__dot ${range ? 'wd-slider__dot--left' : ''}`"
          gesture-index="0"
          @touchstart="(e: any) => onTouchStart(e, 0)"
          :main-thread-bindtouchmove="onDotTouchMove"
          @touchend="onTouchEnd"
          @touchcancel="(e: any) => onTouchEnd(e, true)"
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
          gesture-index="1"
          :class="`wd-slider__dot wd-slider__dot--right`"
          @touchstart="(e: any) => onTouchStart(e, 1)"
          :main-thread-bindtouchmove="onDotTouchMove"
          @touchend="onTouchEnd"
          @touchcancel="(e: any) => onTouchEnd(e, true)"
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
