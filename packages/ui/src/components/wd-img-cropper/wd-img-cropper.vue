/*
 * wd-img-cropper — 图片裁剪（原生优先重写版）
 *
 * Lynx 实现说明（相对 wot-ui 2.3.2 的适配点）：
 * - Lynx 无 canvas 2D API（CONVENTIONS §12 降级）：离屏导出缓冲 canvas
 *   以同结构 view 占位（同名 class / 内联尺寸，见 index.scss 的 __canvas）。
 *   宿主注册 createCanvasContext + canvasToTempFilePath 时走真实位图导出
 *   （fileType / quality 生效）；未注册时走**矢量降级**：emit 的 confirm
 *   携带 SVG data URI（tempFilePath，裁剪窗口内的图像几何 + 导出尺寸），
 *   与 wd-signature 的 SVG 降级同款——不伪造位图、也不让确认链路静默断掉。
 *   width / height 仍按 wot-ui 语义给出导出像素尺寸（裁剪框 × exportScale），
 *   src / x / y / scale / angle 为端口扩展几何信息；
 * - fileType / quality 为 canvas 导出专有 props：仅真实位图导出时生效，
 *   SVG 降级导出时不参与；
 * - 参考源离屏 canvas 的 top: -200% 依赖 Web 视口单位；Lynx 的 100vw/100vh
 *   支持不确定，根节点与 __cut 改用地基约定的 left/right/top/bottom: 0
 *   全屏贴边（CONVENTIONS §9），根节点显式 display: flex + column、
 *   __wrapper flex-grow: 1 撑满剩余高度（Lynx 默认 linear 布局，
 *   CONVENTIONS §15）；
 * - **跟手走主线程（声明式 MTS）**：手势面 __gesture（覆盖包裹器的独立
 *   view 层）的 touchmove 经 `main-thread-bindtouchmove` 绑定 'main thread'
 *   worklet，单指拖动 / 双指缩放的几何经与后台同一套公式（含 wot-ui 的
 *   边界钳制）计算后 `setStyleProperty('transform', ...)` 直改图片节点——
 *   零线程跨越，低端机跟手无滞后（CONVENTIONS §10）；
 * - **跨元素分工（真机冒泡语义）**：手势面 __gesture 绑主线程 touchstart /
 *   touchmove（起笔登记 + 跟手直改）与主线程 touchend / touchcancel（清
 *   手势起点）；包裹器 __wrapper（手势面父元素）绑后台 @touchstart（拖动
 *   态与起点记录）、@touchmove（笔迹数据累积——非响应式闭包变量，不触发
 *   重渲染）与 @touchend / @touchcancel（落定提交）。真机上手势面触摸
 *   冒泡到 __wrapper 即触发；**jsdom 不模拟冒泡**，测试中需向两个元素
 *   分别派发验证（slider / slide-verify 范本同款分工）；
 * - **触摸命中不依赖图片节点**：官方 image 元素文档只定义 load / error
 *   事件，且 __cut（z-index 9）与图片（z-index 2）的层序在真机上可能与
 *   绘制顺序不一致（CONVENTIONS §19 附注：absolute 带 z-index 时父级需
 *   z-index: 0）。图片元素降为纯展示（__img pointer-events: none），
 *   全部触摸绑定放在 view 手势面上（slider / signature 同款结构）；
 * - **几何经元素属性桥接**：图片中心（center-x / center-y）、显示尺寸
 *   （pic-w / pic-h）、缩放（img-scale）、角度（img-angle）与裁剪框
 *   （cut-left / cut-top / cut-w / cut-h）由后台随重渲染下发到图片
 *   元素，worklet 起笔时经 `getAttribute` 一次性读取并缓存（slider 的
 *   left-bound / right-bound 同款）——这些几何均为后台计算态而非可
 *   度量元素矩形，属性桥接比 invoke 更直接且起笔无异步窗口；
 * - **落定走后台**：@touchend 把累积的闭包变量写入响应式 ref（一次
 *   重渲染），Vue 接管的 imageStyle 与 worklet 直改值一致，无跳变；
 *   提交逻辑（confirm 的裁剪几何）留在后台，可单测；
 * - **跟手期不冲刷**：imageStyle 为 computed（依赖不变时返回同一引用），
 *   moving 拖动态引起的重渲染不会重写图片内联样式，worklet 直改值
 *   不被冲刷（CONVENTIONS §20）；
 * - 内联样式一律对象语法（字符串 style 会被 vue-lynx 静默丢弃，
 *   CONVENTIONS §19）；imageStyle 的 width/height 恒写（auto 为中性值）、
 *   transition-duration 恒写（0ms 为中性值），满足 Style Funnel（§20）；
 * - 图片原始尺寸：直接用原生 image> 的 load 事件（detail.width / height
 *   为图片原始像素），不依赖任何宿主 API；
 * - @click → @tap（CONVENTIONS §6）；根 view 的 @touchmove 按 §14 声明为
 *   emit 并转发，避免消费方同名监听穿透合并崩溃；
 * - customStyle 经 parseStyle 归一为对象；动画 / 节流定时器在卸载时清理，
 *   避免回调写入已销毁树（真机 9902 家族）。
 */
<script lang="ts" setup>
import './index.css'

import { computed, getCurrentInstance, onBeforeUnmount, ref, useMainThreadRef, watch } from 'vue-lynx'
import WdButton from '../../primitives/wd-button/wd-button.vue'
import WdIcon from '../../primitives/wd-icon/wd-icon.vue'
import { imgCropperProps, type ImgCropperEmits, type ImgCropperExpose } from './types'
import { useTranslate } from '../../composables/useTranslate'
import { getPlatform } from '../../common/platform'
import { createCanvasContext, canvasToTempFilePath } from '../../common/canvasHelper'
import { useAlive } from '../../composables/useAlive'
import { addUnit, getSystemInfo, uuid, parseStyle } from '../../common/util'

