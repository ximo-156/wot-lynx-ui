/*
 * wd-swiper — 轮播图
 *
 * Lynx 实现说明（相对 wot-ui 2.3.2 的适配点）：
 * - 分页容器：参考源使用 swiper / swiper-item 元素，该元素并非 Lynx 引擎内置，
 *   其 BehaviorController 由宿主链接的 LynxUI 注册，宿主缺失时真机抛
 *   "No BehaviorController defined for class swiper"（错误码 9902）致命异常且
 *   JS 侧无法捕获。故改用引擎内置 scroll-view + 内容轨道 transform 自研分页：
 *   scroll-view 承担参考源 swiper 元素的角色（类名 wd-swiper__track、高度与
 *   圆角经 swiperStyle 下发），内容轨道 wd-swiper__track-inner 为平台必需的
 *   额外包裹层（Lynx 的 scroll-view 不像 Web 那样自动把子节点排成滚动行），
 *   当前页经 scroll-left / scroll-top 定位，滚动结束吸附到最近页；
 * - **跟手走原生滚动（NATIVE-REWRITE §8「原生滚动」类别）**：手指滑动由
 *   scroll-view 在引擎主线程直接完成（原生惯性 + 吸附），即官方「原生交互
 *   性能」路径；指示器联动（scroll → current → dots）参照 wd-index-bar 的
 *   既定分工留在后台线程（Lynx 无 scroll 事件的 main-thread 绑定形态，
 *   强行自绘触摸轨道反而违背「滚动用 scroll-view」的原生元素优先铁律，
 *   CONVENTIONS §3.3）；
 * - current 双轨（对齐参考源）：currentValue 为逻辑当前项，navCurrent 为下发给
 *   scroll-view 的程序定位值——手势滚动时只更新 currentValue，不与用户的滚动
 *   位置互搏，scrollend 时再对齐 navCurrent（同时完成 imperfect 滚动吸附）；
 * - 循环：scroll-view 无 circular 能力，末页→首页（及反向）时禁用一帧滚动动画
 *   后瞬移回起点（wrapNoAnim），避免倒滑全部页面；
 * - 度量：容器宽高挂载后一次性 getRect 并缓存（CONVENTIONS §16：触摸热路径不
 *   重复 getRect），尺寸相关 props 变化时重新度量；选择器用根节点 id（同页多个
 *   轮播不撞节点）；
 * - adjust-height / adjust-vertical-height（支付宝小程序专有能力）与
 *   snap-to-edge、easing-function（swiper 元素专有布局/缓动语义）随之失效，
 *   props 保留声明不生效；
 * - 视频播放控制：uni.createVideoContext 在 Lynx 无对应能力，经本地
 *   common/uni 兼容层降级为空实现（不崩溃，仅告警一次）；
 * - 参考源模板中的 scroll-view 包裹层为 MP-WEIXIN 条件编译，已移除；
 * - @click → @tap；customStyle / customTextStyle 经 parseStyle 归一为对象语法
 *   （CONVENTIONS §19）；轨道 / 滑块 / 媒体三处内联样式键集合恒定（CONVENTIONS
 *   §20 Style Funnel）；swiperStyle 的 border-radius 沿用参考源的条件写入
 *   （radius 为静态 prop，且无条件写 0 会盖掉消费方对
 *   --wot-swiper-border-radius 的 CSS 覆盖）。
 */
<script lang="ts" setup>
import './index.css'

import { computed, onMounted, onUnmounted, ref, useSlots, watch } from 'vue-lynx'
import WdSwiperNav from '../wd-swiper-nav/wd-swiper-nav.vue'
import { swiperProps, type SwiperItem } from './types'
import type { SwiperNavProps } from '../wd-swiper-nav/types'
import { addUnit, getRect, isDef, isImageUrl, isObj, isVideoUrl, parseStyle, uuid } from '../../common/util'
import { uni } from '../../common/uni'
import { useAlive } from '../../composables/useAlive'

const props = defineProps(swiperProps)
const emit = defineEmits(['click', 'change', 'animationfinish', 'update:current', 'long-press'])
const slots = useSlots()

const isAlive = useAlive()

const navCurrent = ref<number>(normalizeCurrent(props.current)) // 当前滑块 scroll-view 使用
const currentValue = ref<number>(normalizeCurrent(props.current)) // 当前滑块

const videoPlaying = ref<boolean>(false) // 当前是否在播放视频

const uid = ref<string>(uuid())
/** 分页视口（scroll-view）id：容器宽高度量用（同页多个轮播不撞节点） */
const swiperId = ref<string>(`swiperId${uid.value}`)

