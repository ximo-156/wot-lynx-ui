/*
 * wd-swiper — 轮播图
 *
 * Lynx 适配说明：
 * - 不依赖 LynxUI 扩展元素：swiper / swiper-item 并非 Lynx 引擎内置元素，其
 *   BehaviorController 由宿主 App 链接的 LynxUI 库注册。宿主缺失该注册时，
 *   引擎建树抛 "No BehaviorController defined for class swiper"
 *   （Lynx 错误码 9902 / sub 990200）致命异常，JS 侧无法捕获、整张卡片崩溃。
 *   因此本组件仅使用引擎内置元素（view / text / image）自研实现轮播：
 *   横/纵向滑动、循环播放（首尾克隆 + 瞬移归位）、自动播放、指示器、
 *   同时展示多项、前/后边距均与 wot-ui 行为对齐，任何 Lynx 宿主均可用。
 * - 手势运行在后台线程（Vue 响应式驱动轨道 transform），不使用 Main Thread
 *   Script（原因见 CONVENTIONS.md §9）：跟手阶段 transition:none，落位时
 *   按 duration / easingFunction 恢复过渡动画；循环克隆落位后瞬移归位。
 * - adjust-height / adjust-vertical-height 为支付宝小程序专有能力（依赖原生
 *   swiper 的高度自适应），Lynx 无对应实现：props 保留（API 兼容）但不再生效，
 *   容器高度由 height 属性决定。
 */
<template>
  <view
    :class="`wd-swiper ${customClass}`"
    :style="styleToObject(rootStyle)"
    @touchstart="onTouchStart"
    @touchmove="onTouchMove"
    @touchend="onTouchEnd"
    @touchcancel="onTouchEnd"
  >
    <!-- 轨道：flex 横向（纵向轮播时为 column），整体 translate 位移 -->
    <view :class="`wd-swiper__track ${direction === 'vertical' ? 'wd-swiper__track--vertical' : ''}`" :style="styleToObject(trackStyle)">
      <view
        v-for="cell in renderList"
        :key="cell.key"
        :class="swiperItemClass"
        :style="styleToObject(itemStyle)"
        @tap="handleItemTap(cell)"
      >
        <slot :item="cell.item" :index="cell.index">
          <video
            v-if="isVideo(cell.item)"
            :id="`video-${cell.index}-${uid}`"
            :style="{ height: addUnit(height) }"
            :src="isObj(cell.item) ? cell.item[valueKey] : cell.item"
            :poster="isObj(cell.item) ? cell.item.poster : ''"
            :class="`wd-swiper__video ${customImageClass} ${customItemClass} ${getCustomItemClass(currentValue, cell.index, list)}`"
            @play="handleVideoPaly"
            @pause="handleVideoPause"
            :enable-progress-gesture="false"
            :loop="videoLoop"
            :muted="muted"
            :autoplay="autoplayVideo"
            objectFit="cover"
          />
          <image
            v-else
            :src="isObj(cell.item) ? cell.item[valueKey] : cell.item"
            :class="`wd-swiper__image ${customImageClass} ${customItemClass} ${getCustomItemClass(currentValue, cell.index, list)}`"
            :style="{ height: addUnit(height) }"
            :mode="imageMode"
            :show-menu-by-longpress="showMenuByLongpress"
          />
          <text v-if="isObj(cell.item) && cell.item[textKey]" :class="`wd-swiper__text ${customTextClass}`" :style="styleToObject(customTextStyle)">
            <text>{{ cell.item[textKey] }}</text>
          </text>
        </slot>
      </view>
    </view>
    <template v-if="indicator">
      <slot name="indicator" :current="currentValue" :total="list.length"></slot>
      <WdSwiperNav
        v-if="!$slots.indicator"
        :custom-class="customIndicatorClass"
        :type="swiperIndicator.type"
        :current="swiperIndicator.current"
        :total="swiperIndicator.total"
        :direction="swiperIndicator.direction"
        :indicator-position="swiperIndicator.indicatorPosition"
        :min-show-num="swiperIndicator.minShowNum"
        :show-controls="swiperIndicator.showControls"
        @change="handleIndicatorChange"
      />
    </template>
  </view>