/** 顶部裁剪框占比 */
const TOP_PERCENT = 0.85
/** 动画过渡时长（毫秒） */
const ANIMATION_DURATION = 300
/** 节流频率（毫秒） */
const THROTTLE_INTERVAL = 1000 / 40

const canvasId = ref<string>(`cropper${uuid()}`) // 缓冲节点的唯一标识符（Lynx 无 canvas，占位 view 用）

// 延时动画设置 / 移动节流定时器 / 节流标志 / 初始图片宽高：
// 集中为可变状态对象而非顶层 let 绑定——script-setup 会为顶层 let 生成
// getter/setter 访问器，使测试垫片（vitest.config.ts 的 mtsWorkletPlugin）
// 无法识别 __returned__ 中的 worklet 函数（行为等价，仅绑定形态不同）。
const timers: { animation: any; throttle: any } = { animation: null, throttle: null }
const throttleState: { active: boolean } = { active: true }
const initImgSize: { width: null | number | string; height: null | number | string } = { width: null, height: null }

const props = defineProps(imgCropperProps)
const emit = defineEmits<ImgCropperEmits>()
const isAlive = useAlive()
const { proxy } = getCurrentInstance() as any
let loadRequest = 0
let exportRequest = 0
const exporting = ref(false)
const imageVersion = ref(0)

const { translate } = useTranslate('imgCropper')

// 旋转角度
const imgAngle = ref<number>(0)
// 是否开启动画
const isAnimation = ref<boolean>(false)

// 裁剪框的宽高
const picWidth = ref<number>(0)
const picHeight = ref<number>(0)
const cutWidth = ref<number>(0)
const cutHeight = ref<number>(0)
const offset = ref<number>(20)
// 裁剪框的距顶距左
const cutLeft = ref<number>(0)
const cutTop = ref<number>(0)
// 缓冲节点最终成像宽高
const canvasWidth = ref<string | number>('')
const canvasHeight = ref<string | number>('')
const canvasScale = ref<number>(2)
// 图片当前缩放比例
const imgScale = ref<number>(1)
// 图片中心轴点距左的距离
const imgLeft = ref<number>(getSystemInfo().windowWidth / 2)
// 图片中心轴点距顶的距离
const imgTop = ref<number>((getSystemInfo().windowHeight / 2) * TOP_PERCENT)

// 获取的原始图片信息
const imgInfo = ref<{ width: number; height: number } | null>(null)
// 系统信息缓存（窗口大小、平台等）
const info = ref(getSystemInfo())

// 是否处于移动/缩放中，用于控制裁剪框背景是否高亮
const moving = ref<boolean>(false)

/**
 * 记录触摸位置信息
 * [0] 存储第一根手指位置，[1] 预留给第二根手指（缩放时使用）
 */
interface TouchPosition {
  x: string | number
  y: string | number
}
const movingPosRecord = ref<TouchPosition[]>([
  { x: '', y: '' },
  { x: '', y: '' }
])
// 双指缩放时两触点间的距离（用于计算缩放比例）
const fingerDistance = ref<string | number>('')

/**
 * 后台累积态（非响应式闭包变量）：touchmove 热路径只写这里，不触发
 * 重渲染；touchend 落定时一次性写入响应式 ref（MTS 后台分工）。
 */
const mtState = {
  left: 0,
  top: 0,
  scale: 1
}

watch(
  [() => props.modelValue, () => props.imgSrc, () => props.imgWidth, () => props.imgHeight, () => props.aspectRatio, () => props.exportScale],
  () => {
    exportRequest++
    exporting.value = false
    imageVersion.value++
    moving.value = false
    imgInfo.value = null
    if (!props.modelValue || !props.imgSrc) {
      picWidth.value = 0
      picHeight.value = 0
      resetImg()
      return
    }
    info.value = getSystemInfo()
    initImgSize.width = props.imgWidth
    initImgSize.height = props.imgHeight
    const ratios = props.aspectRatio.split(':').map(Number)
    const widthRatio = ratios[0] > 0 ? ratios[0] : 1
    const heightRatio = ratios[1] > 0 ? ratios[1] : 1
    const width = Math.max(0, info.value.windowWidth - offset.value * 2)
    const height = width * heightRatio / widthRatio
    cutWidth.value = width
    cutHeight.value = height
    cutLeft.value = offset.value
    cutTop.value = (info.value.windowHeight * TOP_PERCENT - height) / 2
    canvasScale.value = props.exportScale
    canvasWidth.value = width
    canvasHeight.value = height
    initImageSize()
    // 显示尺寸兜底：宿主未注入 getImageInfo、load 事件也不回传宽高时
    // （真机降级路径，2026-10-25 巡检），图片若停留在 auto 尺寸，Lynx 的
    // <image> 会以 0×0 渲染（黑屏）。先用裁剪框尺寸撑起显示区域；
    // load 事件后续带回真实宽高时 computeImgSize 会按原图比例重算。
    if (!(picWidth.value > 0 && picHeight.value > 0)) {
      picWidth.value = width
      picHeight.value = height
    }
    resetImg()
  },
  { immediate: true, flush: 'sync' }
)
watch([() => props.maxScale, () => props.disabledRotate], () => {
  imageVersion.value++
  exportRequest++
  exporting.value = false
  moving.value = false
}, { flush: 'sync' })

watch(
  () => imgAngle.value,
  (newValue) => {
    if (newValue % 90) {
      imgAngle.value = Math.round(newValue / 90) * 90
    }
  },
  {
    deep: true,
    immediate: true
  }
)
watch(
  () => isAnimation.value,
  (newValue) => {
    // 开启过渡之后自动关闭
    timers.animation && clearTimeout(timers.animation)
    if (newValue) {
      timers.animation = setTimeout(() => {
        revertIsAnimation(false)
        clearTimeout(timers.animation)
      }, ANIMATION_DURATION)
    }
  },
  {
    deep: true,
    immediate: true
  }
)

