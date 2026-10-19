/*
 * wd-img-cropper — 图片裁剪
 *
 * Lynx 实现说明（相对 wot-ui 2.3.2 的适配点）：
 * - Lynx 无 canvas 2D API（CONVENTIONS §12 降级）：离屏导出缓冲 canvas
 *   以同结构 view 占位（同名 class / 内联尺寸，见 index.scss 的 __canvas），
 *   确认时不产出位图，而是 emit 裁剪几何参数（src / x / y / scale / angle），
 *   由宿主用原生能力完成最终裁剪；width / height 仍按 wot-ui 语义给出导出
 *   像素尺寸（裁剪框 × exportScale），tempFilePath 恒为空串；
 * - fileType / quality 为 canvas 导出专有 props，保留声明不生效；
 * - 参考源离屏 canvas 的 top: -200% 依赖 Web 视口单位；Lynx 的 100vw/100vh
 *   支持不确定，根节点与 __cut 改用地基约定的 left/right/top/bottom: 0
 *   全屏贴边（CONVENTIONS §9），根节点显式 display: flex + column、
 *   __wrapper flex-grow: 1 撑满剩余高度（Lynx 默认 linear 布局，
 *   CONVENTIONS §15）；
 * - 内联样式一律对象语法（字符串 style 会被 vue-lynx 静默丢弃，
 *   CONVENTIONS §19）；imageStyle 的 width/height 恒写（auto 为中性值）、
 *   transition-duration 恒写（0ms 为中性值），满足 Style Funnel（§20）；
 * - 图片原始尺寸：优先 uni.getImageInfo（宿主可经 configureUniAdapter
 *   注入）；宿主未注入时降级读 image 元素 load 事件 detail 的宽高，
 *   不再视为加载失败；
 * - @click → @tap（CONVENTIONS §6）；根 view 的 @touchmove 按 §14 声明为
 *   emit 并转发，避免消费方同名监听穿透合并崩溃；
 * - customStyle 经 parseStyle 归一为对象；动画 / 节流定时器在卸载时清理，
 *   避免回调写入已销毁树（真机 9902 家族）。
 */
<script lang="ts" setup>
import './index.css'

import { computed, onBeforeUnmount, ref, watch } from 'vue-lynx'
import WdButton from '../wd-button/wd-button.vue'
import WdIcon from '../wd-icon/wd-icon.vue'
import { imgCropperProps, type ImgCropperEmits, type ImgCropperExpose } from './types'
import { useTranslate } from '../../composables/useTranslate'
import { uni, hasUniAdapter } from '../../common/uni'
import { addUnit, getSystemInfo, uuid, parseStyle } from '../../common/util'

/** 顶部裁剪框占比 */
const TOP_PERCENT = 0.85
/** 动画过渡时长（毫秒） */
const ANIMATION_DURATION = 300
/** 节流频率（毫秒） */
const THROTTLE_INTERVAL = 1000 / 40

const canvasId = ref<string>(`cropper${uuid()}`) // 缓冲节点的唯一标识符（Lynx 无 canvas，占位 view 用）

// 延时动画设置
let animationTimer: any | null = null
// 移动节流定时器
let moveThrottleTimer: any | null = null
// 节流标志
let isThrottleActive: boolean = true
// 记录初始图片宽度
let initImgWidth: null | number | string = null
// 记录初始图片高度
let initImgHeight: null | number | string = null

const props = defineProps(imgCropperProps)
const emit = defineEmits<ImgCropperEmits>()

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