</template>
<script setup lang="ts">
import './index.css'
import { computed, getCurrentInstance, nextTick, onBeforeUnmount, onMounted, ref, useSlots, watch } from 'vue-lynx'
import WdSwiperNav from '../wd-swiper-nav/wd-swiper-nav.vue'
import { uni } from '../../common/uni'
import { addUnit, getRect, isDef, isImageUrl, isObj, isVideoUrl, objToStyle, styleToObject, type CSSProperties, uuid } from '../../common/util'
import { swiperProps, type SwiperItem } from './types'
import type { SwiperNavProps } from '../wd-swiper-nav/types'
import { useTouch } from '../../composables/useTouch'

const props = defineProps(swiperProps)
const emit = defineEmits(['click', 'change', 'animationfinish', 'update:current'])

const slots = useSlots()
const { proxy } = getCurrentInstance() as any

/** 当前滑块真实下标（指示器与 v-model 使用） */
const currentValue = ref<number>(props.current)
/** 视频播放中（stopAutoplayWhenVideoPlay 时暂停自动轮播） */
const videoPlaying = ref<boolean>(false)
const uid = ref<string>(uuid())

/** 容器宽 / 高（px）。宿主无 SelectorQuery 时度量失败保持 0，此时不做位移换算 */
const containerWidth = ref<number>(0)
const containerHeight = ref<number>(0)
/** 轨道当前位移（px，沿滑动方向） */
const offset = ref<number>(0)
/** 手指滑动中：关闭过渡实现跟手 */
const touching = ref<boolean>(false)
/** 瞬移中：循环克隆归位 / 初始就位时关闭过渡，避免反向划过整条轨道 */
const jumping = ref<boolean>(true)
/** 拖动超过阈值后忽略一次误点击 */
const ignoreTap = ref<boolean>(false)

const touch = useTouch()
let startOffset = 0
let startTime = 0
let settleTimer: ReturnType<typeof setTimeout> | undefined
let autoplayTimer: ReturnType<typeof setInterval> | undefined

/** 缓动动画类型 → CSS transition-timing-function */
const EASING_MAP: Record<string, string> = {
  default: 'ease',
  linear: 'linear',
  easeInCubic: 'cubic-bezier(0.55, 0.055, 0.675, 0.19)',
  easeOutCubic: 'cubic-bezier(0.215, 0.61, 0.355, 1)',
  easeInOutCubic: 'cubic-bezier(0.645, 0.045, 0.355, 1)'
}

const itemCount = computed(() => (props.list ? props.list.length : 0))
/** 循环生效条件：loop 且至少 2 项（首尾各追加一个克隆项） */
const hasLoop = computed(() => props.loop && itemCount.value > 1)

/** 渲染列表：循环时首部追加最后一项克隆、尾部追加第一项克隆 */
const renderList = computed(() => {
  const list = props.list || []
  if (!hasLoop.value) {
    return list.map((item, index) => ({ item, index, key: `item-${index}` }))
  }
  const n = list.length
  return [
    { item: list[n - 1], index: n - 1, key: 'clone-last' },
    ...list.map((item, index) => ({ item, index, key: `item-${index}` })),
    { item: list[0], index: 0, key: 'clone-first' }
  ]
})

/** 单项尺寸（横向为宽、纵向为高），按同时展示数量均分 */
const itemStyle = computed(() => {
  const size = `${100 / Math.max(1, props.displayMultipleItems)}%`
  return props.direction === 'vertical' ? `width: 100%; height: ${size};` : `width: ${size}; height: 100%;`
})

/** 轨道位移与过渡：瞬移/跟手时 transition:none，落位时按 duration + easing 过渡 */
const trackStyle = computed(() => {
  const transform = props.direction === 'vertical' ? `translate3d(0, ${offset.value}px, 0)` : `translate3d(${offset.value}px, 0, 0)`
  const transition = jumping.value ? 'none' : `transform ${Math.max(0, props.duration)}ms ${EASING_MAP[props.easingFunction] || 'ease'}`
  return `transform: ${transform}; -webkit-transform: ${transform}; transition: ${transition}; -webkit-transition: ${transition};`
})