const imageStyle = computed(() => {
  const style: Record<string, string> = {
    width: picWidth.value ? addUnit(picWidth.value) : 'auto',
    height: picHeight.value ? addUnit(picHeight.value) : 'auto',
    transform: `translate(${addUnit(imgLeft.value - picWidth.value / 2)}, ${addUnit(imgTop.value - picHeight.value / 2)}) scale(${
      imgScale.value
    }) rotate(${imgAngle.value}deg)`,
    'transition-duration': (isAnimation.value ? ANIMATION_DURATION : 0) + 'ms'
  }
  return style
})

/**
 * 根节点样式：customStyle 经 parseStyle 归一为对象（CONVENTIONS §19）。
 * 经 computed 暴露给模板——不在模板中直接调用导入的 parseStyle。
 */
const rootStyle = computed(() => parseStyle(props.customStyle))

/** 离屏缓冲节点尺寸（Lynx 无 canvas，占位 view 的宽高与 wot-ui 一致） */
const canvasStyle = computed(() => {
  return {
    width: `${Number(canvasWidth.value) * canvasScale.value}px`,
    height: `${Number(canvasHeight.value) * canvasScale.value}px`
  }
})

/**
 * 切换图片过渡动画状态
 * @param {boolean | { value: boolean }} animation 动画状态：true 启用，false 禁用，或包含 value 属性的对象
 */
function revertIsAnimation(animation: boolean | { value: boolean }) {
  if (typeof animation === 'boolean') {
    isAnimation.value = animation
  } else {
    isAnimation.value = animation.value
  }
}

/**
 * 旋转图片
 * @param {number} angle 旋转角度（建议使用 90 的倍数）
 */
function setRotate(angle: number) {
  if (!isAlive() || !Number.isFinite(angle) || props.disabledRotate || picWidth.value <= 0 || picHeight.value <= 0) return
  imageVersion.value++
  exportRequest++
  exporting.value = false
  moving.value = false
  angle = Math.round(angle / 90) * 90
  revertIsAnimation(true)
  imgAngle.value = angle

  // 重新计算缩放比例
  let tempPicWidth = picWidth.value
  let tempPicHeight = picHeight.value

  // 旋转后宽高互换
  if ((angle / 90) % 2) {
    tempPicWidth = picHeight.value
    tempPicHeight = picWidth.value
  }

  // 计算新的缩放比例
  const widthRatio = cutWidth.value / tempPicWidth
  const heightRatio = cutHeight.value / tempPicHeight
  imgScale.value = Math.max(widthRatio, heightRatio)

  // 检测边缘位置
  detectImgPosIsEdge()
}

/**
 * 重置图片到初始状态
 * 恢复：缩放比例、旋转角度、位置信息
 */
function resetImg() {
  const { windowHeight, windowWidth } = getSystemInfo()
  imageVersion.value++
  exportRequest++
  exporting.value = false
  moving.value = false
  imgScale.value = picWidth.value > 0 && picHeight.value > 0 ? Math.max(1, cutWidth.value / picWidth.value, cutHeight.value / picHeight.value) : 1
  imgAngle.value = 0
  imgLeft.value = windowWidth / 2
  imgTop.value = (windowHeight / 2) * TOP_PERCENT
}

/**
 * 计算图片尺寸以填满裁剪框
 */
function computeImgSize() {
  if (!imgInfo.value || !(imgInfo.value.width > 0 && imgInfo.value.height > 0 && cutWidth.value > 0 && cutHeight.value > 0)) return
  let tempPicWidth: number = picWidth.value
  let tempPicHeight: number = picHeight.value

  if (!initImgSize.height && !initImgSize.width) {
    // 计算图片与裁剪框的宽高比
    const imgRatio = imgInfo.value!.width / imgInfo.value!.height
    const cropRatio = cutWidth.value / cutHeight.value

    if (imgRatio > cropRatio) {
      // 图片更宽，以高度为准
      tempPicHeight = cutHeight.value
      tempPicWidth = tempPicHeight * imgRatio
    } else {
      // 图片更高，以宽度为准
      tempPicWidth = cutWidth.value
      tempPicHeight = tempPicWidth / imgRatio
    }
  } else if (initImgSize.height && !initImgSize.width) {
    tempPicHeight = Number(initImgSize.height)
    tempPicWidth = (imgInfo.value!.width / imgInfo.value!.height) * tempPicHeight
  } else if ((!initImgSize.height && initImgSize.width) || (initImgSize.height && initImgSize.width)) {
    tempPicWidth = Number(initImgSize.width)
    tempPicHeight = (imgInfo.value!.height / imgInfo.value!.width) * tempPicWidth
  }

  // 确保计算后的尺寸至少有一边等于裁剪框尺寸
  const widthRatio = cutWidth.value / tempPicWidth
  const heightRatio = cutHeight.value / tempPicHeight
  const scale = Math.max(widthRatio, heightRatio)

  picWidth.value = tempPicWidth
  picHeight.value = tempPicHeight
  // 设置初始缩放以适应裁剪框
  imgScale.value = scale
}

/**
 * 初始化图片尺寸，处理百分比等特殊单位
 */