/** 容器宽高（px）：挂载后一次性度量并缓存 */
const containerWidth = ref<number>(0)
const containerHeight = ref<number>(0)
/** 用户正在滑动（滚动事件防抖标记，自动播放避开手势） */
let scrollTimer: ReturnType<typeof setTimeout> | null = null
const userScrolling = ref(false)
/** 自动播放定时器 */
let playTimer: ReturnType<typeof setInterval> | null = null
/** 循环切换时禁用一帧滚动动画（避免倒滑全部页面） */
const wrapNoAnim = ref(false)

const isVertical = computed(() => props.direction === 'vertical')

const itemCount = computed(() => props.list.length || 0)

function normalizeCurrent(value: number): number {
  const count = props.list.length
  if (count === 0 || !Number.isFinite(value)) return 0
  const index = Math.trunc(value)
  if (index < 0) return props.loop ? count - 1 : 0
  if (index >= count) return props.loop ? 0 : count - 1
  return index
}

watch(itemCount, () => {
  const next = normalizeCurrent(currentValue.value)
  if (next !== currentValue.value) updateCurrent(next, true)
})

/**
 * 更新当前滑块
 * @param current 当前滑块索引
 * @param force 是否强制更新 scroll-view 绑定的 current
 */
const updateCurrent = (current: number, force: boolean = false) => {
  current = normalizeCurrent(current)
  currentValue.value = current
  if (force) {
    navCurrent.value = current
  }
  emit('update:current', current)
}

watch(() => props.current, (value) => navTo(normalizeCurrent(value)))
watch(() => props.interval, startAutoplay)

const swiperStyle = computed<Record<string, string>>(() => {
  const style: Record<string, string> = {
    height: addUnit(props.height)
  }
  if (isDef(props.radius)) {
    style['border-radius'] = addUnit(props.radius)
  }
  return style
})

const swiperItemClass = computed(() => {
  return `wd-swiper__item ${slots.default ? 'wd-swiper__item--slot' : ''}`
})

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
    swiperIndicator.minShowNum = indicator.minShowNum ?? 2
    swiperIndicator.showControls = indicator.showControls || false
  }
  return swiperIndicator
})

const getMediaType = (item: string | SwiperItem, type: 'video' | 'image') => {
  const checkType = (url: string) => (type === 'video' ? isVideoUrl(url) : isImageUrl(url))

  if (isObj(item)) {
    return item.type && ['video', 'image'].includes(item.type) ? item.type === type : checkType(item[props.valueKey])
  } else {
    return checkType(item)
  }
}

const isVideo = (item: string | SwiperItem) => {
  return getMediaType(item, 'video')
}

const isImage = (item: string | SwiperItem) => {
  return getMediaType(item, 'image')
}

function navTo(index: number) {
  index = normalizeCurrent(index)
  if (index === currentValue.value) return
  const previous = currentValue.value
  updateCurrent(index, true)
  emit('change', { current: index, source: '' })
  handleVideoChange(previous, index)
}

function goToStart() {
  navTo(0)
}

function goToEnd() {
  navTo(props.list.length - 1)
}

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
 * @param current
 * @param index
 * @param list
 */
function isPrev(current: number, index: number, list: string[] | SwiperItem[]) {
  return (current - 1 + list.length) % list.length === index
}

/**
 * 是否为当前滑块的后一个滑块
 * @param current
 * @param index
 * @param list
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
 * 边距换算为 px 数值（'24px' / 24 / '24rpx' 均取数值部分，rpx 按 px 近似）
 */
function toPixel(value: number | string): number {
  if (typeof value === 'number') return value
  const num = parseFloat(value)
  return Number.isNaN(num) ? 0 : num
}

/** 每屏滑块数（至少 1） */
const displayCount = computed(() => Math.max(1, Number(props.displayMultipleItems) || 1))

/** 单个滑块在滚动方向上的尺寸（px），未度量时为 0 */
const itemSize = computed(() => {
  const container = isVertical.value ? containerHeight.value : containerWidth.value
  if (container <= 0) return 0
  const available = container - toPixel(props.previousMargin) - toPixel(props.nextMargin)
  return Math.max(0, available / displayCount.value)
})

/**
 * 内容轨道内联样式：键集合恒定（CONVENTIONS §20），方向 / 边距随 props 切换
 */