/** 根容器样式：高度与圆角（原由原生 swiper 元素承载，现由根 view 承载） */
const rootStyle = computed(() => {
  const style: CSSProperties = {
    height: addUnit(props.height)
  }
  if (isDef(props.radius)) {
    style.borderRadius = addUnit(props.radius)
  }
  return props.customStyle ? `${objToStyle(style)};${props.customStyle}` : objToStyle(style)
})

const swiperItemClass = computed(() => `wd-swiper__item ${slots.default ? 'wd-swiper__item--slot' : ''}`)

const swiperIndicator = computed(() => {
  const { list, direction, indicatorPosition, indicator } = props
  const swiperIndicator: Partial<SwiperNavProps> = {
    current: currentValue.value || 0,
    total: list.length || 0,
    direction: direction || 'horizontal',
    indicatorPosition: indicatorPosition || 'bottom'
  }
  if (isObj(indicator)) {
    swiperIndicator.type = indicator.type || 'dots'
    swiperIndicator.minShowNum = indicator.minShowNum || 2
    swiperIndicator.showControls = indicator.showControls || false
  }
  return swiperIndicator
})

// ---------------------------------------------------------------------------
// 位移换算
// ---------------------------------------------------------------------------

/** 前/后边距（px）。纵向轮播无对应能力，按 0 处理 */
const prevMarginPx = computed(() => (props.direction === 'vertical' ? 0 : Math.max(0, parseFloat(String(props.previousMargin)) || 0)))
const nextMarginPx = computed(() => (props.direction === 'vertical' ? 0 : Math.max(0, parseFloat(String(props.nextMargin)) || 0)))

/** 单项尺寸（px）：(容器尺寸 - 前边距 - 后边距) / 同时展示数量；未度量时按 0 处理。
 *  纵向轮播按容器高度换算，横向按容器宽度换算 */
const itemSizePx = computed(() => {
  const size = props.direction === 'vertical' ? containerHeight.value : containerWidth.value
  if (!size) return 0
  const count = Math.max(1, props.displayMultipleItems)
  return Math.max(1, (size - prevMarginPx.value - nextMarginPx.value) / count)
})

/** 容器沿滑动方向的尺寸（px） */
const containerSizePx = computed(() => (props.direction === 'vertical' ? containerHeight.value : containerWidth.value))

/** 真实下标 → 轨道位置（循环时整体后移一位，前有尾克隆） */
function positionOf(realIndex: number) {
  return hasLoop.value ? realIndex + 1 : realIndex
}

/** 轨道位置 → 位移（px）。snap-to-edge 时首/末项贴边（非循环生效） */
function offsetOfPosition(pos: number) {
  const w = itemSizePx.value
  const n = itemCount.value
  if (!w || n === 0) return 0
  if (!hasLoop.value && props.snapToEdge) {
    if (pos <= 0) return 0
    if (pos >= n - 1) return Math.min(0, containerSizePx.value - n * w)
  }
  return prevMarginPx.value - pos * w
}

/** 可位移范围（含循环首尾克隆） */
function bounds() {
  const n = itemCount.value
  if (n === 0) return { min: 0, max: 0 }
  const first = offsetOfPosition(0)
  const last = offsetOfPosition(hasLoop.value ? n + 1 : n - 1)
  return { min: Math.min(first, last), max: Math.max(first, last) }
}

/** 与当前位移最接近的轨道位置（兼容 snap-to-edge 的非线性边界） */
function nearestPosition(value: number) {
  const n = itemCount.value
  const lastPos = hasLoop.value ? n + 1 : n - 1
  let best = 0
  let bestDist = Infinity
  for (let pos = 0; pos <= lastPos; pos++) {
    const dist = Math.abs(offsetOfPosition(pos) - value)
    if (dist < bestDist) {
      bestDist = dist
      best = pos
    }
  }
  return best
}

// ---------------------------------------------------------------------------
// 导航
// ---------------------------------------------------------------------------

/** 瞬移归位（无过渡动画），下一帧恢复过渡能力 */
function jumpTo(pos: number) {
  jumping.value = true
  offset.value = offsetOfPosition(pos)
  nextTick(() => {
    jumping.value = false
  })
}