function initImageSize() {
  // 处理宽度：支持百分比和像素值
  if (initImgSize.width && typeof initImgSize.width === 'string' && initImgSize.width.indexOf('%') !== -1) {
    const width: string = initImgSize.width.replace('%', '')
    initImgSize.width = (info.value.windowWidth / 100) * Number(width)
    picWidth.value = initImgSize.width as number
  } else if (initImgSize.width && typeof initImgSize.width === 'number') {
    picWidth.value = initImgSize.width
  }
  // 处理高度：支持百分比和像素值
  if (initImgSize.height && typeof initImgSize.height === 'string' && initImgSize.height.indexOf('%') !== -1) {
    const height = (props.imgHeight as string).replace('%', '')
    initImgSize.height = (info.value.windowHeight / 100) * Number(height)
    picHeight.value = initImgSize.height as number
  } else if (initImgSize.height && typeof initImgSize.height === 'number') {
    picHeight.value = Number(initImgSize.height)
  }
}

// ---------- 边界钳制（纯函数：后台与主线程 worklet 共用同一套公式） ----------

/** 裁剪框几何（页面/视口坐标；组件为 fixed 全屏，二者一致） */
interface CutBox {
  left: number
  top: number
  width: number
  height: number
}

/**
 * 钳制图片中心位置，防止拖出裁剪框（对齐参考源 detectImgPosIsEdge）。
 *
 * 注意：参考源左/右边界的 else 分支使用旧缩放值（imgScale.value）而非
 * 入参 scale——wot-ui 既有行为，逐行保留（PORTING §3.9 边界处理一致）。
 */
function clampImgPos(
  left: number,
  top: number,
  scale: number,
  oldScale: number,
  picW: number,
  picH: number,
  angle: number,
  cut: CutBox
): { left: number; top: number } {
  let currentImgLeft = left
  let currentImgTop = top
  let currentPicWidth = picW
  let currentPicHeight = picH

  // 翻转后宽高切换
  if ((angle / 90) % 2) {
    currentPicWidth = picH
    currentPicHeight = picW
  }
  // 左
  currentImgLeft =
    (currentPicWidth * scale) / 2 + cut.left >= currentImgLeft ? currentImgLeft : (currentPicWidth * oldScale) / 2 + cut.left
  // 右
  currentImgLeft =
    cut.left + cut.width - (currentPicWidth * scale) / 2 <= currentImgLeft
      ? currentImgLeft
      : cut.left + cut.width - (currentPicWidth * scale) / 2
  // 上
  currentImgTop =
    (currentPicHeight * scale) / 2 + cut.top >= currentImgTop ? currentImgTop : (currentPicHeight * scale) / 2 + cut.top
  // 下
  currentImgTop =
    cut.top + cut.height - (currentPicHeight * scale) / 2 <= currentImgTop
      ? currentImgTop
      : cut.top + cut.height - (currentPicHeight * scale) / 2

  return { left: currentImgLeft, top: currentImgTop }
}

/**
 * 校正缩放下限，防止缩放后露出背景（对齐参考源 detectImgScaleIsEdge 的
 * 缩放部分；位置钳制由 clampImgPos 承担）。
 */
function clampImgScale(scale: number, picW: number, picH: number, angle: number, cut: CutBox): number {
  let tempPicWidth = picW
  let tempPicHeight = picH
  let tempImgScale = scale

  // 翻转后宽高切换
  if ((angle / 90) % 2) {
    tempPicWidth = picH
    tempPicHeight = picW
  }
  if (tempPicWidth * tempImgScale < cut.width) {
    tempImgScale = cut.width / tempPicWidth
  }
  if (tempPicHeight * tempImgScale < cut.height) {
    tempImgScale = cut.height / tempPicHeight
  }
  return tempImgScale
}

/** 当前裁剪框几何（响应式 ref → CutBox） */
function currentCut(): CutBox {
  return { left: cutLeft.value, top: cutTop.value, width: cutWidth.value, height: cutHeight.value }
}

/**
 * 检测图片位置是否已到达裁剪框边缘（ref 版：后台落定 / 旋调用）
 * @param {number} [scale] 缩放比例，默认使用当前 imgScale.value
 */
function detectImgPosIsEdge(scale?: number) {
  const currentScale = scale || imgScale.value
  const clamped = clampImgPos(
    imgLeft.value,
    imgTop.value,
    currentScale,
    imgScale.value,
    picWidth.value,
    picHeight.value,
    imgAngle.value,
    currentCut()
  )
  imgScale.value = currentScale
  imgTop.value = clamped.top
  imgLeft.value = clamped.left
}

/**
 * 检测并校正图片缩放，防止缩放后露出背景（ref 版）
 */
function detectImgScaleIsEdge() {
  const tempImgScale = clampImgScale(imgScale.value, picWidth.value, picHeight.value, imgAngle.value, currentCut())
  detectImgPosIsEdge(tempImgScale)
}

/**
 * 节流处理，用于优化移动事件的处理频率
 */
function throttle() {
  if (info.value.platform === 'android') {
    timers.throttle && clearTimeout(timers.throttle)
    timers.throttle = setTimeout(() => {
      throttleState.active = true
    }, THROTTLE_INTERVAL)
  } else {
    !throttleState.active && (throttleState.active = true)
  }
}

/**
 * 处理图片触摸开始事件（包裹器后台绑定，真机上由图片触摸冒泡触发）：
 * 记录拖动态与手势起点（供 touchend 落定与后台累积用）。
 */
function handleImgTouchStart(event: any) {
  if (!props.modelValue || !props.imgSrc || picWidth.value <= 0 || picHeight.value <= 0 || !event.touches?.length) return
  // 如果处于在拖动中，背景为淡色展示全部，拖动结束则为 0.85 透明度
  moving.value = true
  if (event.touches.length === 1) {
    // 单指拖动
    movingPosRecord.value[0] = {
      x: event.touches[0].clientX - imgLeft.value,
      y: event.touches[0].clientY - imgTop.value
    }
  } else {
    // 以两指为坐标点 做直角三角形 a2 + b2 = c2
    const width = Math.abs(event.touches[1].clientX - event.touches[0].clientX)
    const height = Math.abs(event.touches[1].clientY - event.touches[0].clientY)
    fingerDistance.value = Math.sqrt(Math.pow(width, 2) + Math.pow(height, 2))
  }
  // 累积态初始化（当前落定值）：无移动的手势落定时写回同值，不跳变
  mtState.left = imgLeft.value
  mtState.top = imgTop.value
  mtState.scale = imgScale.value
}