const trackInnerStyle = computed<Record<string, string>>(() => {
  const prev = toPixel(props.previousMargin)
  const next = toPixel(props.nextMargin)
  const size = itemSize.value * itemCount.value
  const total = size > 0 ? size + prev + next : 0
  const vertical = isVertical.value
  return {
    width: vertical ? '100%' : `${total}px`,
    height: vertical ? `${total}px` : '100%',
    'flex-direction': vertical ? 'column' : 'row',
    'padding-left': vertical ? '0px' : `${prev}px`,
    'padding-right': vertical ? '0px' : `${next}px`,
    'padding-top': vertical ? `${prev}px` : '0px',
    'padding-bottom': vertical ? `${next}px` : '0px'
  }
})

/** 单个滑块内联样式：键集合恒定（CONVENTIONS §20） */
const itemStyle = computed<Record<string, string>>(() => {
  const vertical = isVertical.value
  const size = itemSize.value
  return {
    width: vertical ? '100%' : `${size}px`,
    height: vertical ? `${size}px` : '100%'
  }
})

/** 媒体（图片 / 视频）高度：与参考源一致取轮播高度 */
const mediaStyle = computed<Record<string, string>>(() => {
  return { height: addUnit(props.height) }
})

/** 滚动位置（当前页偏移） */
const scrollLeft = computed(() => (isVertical.value ? 0 : navCurrent.value * itemSize.value))
const scrollTop = computed(() => (isVertical.value ? navCurrent.value * itemSize.value : 0))

/** 自动播放是否应运行 */
const shouldAutoplay = computed(() => props.autoplay && !videoPlaying.value && props.interval > 0 && itemCount.value > 1)

function startAutoplay() {
  stopAutoplay()
  if (!shouldAutoplay.value) return
  playTimer = setInterval(() => {
    if (!isAlive()) return
    // 用户正在滑动时跳过本轮，避免与手势互搏
    if (userScrolling.value) return
    autoNext()
  }, props.interval)
}

function stopAutoplay() {
  if (playTimer) {
    clearInterval(playTimer)
    playTimer = null
  }
}

watch(shouldAutoplay, (val) => {
  if (val) startAutoplay()
  else stopAutoplay()
})

/**
 * 自动播放推进一页（循环到末页时瞬移回首页）
 */
function autoNext() {
  const total = itemCount.value
  if (total <= 0) return
  let target = currentValue.value + 1
  if (target > total - 1) {
    if (!props.loop) {
      stopAutoplay()
      return
    }
    target = 0
    // 循环：禁用一帧滚动动画，避免从末页倒滑回首页
    wrapNoAnim.value = true
    setTimeout(() => {
      if (isAlive()) wrapNoAnim.value = false
    }, 50)
  }
  updateCurrent(target, true)
  emit('change', { current: target, source: 'autoplay' })
  handleVideoChange(target === 0 ? total - 1 : target - 1, target)
}

/** 容器宽高度量（一次性 + 尺寸 props 变化时重度量） */
function measure() {
  getRect(`#${swiperId.value}`, false).then((data) => {
    // 度量回调晚于组件卸载落地时丢弃（真机 9902 晚到 patch 家族）
    if (!isAlive()) return
    containerWidth.value = Number(data.width) || 0
    containerHeight.value = Number(data.height) || 0
    // 度量完成后布局才稳定，此时启动自动播放
    startAutoplay()
  })
}

onMounted(measure)

watch([() => props.height, () => props.displayMultipleItems, () => props.previousMargin, () => props.nextMargin, itemCount], measure)

// 防抖定时器与播放定时器不得活过组件：卸载后到期的回调会写 ref，
// 在已销毁树上继续 patch（真机 9902 晚到 patch 家族）。
onUnmounted(() => {
  stopAutoplay()
  if (scrollTimer) {
    clearTimeout(scrollTimer)
    scrollTimer = null
  }
})

/**
 * 滚动事件（对齐参考源 swiper 元素 change 的手势语义）
 */
function handleScroll(e: any) {
  const offset = Number(isVertical.value ? e.detail?.scrollTop : e.detail?.scrollLeft) || 0
  // itemSize 未度量（0）时不换算：round(任意值/1) 会产生离谱 index
  if (itemSize.value <= 0 || itemCount.value === 0) return
  const index = Math.min(itemCount.value - 1, Math.max(0, Math.round(offset / itemSize.value)))
  if (index !== currentValue.value) {
    const previous = currentValue.value
    currentValue.value = index
    emit('update:current', index)
    emit('change', { current: index, source: 'touch' })
    handleVideoChange(previous, index)
  }
  // 标记用户滑动并防抖复位
  userScrolling.value = true
  if (scrollTimer) clearTimeout(scrollTimer)
  scrollTimer = setTimeout(() => {
    if (isAlive()) userScrolling.value = false
  }, 250)
}