/** 带动画结算到指定轨道位置；循环克隆落位后瞬移到对应真实项 */
function settle(pos: number, source: string) {
  clearTimeout(settleTimer)
  if (itemSizePx.value) {
    jumping.value = false
    offset.value = offsetOfPosition(pos)
  }
  settleTimer = setTimeout(() => {
    if (itemSizePx.value && hasLoop.value) {
      const n = itemCount.value
      if (pos === 0) jumpTo(n) // 尾克隆 → 真实最后一项
      else if (pos === n + 1) jumpTo(1) // 首克隆 → 真实第一项
    }
    emit('animationfinish', { current: currentValue.value, source })
  }, Math.max(0, props.duration))
}

/** 切换到指定真实下标（程序控制 / 自动播放 / 指示器） */
function navTo(realIndex: number, source = '') {
  const n = itemCount.value
  if (n === 0) return
  let idx = realIndex
  if (hasLoop.value) {
    idx = ((idx % n) + n) % n
  } else {
    idx = Math.min(Math.max(idx, 0), n - 1)
  }
  currentValue.value = idx
  emit('update:current', idx)
  if (source) {
    emit('change', { current: idx, source })
  }
  settle(positionOf(idx), source)
}

// ---------------------------------------------------------------------------
// 自动播放
// ---------------------------------------------------------------------------

function startAutoplay() {
  stopAutoplay()
  if (!props.autoplay || itemCount.value <= 1) return
  autoplayTimer = setInterval(() => {
    if (videoPlaying.value) return
    const n = itemCount.value
    // 非循环播放到最后一项即停止
    if (!hasLoop.value && currentValue.value >= n - 1) {
      stopAutoplay()
      return
    }
    navTo(currentValue.value + 1, 'autoplay')
  }, Math.max(200, props.interval))
}

function stopAutoplay() {
  if (autoplayTimer !== undefined) {
    clearInterval(autoplayTimer)
    autoplayTimer = undefined
  }
}

// ---------------------------------------------------------------------------
// 手势（后台线程响应式驱动 transform，见 CONVENTIONS.md §9）
// ---------------------------------------------------------------------------

function onTouchStart(event: any) {
  stopAutoplay()
  clearTimeout(settleTimer)
  if (itemCount.value <= 1) return
  // 挂载时的度量可能因节点未布局完成而失败（零矩形）：首次交互前补一次度量
  if (!itemSizePx.value) measure()
  touching.value = true
  ignoreTap.value = false
  touch.touchStart(event)
  startOffset = offset.value
  startTime = Date.now()
  // 打断进行中的结算动画，进入跟手
  jumping.value = true
}

function onTouchMove(event: any) {
  if (!touching.value || itemCount.value <= 1) return
  touch.touchMove(event)
  // 反向滑动（横向轮播的上下滑 / 纵向轮播的左右滑）交还页面滚动
  if (touch.direction.value && touch.direction.value !== props.direction) return
  if (event.preventDefault) event.preventDefault()
  if (event.stopPropagation) event.stopPropagation()
  const delta = props.direction === 'vertical' ? touch.deltaY.value : touch.deltaX.value
  if (Math.abs(delta) > 10) ignoreTap.value = true
  // 边界外阻尼（橡皮筋）
  const { min, max } = bounds()
  const raw = startOffset + delta
  offset.value = raw > max ? max + (raw - max) * 0.4 : raw < min ? min + (raw - min) * 0.4 : raw
}

function onTouchEnd() {
  if (!touching.value) return
  touching.value = false
  const n = itemCount.value
  if (n <= 1) {
    startAutoplay()
    return
  }
  let target = nearestPosition(offset.value)
  // 快速甩动（> 0.4px/ms）时多滑一格
  const elapsed = Date.now() - startTime
  const delta = props.direction === 'vertical' ? touch.deltaY.value : touch.deltaX.value
  if (elapsed > 0 && Math.abs(delta) / elapsed > 0.4) {
    target += delta < 0 ? 1 : -1
  }
  target = Math.min(Math.max(target, 0), hasLoop.value ? n + 1 : n - 1)

  let realIndex = target
  if (hasLoop.value) {
    if (target === 0) realIndex = n - 1 // 尾克隆
    else if (target === n + 1) realIndex = 0 // 首克隆
    else realIndex = target - 1
  }
  const changed = realIndex !== currentValue.value
  currentValue.value = realIndex
  emit('update:current', realIndex)
  if (changed) {
    emit('change', { current: realIndex, source: 'touch' })
  }
  settle(target, 'touch')
  startAutoplay()
}