/**
 * 处理图片触摸移动事件（包裹器后台绑定）：累积笔迹数据到非响应式闭包
 * 变量——与主线程 worklet 同一套公式（单指拖动 / 双指缩放 + 边界钳制），
 * 但不触发重渲染（跟手渲染由主线程 worklet 直改 transform 完成）。
 */
function handleImgTouchMove(event: any) {
  if (!moving.value || !props.modelValue || !event.touches?.length) return
  if (event.touches.length === 1) {
    // 单指拖动
    const { x, y } = movingPosRecord.value[0]
    const left = event.touches[0].clientX - Number(x)
    const top = event.touches[0].clientY - Number(y)
    const clamped = clampImgPos(left, top, imgScale.value, imgScale.value, picWidth.value, picHeight.value, imgAngle.value, currentCut())
    mtState.left = clamped.left
    mtState.top = clamped.top
    mtState.scale = imgScale.value
  } else {
    // 以两指为坐标点 做直角三角形 a2 + b2 = c2
    const width = Math.abs(event.touches[1].clientX - event.touches[0].clientX)
    const height = Math.abs(event.touches[1].clientY - event.touches[0].clientY)
    const hypotenuse = Math.sqrt(Math.pow(width, 2) + Math.pow(height, 2))
    if (!(Number(fingerDistance.value) > 0)) return
    const scale = imgScale.value * (hypotenuse / Number(fingerDistance.value))
    const nextScale = clampImgScale(Math.min(scale, props.maxScale), picWidth.value, picHeight.value, imgAngle.value, currentCut())
    const clamped = clampImgPos(imgLeft.value, imgTop.value, nextScale, imgScale.value, picWidth.value, picHeight.value, imgAngle.value, currentCut())
    mtState.left = clamped.left
    mtState.top = clamped.top
    mtState.scale = nextScale
  }
}

/**
 * 处理图片触摸结束事件（图片后台绑定）：落定——把累积态写入响应式 ref
 * （一次重渲染，Vue 接管的 imageStyle 与 worklet 直改值一致，无跳变）。
 */
function handleImgTouchEnd() {
  if (!moving.value || !props.modelValue) return
  moving.value = false
  imgLeft.value = mtState.left
  imgTop.value = mtState.top
  imgScale.value = mtState.scale
}

/**
 * 处理图片加载完成事件
 * @param {any} res 图片加载结果
 */
function handleImgLoaded(res: any) {
  const source = res?.detail?.src ?? res?.src
  if (!isAlive() || !props.modelValue || !props.imgSrc || (source && source !== props.imgSrc)) return
  emit('imgloaded', res)
  // 原生 image load 事件的 detail.width / detail.height 就是图片原始像素，
  // 直接作为唯一的尺寸来源（不再调用宿主 getImageInfo）。
  if (!imgInfo.value) {
    const width = Number(res?.detail?.width ?? res?.width ?? 0)
    const height = Number(res?.detail?.height ?? res?.height ?? 0)
    if (width > 0 && height > 0) {
      imgInfo.value = { width, height }
      resetImg()
      computeImgSize()
    } else {
      emit('imgloaderror', { src: props.imgSrc, errMsg: 'image:fail invalid image dimensions' })
    }
  }
}

/**
 * 处理图片加载失败事件
 * @param {any} err 错误信息
 */
function handleImgLoadError(err: any) {
  const source = err?.detail?.src ?? err?.src
  if (!isAlive() || !props.modelValue || (source && source !== props.imgSrc)) return
  // 对外载荷保持 wot-ui 的 `{ src, errMsg }` 契约：原生 image 的 error 事件
  // 把宿主错误信息放在 detail 里，这里归一化后再抛给消费方。
  const detail = err?.detail ?? err ?? {}
  emit('imgloaderror', { ...detail, src: props.imgSrc, errMsg: String(detail.errMsg ?? 'image:fail') })
}

/**
 * 处理旋转按钮点击，逆时针旋转 90 度
 */
function handleRotate() {
  setRotate(imgAngle.value - 90)
}

/**
 * 处理取消按钮点击
 */
function handleCancel() {
  exportRequest++
  exporting.value = false
  moving.value = false
  imageVersion.value++
  emit('cancel')
  emit('update:modelValue', false)
}

/**
 * 处理确认按钮点击，触发图片裁剪和导出流程
 */
function handleConfirm() {
  draw()
}

/** XML 属性值转义（SVG data URI 内嵌 imgSrc，防止引号 / 尖括号破坏标记） */
function escapeXmlAttr(value: string): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/** SVG 数值取整到 4 位小数：规避浮点残差（如 358.7 - 175 - 183.7 = 1.1e-13） */
function svgNumber(value: number): string {
  return String(Math.round(value * 10000) / 10000)
}

/**
 * 无宿主 Canvas 2D 能力时的矢量降级导出（wd-signature 同款思路）：
 * 用 SVG 承载裁剪窗口内的图像几何——视口即裁剪框（导出像素 = 裁剪框 ×
 * exportScale），图片按当前位移 / 缩放 / 旋转绘入，超出视口的内容由 SVG
 * 视口裁剪（等价于 canvas 路径的 clearRect + 区域 drawImage）。
 */