/**
 * 滚动结束：吸附到最近页并对齐程序定位值（对齐参考源 animationfinish）
 */
function handleScrollEnd() {
  if (currentValue.value !== navCurrent.value) {
    navCurrent.value = currentValue.value
  }
  emit('animationfinish', { current: currentValue.value, source: 'touch' })
}

/**
 * 点击滑块事件
 * @param index 点击的滑块下标
 * @param item 点击的滑块内容
 */
function handleClick(index: number, item: string | SwiperItem) {
  emit('click', { index, item })
}

function handleLongPress(index: number, item: string | SwiperItem) {
  emit('long-press', { index, item })
}

/**
 * 处理视频切换
 */
function handleVideoChange(previous: number, current: number) {
  handleStopVideoPaly(previous)
  handleStartVideoPaly(current)
}

/**
 * 开始播放指定视频
 * @param index
 */
function handleStartVideoPaly(index: number) {
  if (props.autoplayVideo) {
    const currentItem = props.list[index]
    if (isDef(currentItem) && isVideo(currentItem)) {
      const video = uni.createVideoContext(`video-${index}-${uid.value}`)
      video.play()
    }
  }
}

/**
 * 停止播放指定视频
 * @param index
 */
function handleStopVideoPaly(index: number) {
  if (props.stopPreviousVideo) {
    const previousItem = props.list[index]
    if (isDef(previousItem) && isVideo(previousItem)) {
      const video = uni.createVideoContext(`video-${index}-${uid.value}`)
      video.pause()
    }
  } else if (props.stopAutoplayWhenVideoPlay) {
    handleVideoPause()
  }
}

function handleIndicatorChange({ dir }: { dir: 'prev' | 'next' }) {
  const { list, loop } = props
  const total = list.length
  if (!total) return
  let nextPos = dir === 'next' ? currentValue.value + 1 : currentValue.value - 1
  if (loop) {
    nextPos = dir === 'next' ? (currentValue.value + 1) % total : (currentValue.value - 1 + total) % total
  } else {
    nextPos = nextPos < 0 || nextPos >= total ? currentValue.value : nextPos
  }
  if (nextPos === currentValue.value) return
  navTo(nextPos)
}
</script>

<template>
  <view :class="`wd-swiper ${customClass}`" :style="parseStyle(customStyle)">
    <scroll-view
      :id="swiperId"
      class="wd-swiper__track"
      :style="swiperStyle"
      :scroll-x="!isVertical"
      :scroll-y="isVertical"
      :show-scrollbar="false"
      :scroll-left="scrollLeft"
      :scroll-top="scrollTop"
      :scroll-with-animation="!wrapNoAnim"
      @scroll="handleScroll"
      @scrollend="handleScrollEnd"
    >
      <view class="wd-swiper__track-inner" :style="trackInnerStyle">
        <view v-for="(item, index) in list" :key="index" :class="swiperItemClass" :style="itemStyle">
          <slot :item="item" :index="index">
            <video
              v-if="isVideo(item)"
              :id="`video-${index}-${uid}`"
              :style="mediaStyle"
              :src="isObj(item) ? item[valueKey] : item"
              :poster="isObj(item) ? item.poster : ''"
              :class="`wd-swiper__video ${customItemClass} ${getCustomItemClass(currentValue, index, list)}`"
              @play="handleVideoPaly"
              @pause="handleVideoPause"
              :loop="videoLoop"
              :muted="muted"
              :autoplay="autoplayVideo"
              object-fit="cover"
              @tap="handleClick(index, item)"
              @longpress="handleLongPress(index, item)"
            />
            <image
              v-else
              :src="isObj(item) ? item[valueKey] : item"
              :class="`wd-swiper__image ${customImageClass} ${customItemClass} ${getCustomItemClass(currentValue, index, list)}`"
              :style="mediaStyle"
              :mode="imageMode"
              :show-menu-by-longpress="showMenuByLongpress"
              @tap="handleClick(index, item)"
              @longpress="handleLongPress(index, item)"
            />
            <text v-if="isObj(item) && item[textKey]" :class="`wd-swiper__text ${customTextClass}`" :style="parseStyle(customTextStyle)">
              {{ item[textKey] }}
            </text>
          </slot>
        </view>
      </view>
    </scroll-view>

    <template v-if="indicator">
      <slot name="indicator" :current="currentValue" :total="list.length"></slot>
      <WdSwiperNav
        v-if="!slots.indicator"
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