// ---------------------------------------------------------------------------
// 内容
// ---------------------------------------------------------------------------

function handleItemTap(cell: { item: string | SwiperItem; index: number }) {
  if (ignoreTap.value) return
  emit('click', { index: cell.index, item: cell.item })
}

const getMediaType = (item: string | SwiperItem, type: 'video' | 'image') => {
  const checkType = (url: string) => (type === 'video' ? isVideoUrl(url) : isImageUrl(url))
  if (isObj(item)) {
    return item.type && ['video', 'image'].includes(item.type) ? item.type === type : checkType(item[props.valueKey])
  } else {
    return checkType(item)
  }
}

const isVideo = (item: string | SwiperItem) => getMediaType(item, 'video')

// 视频播放
function handleVideoPaly() {
  props.stopAutoplayWhenVideoPlay && (videoPlaying.value = true)
}

// 视频暂停
function handleVideoPause() {
  videoPlaying.value = false
}

/**
 * 是否为当前滑块的前一个滑块
 */
function isPrev(current: number, index: number, list: string[] | SwiperItem[]) {
  return (current - 1 + list.length) % list.length === index
}

/**
 * 是否为当前滑块的后一个滑块
 */
function isNext(current: number, index: number, list: string[] | SwiperItem[]) {
  return (current + 1 + list.length) % list.length === index
}

function getCustomItemClass(current: number, index: number, list: string[] | SwiperItem[]) {
  let customItemClass: string = ''
  if (isPrev(current, index, list)) {
    customItemClass = props.customPrevClass || props.customPrevImageClass
  }
  if (isNext(current, index, list)) {
    customItemClass = props.customNextClass || props.customNextImageClass
  }
  return customItemClass
}

/**
 * 指示器 / 控制器切换
 */
function handleIndicatorChange({ dir }: { dir: 'prev' | 'next' }) {
  const { list, loop } = props
  const total = list.length
  let nextPos = dir === 'next' ? currentValue.value + 1 : currentValue.value - 1
  if (loop) {
    nextPos = dir === 'next' ? (currentValue.value + 1) % total : (currentValue.value - 1 + total) % total
  } else {
    nextPos = nextPos < 0 || nextPos >= total ? currentValue.value : nextPos
  }
  if (nextPos === currentValue.value) return
  navTo(nextPos)
}

// ---------------------------------------------------------------------------
// 生命周期与外部同步
// ---------------------------------------------------------------------------

/** current 受控变化（v-model / 程序指定） */
watch(
  () => props.current,
  (val) => {
    const n = itemCount.value
    if (n === 0 || val === currentValue.value) return
    if (hasLoop.value) {
      if (val < 0) {
        navTo(n - 1)
      } else if (val >= n) {
        navTo(0)
      } else {
        navTo(val)
      }
    } else {
      navTo(val)
    }
  }
)

/** 列表引用变化：收敛当前下标并瞬移就位 */
watch(
  () => props.list,
  () => {
    const n = itemCount.value
    const idx = Math.min(Math.max(currentValue.value, 0), Math.max(0, n - 1))
    currentValue.value = idx
    if (itemSizePx.value) {
      jumpTo(positionOf(idx))
    }
    startAutoplay()
  }
)

/** 度量重试计数（真机上挂载后立即查询常因节点未布局完成返回零矩形） */
let measureRetries = 0

/** 容器尺寸度量：横向轮播取宽度、纵向取高度；失败时有限次重试 */
function measure() {
  getRect('.wd-swiper', false, proxy)
    .then((rect: any) => {
      const need = props.direction === 'vertical' ? rect && rect.height : rect && rect.width
      if (need) {
        measureRetries = 0
        containerWidth.value = rect.width || 0
        containerHeight.value = rect.height || 0
        jumpTo(positionOf(currentValue.value))
        return
      }
      if (measureRetries < 5) {
        measureRetries++
        setTimeout(measure, 100)
      }
    })
    .catch(() => 0)
}

onMounted(() => {
  // 容器尺寸一次性度量（不在 touchmove 中重复查询，见 CONVENTIONS.md §9）
  measure()
  startAutoplay()
})

onBeforeUnmount(() => {
  stopAutoplay()
  clearTimeout(settleTimer)
})
</script>