function buildExportSvg(result: { width: number; height: number }): string {
  const scale = props.exportScale
  const width = Math.round(result.width)
  const height = Math.round(result.height)
  const x = (imgLeft.value - picWidth.value / 2 - cutLeft.value) * scale
  const y = (imgTop.value - picHeight.value / 2 - cutTop.value) * scale
  const drawWidth = picWidth.value * imgScale.value * scale
  const drawHeight = picHeight.value * imgScale.value * scale
  const centerX = (imgLeft.value - cutLeft.value) * scale
  const centerY = (imgTop.value - cutTop.value) * scale
  const angle = props.disabledRotate ? 0 : imgAngle.value
  const rotate = angle ? ` transform="rotate(${svgNumber(angle)} ${svgNumber(centerX)} ${svgNumber(centerY)})"` : ''
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><image xlink:href="${escapeXmlAttr(props.imgSrc)}" x="${svgNumber(x)}" y="${svgNumber(y)}" width="${svgNumber(drawWidth)}" height="${svgNumber(drawHeight)}" preserveAspectRatio="none"${rotate}/></svg>`
}

/** Raster export uses only real registered host canvas capabilities, never a fake empty path. */
function draw() {
  if (!isAlive() || !props.modelValue || !props.imgSrc || exporting.value) return
  const src = props.imgSrc
  if (picWidth.value <= 0 || picHeight.value <= 0 || cutWidth.value <= 0 || cutHeight.value <= 0) {
    emit('imgloaderror', { src, errMsg: 'img-cropper:fail image geometry is not ready' })
    return
  }
  const request = ++exportRequest
  exporting.value = true
  const exportScale = props.exportScale
  const result = {
    tempFilePath: '', width: cutWidth.value * exportScale, height: cutHeight.value * exportScale, src,
    x: Math.round((imgLeft.value - cutLeft.value - picWidth.value * imgScale.value / 2) / imgScale.value),
    y: Math.round((imgTop.value - cutTop.value - picHeight.value * imgScale.value / 2) / imgScale.value),
    scale: imgScale.value, angle: imgAngle.value
  }
  const valid = () => isAlive() && request === exportRequest && props.modelValue && props.imgSrc === src
  const fail = (error: any) => {
    if (!valid()) return
    exporting.value = false
    emit('imgloaderror', { ...error, src })
  }
  // 无宿主 Canvas 2D：矢量降级导出并照常确认（SVG data URI）。不伪造位图，
  // 也不再把「缺宿主能力」当成静默失败——否则消费方（如 demo）点完成看不到
  // 任何效果。宿主注册能力后仍走下方真实位图导出。
  if (!getPlatform().capabilities.canvas2d) {
    exporting.value = false
    emit('confirm', { ...result, tempFilePath: 'data:image/svg+xml;utf8,' + encodeURIComponent(buildExportSvg(result)) })
    if (valid()) emit('update:modelValue', false)
    return
  }
  try {
    const ctx = createCanvasContext(canvasId.value, proxy)
    ctx.save?.()
    ctx.clearRect?.(0, 0, result.width, result.height)
    ctx.translate((imgLeft.value - cutLeft.value) * exportScale, (imgTop.value - cutTop.value) * exportScale)
    if (!props.disabledRotate) ctx.rotate(imgAngle.value * Math.PI / 180)
    const width = picWidth.value * imgScale.value * exportScale
    const height = picHeight.value * imgScale.value * exportScale
    ctx.drawImage(src, -width / 2, -height / 2, width, height)
    ctx.restore?.()
    const exportImage = () => {
      if (!valid()) return
      canvasToTempFilePath({
        canvasId: canvasId.value, width: result.width, height: Math.round(result.height),
        destWidth: result.width, destHeight: Math.round(result.height), fileType: props.fileType, quality: props.quality,
        success: (res: any) => {
          if (!valid()) return
          const tempFilePath = res.tempFilePath || res.filePath
          if (!tempFilePath) { fail({ errMsg: 'canvasToTempFilePath:fail empty file path' }); return }
          exporting.value = false
          emit('confirm', { ...result, tempFilePath })
          if (valid()) emit('update:modelValue', false)
        },
        fail
      }, proxy)
    }
    if (typeof ctx.draw === 'function') ctx.draw(false, exportImage)
    else exportImage()
  } catch (error: any) {
    fail({ errMsg: error?.message || String(error) })
  }
}

/**
 * 阻止裁剪区域外的页面滚动
 * 仅在裁剪框内触摸移动时禁用页面滚动
 */
function preventTouchMove(event: any) {
  // Lynx：模板层 @touchmove.stop 承担阻止滚动；按 CONVENTIONS §14 转发
  // 同名原生事件，避免消费方监听穿透后与根绑定合并成数组。
  emit('touchmove', event)
}

onBeforeUnmount(() => {
  exportRequest++
  // 清理延时动画与节流定时器，避免回调在卸载后写入已销毁的树
  if (timers.animation !== null) {
    clearTimeout(timers.animation)
    timers.animation = null
  }
  if (timers.throttle !== null) {
    clearTimeout(timers.throttle)
    timers.throttle = null
  }
})

defineExpose<ImgCropperExpose>({
  revertIsAnimation,
  resetImg,
  setRotate
})

// ---------- 主线程 worklet（跟手，零线程跨越） ----------

/**
 * 主线程元素桩类型（worklet 内经 .current 取用）。
 * 与 @lynx-js/types 的 MainThread.Element 对齐的常用子集。
 */
interface MtElement {
  setStyleProperty(name: string, value: string): void
  getAttribute(name: string): string | null
  invoke(method: string, params?: any): Promise<any>
}

/** 图片元素：worklet 跟手直改 transform */
const imgRef = useMainThreadRef<MtElement | null>(null)
/**
 * 手势起点快照（worklet 内 .current 活值）：起笔时经图片元素属性一次性
 * 读取并缓存（属性桥接，见文件头说明）。
 */
const gestureRef = useMainThreadRef<{
  centerX: number
  centerY: number
  grabX: number
  grabY: number
  startDist: number
  startScale: number
  picW: number
  picH: number
  angle: number
  cutLeft: number
  cutTop: number
  cutW: number
  cutH: number
  version: string | null
} | null>(null)

/**
 * 起笔（主线程）：经图片元素属性一次性读取几何并登记手势起点。
 *
 * 绑在图片元素上：图片的 touchstart 无后台绑定（后台起点记录在包裹器
 * __wrapper 上，经冒泡触发），同名事件不冲突；几何为后台计算态
 * （中心 / 显示尺寸 / 缩放 / 角度 / 裁剪框），属性桥接比 invoke 更
 * 直接且起笔无异步窗口（slider 的 left-bound / right-bound 同款）。
 */
const onGestureStartMt = (event: any) => {
  'main thread'
  const img = imgRef.current
  if (!img || img.getAttribute('gesture-active') !== 'true') return
  const touches = event.touches
  if (!touches || !touches.length) return

  const num = (name: string, fallback: number) => {
    const raw = img.getAttribute(name)
    const val = Number(raw)
    return raw === null || isNaN(val) ? fallback : val
  }

  const picW = num('pic-w', 0)
  const picH = num('pic-h', 0)
  if (picW <= 0 || picH <= 0) return
  const centerX = num('center-x', 0)
  const centerY = num('center-y', 0)
  const startScale = num('img-scale', 1)
  const angle = num('img-angle', 0)

  let startDist = 0
  if (touches.length >= 2) {
    // 以两指为坐标点 做直角三角形 a2 + b2 = c2
    const width = Math.abs(touches[1].clientX - touches[0].clientX)
    const height = Math.abs(touches[1].clientY - touches[0].clientY)
    startDist = Math.sqrt(Math.pow(width, 2) + Math.pow(height, 2))
  }

  gestureRef.current = {
    centerX,
    centerY,
    grabX: touches[0].clientX - centerX,
    grabY: touches[0].clientY - centerY,
    startDist,
    startScale,
    picW,
    picH,
    angle,
    cutLeft: num('cut-left', 0),
    cutTop: num('cut-top', 0),
    cutW: num('cut-w', 0),
    cutH: num('cut-h', 0),
    version: img.getAttribute('gesture-version')
  }
}

/**
 * 跟手（主线程）：单指拖动 / 双指缩放 → transform 直改图片节点。
 *
 * 与后台 handleImgTouchMove 同一套公式（含 wot-ui 边界钳制，左/右边界
 * 的 else 分支沿用旧缩放值的行为逐行保留）；几何为起笔时缓存的快照。
 */
const onGestureMoveMt = (event: any) => {
  'main thread'
  const g = gestureRef.current
  const img = imgRef.current
  if (!g || !img || img.getAttribute('gesture-active') !== 'true' || g.version !== img.getAttribute('gesture-version')) return
  const touches = event.touches
  if (!touches || !touches.length) return
  // 双指但 startDist 未采样（第二指落在非图片区域，touchstart 未记录起距）
  // 时直接退出：否则 hypotenuse（像素距离）会当除数把 scale 钳到 maxScale，
  // 图片瞬间爆大、松手又被后台落定跳回（与后台 handleImgTouchMove 的
  // fingerDistance > 0 守卫对称）。
  if (touches.length > 1 && !(Number(g.startDist) > 0)) return

  let left = 0
  let top = 0
  let scale = g.startScale

  if (touches.length === 1) {
    // 单指拖动
    left = touches[0].clientX - g.grabX
    top = touches[0].clientY - g.grabY
    // 边界钳制（clampImgPos 等价内联）
    let curW = g.picW
    let curH = g.picH
    if ((g.angle / 90) % 2) {
      curW = g.picH
      curH = g.picW
    }
    left = (curW * scale) / 2 + g.cutLeft >= left ? left : (curW * scale) / 2 + g.cutLeft
    left = g.cutLeft + g.cutW - (curW * scale) / 2 <= left ? left : g.cutLeft + g.cutW - (curW * scale) / 2
    top = (curH * scale) / 2 + g.cutTop >= top ? top : (curH * scale) / 2 + g.cutTop
    top = g.cutTop + g.cutH - (curH * scale) / 2 <= top ? top : g.cutTop + g.cutH - (curH * scale) / 2
  } else {
    // 以两指为坐标点 做直角三角形 a2 + b2 = c2
    const width = Math.abs(touches[1].clientX - touches[0].clientX)
    const height = Math.abs(touches[1].clientY - touches[0].clientY)
    const hypotenuse = Math.sqrt(Math.pow(width, 2) + Math.pow(height, 2))
    let nextScale = g.startScale * (hypotenuse / (g.startDist || 1))
    const maxScale = Number(img.getAttribute('max-scale')) || 3
    if (nextScale > maxScale) nextScale = maxScale
    // 缩放下限校正（clampImgScale 等价内联）
    let limW = g.picW
    let limH = g.picH
    if ((g.angle / 90) % 2) {
      limW = g.picH
      limH = g.picW
    }
    if (limW * nextScale < g.cutW) nextScale = g.cutW / limW
    if (limH * nextScale < g.cutH) nextScale = g.cutH / limH
    scale = nextScale
    // 双指缩放不改变中心：以起笔中心为基准，按新缩放钳制位置
    // （与后台 handleImgTouchMove 的双指分支一致）
    left = g.centerX
    top = g.centerY
    let curW = g.picW
    let curH = g.picH
    if ((g.angle / 90) % 2) {
      curW = g.picH
      curH = g.picW
    }
    // 左/右边界 else 分支沿用旧缩放值 startScale（wot-ui 既有行为，逐行保留）
    left = (curW * scale) / 2 + g.cutLeft >= left ? left : (curW * g.startScale) / 2 + g.cutLeft
    left = g.cutLeft + g.cutW - (curW * scale) / 2 <= left ? left : g.cutLeft + g.cutW - (curW * scale) / 2
    top = (curH * scale) / 2 + g.cutTop >= top ? top : (curH * scale) / 2 + g.cutTop
    top = g.cutTop + g.cutH - (curH * scale) / 2 <= top ? top : g.cutTop + g.cutH - (curH * scale) / 2
  }

  img.setStyleProperty(
    'transform',
    `translate(${left - g.picW / 2}px, ${top - g.picH / 2}px) scale(${scale}) rotate(${g.angle}deg)`
  )
}
const onGestureEndMt = () => {
  'main thread'
  gestureRef.current = null
}
</script>

<template>
  <view v-if="modelValue" :class="['wd-img-cropper', customClass]" :style="rootStyle" @touchmove.stop="preventTouchMove">
    <view class="wd-img-cropper__wrapper" @touchstart="handleImgTouchStart" @touchmove="handleImgTouchMove" @touchend="handleImgTouchEnd" @touchcancel="handleImgTouchEnd">
      <!-- 展示在用户面前的裁剪框 -->
      <view class="wd-img-cropper__cut">
        <!-- 上方阴影块 -->
        <view :class="['wd-img-cropper__overlay', { 'is-highlight': moving }]" :style="{ height: `${cutTop}px` }"></view>
        <view class="wd-img-cropper__cut-middle" :style="{ height: `${cutHeight}px` }">
          <!-- 左侧阴影块 -->
          <view :class="['wd-img-cropper__overlay', { 'is-highlight': moving }]" :style="{ width: `${cutLeft}px`, height: `${cutHeight}px` }"></view>
          <!-- 裁剪框 -->
          <view class="wd-img-cropper__cut-body" :style="{ width: `${cutWidth}px`, height: `${cutHeight}px` }">
            <!-- 内部网格线 -->
            <view class="wd-img-cropper__gridline wd-img-cropper__gridline--x"></view>
            <view class="wd-img-cropper__gridline wd-img-cropper__gridline--y"></view>
            <!-- 裁剪窗体四个对角 -->
            <view class="wd-img-cropper__corner wd-img-cropper__corner--left-top"></view>
            <view class="wd-img-cropper__corner wd-img-cropper__corner--left-bottom"></view>
            <view class="wd-img-cropper__corner wd-img-cropper__corner--right-top"></view>
            <view class="wd-img-cropper__corner wd-img-cropper__corner--right-bottom"></view>
          </view>
          <!-- 右侧阴影块 -->
          <view :class="['wd-img-cropper__overlay', 'wd-img-cropper__overlay-right', { 'is-highlight': moving }]"></view>
        </view>

        <!-- 底部阴影块 -->
        <view :class="['wd-img-cropper__overlay', 'wd-img-cropper__overlay-bottom', { 'is-highlight': moving }]"></view>
      </view>
      <!-- 展示的传过来的图片: 控制图片的旋转角度(rotate)、缩放程度(imgScale)、移动位置(translate)。
           纯展示节点（__img 已 pointer-events: none，不承接触摸）：主线程 worklet 经
           main-thread-ref 直改其 transform；几何（中心 / 显示尺寸 / 缩放 / 角度 /
           裁剪框）经元素属性桥接下发给主线程，触摸由下方 __gesture 手势面承接。 -->
      <image
        class="wd-img-cropper__img"
        :key="imgSrc"
        :src="imgSrc"
        :gesture-active="String(modelValue && !!imgSrc)"
        :gesture-version="String(imageVersion)"
        :max-scale="String(maxScale)"
        :style="imageStyle"
        :lazy-load="false"
        :main-thread-ref="imgRef"
        :center-x="String(imgLeft)"
        :center-y="String(imgTop)"
        :pic-w="String(picWidth)"
        :pic-h="String(picHeight)"
        :img-scale="String(imgScale)"
        :img-angle="String(imgAngle)"
        :cut-left="String(cutLeft)"
        :cut-top="String(cutTop)"
        :cut-w="String(cutWidth)"
        :cut-h="String(cutHeight)"
        @error="handleImgLoadError"
        @load="handleImgLoaded"
      />
      <!-- 手势面（覆盖包裹器的独立 view 层）：主线程 worklet 绑本层（起笔登记 +
           跟手直改 + 清手势起点），后台 touchstart / touchmove / touchend 绑
           __wrapper（真机上由本层触摸冒泡触发）。官方 image 元素只定义 load / error
           事件，且与 __cut 的 z-index 层序在真机上可能与绘制不一致，触摸命中不
           依赖图片节点（CONVENTIONS §19 附注）；worklet 仍经 imgRef 寻址图片。 -->
      <view
        class="wd-img-cropper__gesture"
        :main-thread-bindtouchstart="onGestureStartMt"
        :main-thread-bindtouchmove="onGestureMoveMt"
        :main-thread-bindtouchend="onGestureEndMt"
        :main-thread-bindtouchcancel="onGestureEndMt"
      ></view>
    </view>
    <!-- 离屏导出缓冲（Lynx 无 canvas，同结构 view 占位，见文件头说明） -->
    <view :id="canvasId" class="wd-img-cropper__canvas" :style="canvasStyle"></view>
    <!-- 下方按钮 -->
    <view class="wd-img-cropper__footer">
      <WdIcon custom-class="wd-img-cropper__rotate" v-if="!disabledRotate" name="refresh" @tap="handleRotate"></WdIcon>
      <view class="wd-img-cropper__footer-btn">
        <WdButton custom-class="wd-img-cropper__cancel" size="large" type="info" variant="text" @tap="handleCancel">
          <text>{{ cancelButtonText || translate('cancel') }}</text>
        </WdButton>

        <WdButton size="large" @tap="handleConfirm"><text>{{ confirmButtonText || translate('confirm') }}</text></WdButton>
      </view>
    </view>
  </view>
</template>