watch(
  () => props.modelValue,
  (newValue) => {
    if (newValue) {
      initImgWidth = props.imgWidth
      initImgHeight = props.imgHeight
      info.value = getSystemInfo()

      // 根据aspectRatio计算裁剪框尺寸
      const [widthRatio, heightRatio] = props.aspectRatio.split(':').map(Number)
      const tempCutWidth = info.value.windowWidth - offset.value * 2
      const tempCutHeight = (tempCutWidth * heightRatio) / widthRatio

      cutWidth.value = tempCutWidth
      cutHeight.value = tempCutHeight
      cutTop.value = (info.value.windowHeight * TOP_PERCENT - tempCutHeight) / 2
      cutLeft.value = offset.value

      canvasScale.value = props.exportScale
      canvasHeight.value = tempCutHeight
      canvasWidth.value = tempCutWidth
      // 根据开发者设置的图片目标尺寸计算实际尺寸
      initImageSize()
      // 加载图片
      props.imgSrc && loadImg()
    } else {
      resetImg()
    }
  },
  {
    deep: true,
    immediate: true
  }
)

watch(
  () => props.imgSrc,
  (newValue) => {
    newValue && loadImg()
  },
  {
    deep: true,
    immediate: true
  }
)

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
    animationTimer && clearTimeout(animationTimer)
    if (newValue) {
      animationTimer = setTimeout(() => {
        revertIsAnimation(false)
        clearTimeout(animationTimer)
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
  if (!angle || props.disabledRotate) return
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
  imgScale.value = 1
  imgAngle.value = 0
  imgLeft.value = windowWidth / 2
  imgTop.value = (windowHeight / 2) * TOP_PERCENT
}

/**
 * 加载图片资源文件，获取图片基本信息
 */
function loadImg() {
  if (!props.imgSrc) return

  uni.getImageInfo({
    src: props.imgSrc,
    success: (res: any) => {
      imgInfo.value = res
      computeImgSize()
      resetImg()
    },
    fail: () => {
      // Lynx 降级：宿主未注入 getImageInfo 时（uni 适配层默认 fail），
      // 图片尺寸改由 image 元素的 load 事件兜底（handleImgLoaded），
      // 此处不视为加载失败；宿主注入了实现而真正失败时才上报。
      if (hasUniAdapter('getImageInfo')) {
        emit('imgloaderror', { src: props.imgSrc })
      }
    }
  })
}

/**
 * 计算图片尺寸以填满裁剪框
 */
function computeImgSize() {
  let tempPicWidth: number = picWidth.value
  let tempPicHeight: number = picHeight.value

  if (!initImgHeight && !initImgWidth) {
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
  } else if (initImgHeight && !initImgWidth) {
    tempPicHeight = Number(initImgHeight)
    tempPicWidth = (imgInfo.value!.width / imgInfo.value!.height) * tempPicHeight
  } else if ((!initImgHeight && initImgWidth) || (initImgHeight && initImgWidth)) {
    tempPicWidth = Number(initImgWidth)
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
  if (initImgWidth && typeof initImgWidth === 'string' && initImgWidth.indexOf('%') !== -1) {
    const width: string = initImgWidth.replace('%', '')
    initImgWidth = (info.value.windowWidth / 100) * Number(width)
    picWidth.value = initImgWidth as number
  } else if (initImgWidth && typeof initImgWidth === 'number') {
    picWidth.value = initImgWidth
  }
  // 处理高度：支持百分比和像素值
  if (initImgHeight && typeof initImgHeight === 'string' && initImgHeight.indexOf('%') !== -1) {
    const height = (props.imgHeight as string).replace('%', '')
    initImgHeight = (info.value.windowHeight / 100) * Number(height)
    picHeight.value = initImgHeight as number
  } else if (initImgHeight && typeof initImgHeight === 'number') {
    picHeight.value = Number(initImgHeight)
  }
}

/**
 * 检测图片位置是否已到达裁剪框边缘
 * @param {number} [scale] 缩放比例，默认使用当前 imgScale.value
 */
function detectImgPosIsEdge(scale?: number) {
  const currentScale = scale || imgScale.value
  let currentImgLeft = imgLeft.value
  let currentImgTop = imgTop.value
  let currentPicWidth = picWidth.value
  let currentPicHeight = picHeight.value

  // 翻转后宽高切换
  if ((imgAngle.value / 90) % 2) {
    currentPicWidth = picHeight.value
    currentPicHeight = picWidth.value
  }
  // 左
  currentImgLeft =
    (currentPicWidth * currentScale) / 2 + cutLeft.value >= currentImgLeft ? currentImgLeft : (currentPicWidth * imgScale.value) / 2 + cutLeft.value
  // 右
  currentImgLeft =
    cutLeft.value + cutWidth.value - (currentPicWidth * currentScale) / 2 <= currentImgLeft
      ? currentImgLeft
      : cutLeft.value + cutWidth.value - (currentPicWidth * currentScale) / 2
  // 上
  currentImgTop =
    (currentPicHeight * currentScale) / 2 + cutTop.value >= currentImgTop ? currentImgTop : (currentPicHeight * currentScale) / 2 + cutTop.value
  // 下
  currentImgTop =
    cutTop.value + cutHeight.value - (currentPicHeight * currentScale) / 2 <= currentImgTop
      ? currentImgTop
      : cutTop.value + cutHeight.value - (currentPicHeight * currentScale) / 2

  imgScale.value = currentScale
  imgTop.value = currentImgTop
  imgLeft.value = currentImgLeft
}

/**
 * 检测并校正图片缩放，防止缩放后露出背景
 */
function detectImgScaleIsEdge() {
  let tempPicWidth = picWidth.value
  let tempPicHeight = picHeight.value
  let tempImgScale = imgScale.value

  // 翻转后宽高切换
  if ((imgAngle.value / 90) % 2) {
    tempPicWidth = picHeight.value
    tempPicHeight = picWidth.value
  }
  if (tempPicWidth * tempImgScale < cutWidth.value) {
    tempImgScale = cutWidth.value / tempPicWidth
  }
  if (tempPicHeight * tempImgScale < cutHeight.value) {
    tempImgScale = cutHeight.value / tempPicHeight
  }
  detectImgPosIsEdge(tempImgScale)
}

/**
 * 节流处理，用于优化移动事件的处理频率
 */
function throttle() {
  if (info.value.platform === 'android') {
    moveThrottleTimer && clearTimeout(moveThrottleTimer)
    moveThrottleTimer = setTimeout(() => {
      isThrottleActive = true
    }, THROTTLE_INTERVAL)
  } else {
    !isThrottleActive && (isThrottleActive = true)
  }
}

/**
 * 处理图片触摸开始事件，支持单指拖动和双指缩放
 * @param {TouchEvent} event 触摸事件
 */
function handleImgTouchStart(event: any) {
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
}

/**
 * 处理图片触摸移动事件，实现单指拖动和双指缩放功能
 * @param {TouchEvent} event 触摸事件
 */
function handleImgTouchMove(event: any) {
  if (event.touches.length === 1) {
    // 单指拖动
    const { x, y } = movingPosRecord.value[0]
    const left = event.touches[0].clientX - Number(x)
    const top = event.touches[0].clientY - Number(y)
    imgLeft.value = left
    imgTop.value = top
    detectImgPosIsEdge()
  } else {
    // 以两指为坐标点 做直角三角形 a2 + b2 = c2
    const width = Math.abs(event.touches[1].clientX - event.touches[0].clientX)
    const height = Math.abs(event.touches[1].clientY - event.touches[0].clientY)
    const hypotenuse = Math.sqrt(Math.pow(width, 2) + Math.pow(height, 2))
    const scale = imgScale.value * (hypotenuse / Number(fingerDistance.value))
    imgScale.value = Math.min(scale, props.maxScale)
    detectImgScaleIsEdge()
    fingerDistance.value = Math.sqrt(Math.pow(width, 2) + Math.pow(height, 2))
  }
}

/**
 * 处理图片触摸结束事件
 */
function handleImgTouchEnd() {
  moving.value = false
}

/**
 * 处理图片加载完成事件
 * @param {any} res 图片加载结果
 */
function handleImgLoaded(res: any) {
  emit('imgloaded', res)
  // Lynx 降级路径：uni.getImageInfo 不可用（宿主未注入）时，用 image 元素
  // load 事件 detail 的宽高兜底计算图片尺寸
  if (!imgInfo.value) {
    const width = Number(res?.detail?.width ?? res?.width ?? 0)
    const height = Number(res?.detail?.height ?? res?.height ?? 0)
    if (width > 0 && height > 0) {
      imgInfo.value = { width, height }
      computeImgSize()
      resetImg()
    }
  }
}

/**
 * 处理图片加载失败事件
 * @param {any} err 错误信息
 */
function handleImgLoadError(err: any) {
  emit('imgloaderror', err)
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
  emit('cancel')
  emit('update:modelValue', false)
}

/**
 * 处理确认按钮点击，触发图片裁剪和导出流程
 */
function handleConfirm() {
  draw()
}

/**
 * 计算裁剪参数并触发 confirm（替代 wot-ui 的 canvas 绘制导出）
 *
 * wot-ui 流程：ctx.translate / rotate / drawImage 将裁剪区域绘入离屏
 * canvas，再 canvasToTempFilePath 产出临时文件。Lynx 无 canvas 2D，
 * 这里按同一几何关系换算裁剪框在图片自然像素坐标系中的位置与尺寸，
 * 连同导出尺寸（裁剪框 × exportScale）一并发给宿主，由宿主完成裁剪。
 */
function draw() {
  if (!props.imgSrc) return

  // 裁剪框左上角在图片元素坐标系中的位置（缩放以元素中心为原点）：
  // p_img = (p_cut - imgCenter) / imgScale
  const x = (imgLeft.value - cutLeft.value - (picWidth.value * imgScale.value) / 2) / imgScale.value
  const y = (imgTop.value - cutTop.value - (picHeight.value * imgScale.value) / 2) / imgScale.value

  emit('confirm', {
    tempFilePath: '',
    width: cutWidth.value * props.exportScale,
    height: Math.round(cutHeight.value * props.exportScale),
    src: props.imgSrc,
    x: Math.round(x),
    y: Math.round(y),
    scale: imgScale.value,
    angle: imgAngle.value
  })
  emit('update:modelValue', false)
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
  // 清理延时动画与节流定时器，避免回调在卸载后写入已销毁的树
  if (animationTimer !== null) {
    clearTimeout(animationTimer)
    animationTimer = null
  }
  if (moveThrottleTimer !== null) {
    clearTimeout(moveThrottleTimer)
    moveThrottleTimer = null
  }
})

defineExpose<ImgCropperExpose>({
  revertIsAnimation,
  resetImg,
  setRotate
})
</script>

<template>
  <view v-if="modelValue" :class="['wd-img-cropper', customClass]" :style="parseStyle(customStyle)" @touchmove.stop="preventTouchMove">
    <view class="wd-img-cropper__wrapper">
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
      <!-- 展示的传过来的图片: 控制图片的旋转角度(rotate)、缩放程度(imgScale)、移动位置(translate) -->
      <image
        class="wd-img-cropper__img"
        :src="imgSrc"
        :style="imageStyle"
        :lazy-load="false"
        @touchstart="handleImgTouchStart"
        @touchmove="handleImgTouchMove"
        @touchend="handleImgTouchEnd"
        @error="handleImgLoadError"
        @load="handleImgLoaded"
      />
    </view>
    <!-- 离屏导出缓冲（Lynx 无 canvas，同结构 view 占位，见文件头说明） -->
    <view :id="canvasId" class="wd-img-cropper__canvas" :style="canvasStyle"></view>
    <!-- 下方按钮 -->
    <view class="wd-img-cropper__footer">
      <WdIcon custom-class="wd-img-cropper__rotate" v-if="!disabledRotate" name="refresh" @tap="handleRotate"></WdIcon>
      <view class="wd-img-cropper__footer-btn">
        <WdButton custom-class="wd-img-cropper__cancel" size="large" type="info" variant="text" @tap="handleCancel">
          {{ cancelButtonText || translate('cancel') }}
        </WdButton>

        <WdButton size="large" @tap="handleConfirm">{{ confirmButtonText || translate('confirm') }}</WdButton>
      </view>
    </view>
  </view>
</template>
