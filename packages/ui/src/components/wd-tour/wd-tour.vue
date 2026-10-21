/*
 * wd-tour — 新手引导
 *
 * Lynx 实现说明（相对 wot-ui 2.3.2 的适配点）：
 * - 事件映射：@click → @tap（CONVENTIONS §6，Lynx view 不派发 click）；
 *   根 view 绑 @touchmove.stop.prevent 锁滚，emits 声明 'touchmove' 并在
 *   noop 中转发（CONVENTIONS §14：消费方绑 @touchmove 不会与根元素监听合并崩溃）。
 * - 富文本节点：参考源用 uni-app 专有的 rich-text 元素渲染 content，Lynx 无该
 *   元素（原生元素白名单外），降级为 text 元素（PORTING §4/§5 平台降级）。
 * - 定位样式：rootStyle / highlightStyle / popoverStyle 由参考源的 objToStyle
 *   字符串拼接改为对象语法（CONVENTIONS §19）；popoverStyle 的 top/bottom
 *   二选一切换经 defineStyleKeys + resolveStyle 输出完整键集（Style Funnel，
 *   §20，避免切步时旧偏移残留）。
 * - 条件编译：参考源用 #ifdef MP / #ifndef MP 区分微信小程序菜单按钮获取，
 *   Lynx 无对应能力，统一走 uni.getMenuButtonBoundingClientRect 适配层
 *   （返回零矩形，topOffset 降级为 0）；条件编译残留已清除（PORTING §3.6）。
 * - uni.pageScrollTo 由宿主注入；缺少或失败时保留实际度量，不预测未发生的滚动。
 * - getRect 契约为「永不 reject」（未命中节点解析为零尺寸矩形），参考源依赖
 *   reject 进入 catch 派发 error 事件并执行 missingStrategy；这里对零尺寸结果
 *   显式抛出，保持错误分支行为一致。
 */
<script lang="ts" setup>
import './index.css'

import { computed, nextTick, ref, watch } from 'vue-lynx'
import type { CSSProperties } from '../../common/util'
import WdButton from '../wd-button/wd-button.vue'
import { tourProps, type TourEmits, type TourExpose, type TourStep } from './types'
import { addUnit, filterStyle, getRect, getSystemInfo, isDef, parseStyle } from '../../common/util'
import { useRaf } from '../../composables/useRaf'
import { useTranslate } from '../../composables/useTranslate'
import { useAlive } from '../../composables/useAlive'
import { hasUniAdapter, uni } from '../../common/uni'
import { defineStyleKeys, resolveStyle } from '../../common/style'

const props = defineProps(tourProps)
const emit = defineEmits<TourEmits>()
const { translate } = useTranslate('tour')

const prevText = computed(() => {
  return isDef(props.prevText) ? props.prevText : translate('prev')
})

const nextText = computed(() => {
  return isDef(props.nextText) ? props.nextText : translate('next')
})

const skipText = computed(() => {
  return isDef(props.skipText) ? props.skipText : translate('skip')
})

const finishText = computed(() => {
  return isDef(props.finishText) ? props.finishText : translate('finish')
})

const isAlive = useAlive()
let rectRequest = 0

function normalizeCurrent(value: number) {
  return Math.min(Math.max(0, Number.isFinite(value) ? Math.trunc(value) : 0), Math.max(0, props.steps.length - 1))
}

const currentIndex = ref<number>(normalizeCurrent(props.current)) // 初始值与受控 current 一致
const elementInfo = ref({
  top: 0,
  left: 0,
  width: 0,
  height: 0,
  bottom: 0 as number | undefined
}) // 元素信息
const windowHeight = ref<number>(0) // 窗口高度
const windowTop = ref<number>(0) // 窗口顶部位置
const isElementInTop = ref<boolean>(true) // 判断元素位置，确定提示信息在该元素的上方还是下方，true为上方，false为下方
const lastScrollTop = ref<number>(0) //记录上一次滚动位置
const statusBarHeight = ref<number>(0) // 状态栏高度
const menuButtonInfo = ref<{ top: number } | null>(null)
const topOffset = ref<number>(0) // 顶部偏移量

// Lynx 适配：参考源返回 objToStyle 字符串，本地改为对象语法（§19）
// Lynx 适配：参考源返回 objToStyle 字符串（且遗漏了 customStyle 的合并），
// 本地改为对象语法并补上 customStyle（文档声明该 prop，与库内其它组件一致）
const rootStyle = computed<Record<string, string>>(() => {
  const style: Record<string, string> = {}
  if (isDef(props.zIndex)) {
    style['z-index'] = String(props.zIndex)
  }
  return { ...filterStyle(style), ...parseStyle(props.customStyle) }
})

const highlightClass = computed(() => {
  return `wd-tour__highlight ${props.mask ? 'wd-tour__highlight--mask' : ''}`
})

// 计算属性
const currentStep = computed(() => {
  return props.steps[currentIndex.value] || {}
})
// 无 rich-text 元素时以可读文本兜底，不把 HTML 标记直接展示给用户；富样式走 content 插槽。
const contentText = computed(() => {
  const text = String(currentStep.value.content || '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi, '')
    .replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6])\s*>/gi, '\n')
    .replace(/<[^>]*>/g, '')
  const entities: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00a0' }
  return text.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (entity, name: string) => {
    if (name[0] !== '#') return entities[name.toLowerCase()] || entity
    const code = name[1].toLowerCase() === 'x' ? parseInt(name.slice(2), 16) : parseInt(name.slice(1), 10)
    return Number.isFinite(code) && code >= 0 && code <= 0x10ffff ? String.fromCodePoint(code) : entity
  }).trim()
})
// 提取公共的默认样式函数
/**
 * 获取默认样式
 */
function getDefaultStyle(): Record<string, string> {
  return {
    transition: props.duration + 'ms all'
  }
}

/**
 * 计算高亮样式
 * @param padding 内边距
 */
function calculateHighlightStyle(padding: number): Record<string, string> {
  return {
    transition: props.duration + 'ms all,boxShadow 0s,height 0s,width 0s',
    'border-radius': addUnit(props.borderRadius),
    padding: addUnit(padding)
  }
}
const HIGHLIGHT_STYLE = defineStyleKeys({ top: '0px', left: '0px', width: '0px', height: '0px', padding: '0px', 'border-radius': '0px', 'box-shadow': '', opacity: '0' })
const highlightStyle = computed<Record<string, string>>(() => {
  // 如果元素信息尚未获取到，返回空样式避免闪烁
  if (!elementInfo.value.width && !elementInfo.value.height) {
    return resolveStyle(HIGHLIGHT_STYLE, getDefaultStyle())
  }
  const stepPadding = Number(isDef(currentStep.value.padding) ? currentStep.value.padding : props.padding)
  const baseStyle = calculateHighlightStyle(stepPadding)
  const style: Record<string, string> = {
    ...baseStyle,
    top: addUnit((elementInfo.value.top || 0) - stepPadding),
    left: addUnit((elementInfo.value.left || 0) - stepPadding),
    height: addUnit(elementInfo.value.height || 0),
    width: addUnit(elementInfo.value.width || 0)
  }
  if (props.mask && isDef(props.maskColor)) {
    style['box-shadow'] = `0 0 0 ${windowHeight.value}px ${props.maskColor}`
  }
  return resolveStyle(HIGHLIGHT_STYLE, { opacity: '1' }, style, parseStyle(props.highlightStyle))
})

// Style Funnel（CONVENTIONS §20）：top / bottom 按步骤二选一切换，两键必须
// 每帧都输出完整键集，否则上一帧的偏移会残留（提示框上下同时存在）
const POPOVER_STYLE = defineStyleKeys({ top: 'auto', bottom: 'auto', 'z-index': '', 'transition-duration': '' })

const popoverStyle = computed<Record<string, string>>(() => {
  const style: Record<string, string> = {}
  style['transition-duration'] = `${props.duration}ms`
  if (isDef(props.zIndex)) {
    const zIndex = Number(props.zIndex)
    style['z-index'] = String(zIndex + 1)
  }
  const stepPadding = Number(isDef(currentStep.value.offset) ? currentStep.value.offset : props.offset)
  const placement = isDef(currentStep.value.placement) ? currentStep.value.placement : 'auto'
  const down = placement === 'bottom' || (placement === 'auto' && isElementInTop.value)
  if (down) {
    // 提示在元素下方
    style.top = addUnit((elementInfo.value.top || 0) + (elementInfo.value.height || 0) + Number(stepPadding))
  } else {
    // 提示在元素上方
    style.bottom = addUnit(windowHeight.value + windowTop.value - (elementInfo.value.top || 0) + Number(stepPadding))
  }

  return resolveStyle(POPOVER_STYLE, style)
})

const highlightElementInfo = computed<CSSProperties>(() => {
  const stepPadding = Number(isDef(currentStep.value.padding) ? currentStep.value.padding : props.padding)
  // 如果元素信息尚未获取到，返回空样式避免闪烁
  if (!elementInfo.value.width && !elementInfo.value.height) {
    return getDefaultStyle()
  }

  const baseStyle = calculateHighlightStyle(stepPadding)
  const style: CSSProperties = {
    ...baseStyle,
    top: addUnit((elementInfo.value.top || 0) - stepPadding),
    left: addUnit((elementInfo.value.left || 0) - stepPadding),
    width: addUnit((elementInfo.value.width || 0) + stepPadding * 2),
    height: addUnit((elementInfo.value.height || 0) + stepPadding * 2)
  }
  style.boxShadow = props.mask && isDef(props.maskColor) ? `0 0 0 ${windowHeight.value}px ${props.maskColor}` : ''
  return style
})

/**
 * 根 view 的 @touchmove.stop.prevent 占位（锁滚），同时转发原生事件
 * （CONVENTIONS §14）
 */
function noop(event?: any) {
  emit('touchmove', event)
}

/**
 * 更新元素信息
 */
async function updateElementInfo() {
  if (!isAlive() || !props.modelValue) return
  const request = ++rectRequest
  const index = currentIndex.value
  updateSystemInfo()
  const element = currentStep.value.element
  if (!element) {
    elementInfo.value = { top: 0, left: 0, width: 0, height: 0, bottom: 0 }
    return
  }
  try {
    const res = await getRect(element, false, props.scope)
    if (!isAlive() || !props.modelValue || request !== rectRequest || index !== currentIndex.value || element !== currentStep.value.element) return
    // Lynx 适配：本地 getRect 契约为「永不 reject」——选择器未命中时解析为
    // 零尺寸矩形；参考源（uni-app）此时会 reject 进入 catch。零尺寸即视为
    // 「未找到目标元素」，显式抛出以对齐参考源的错误分支（error 事件 +
    // missingStrategy 处理）。
    if (!res || (!res.width && !res.height)) {
      throw new Error(`无法找到指定的引导元素: ${element}`)
    }
    initializeElementInfo(res)
    const effectiveBoundaries = getEffectiveBoundaries()
    const scrollNeeds = checkScrollNeeds(res, effectiveBoundaries)
    handleScrolling(res, scrollNeeds, effectiveBoundaries)
    calculateTipPosition(res)
  } catch (error) {
    if (!isAlive() || !props.modelValue || request !== rectRequest || index !== currentIndex.value || element !== currentStep.value.element) return
    elementInfo.value = { top: 0, left: 0, width: 0, height: 0, bottom: 0 }
    console.error('updateElementInfo error:', error)
    emit('error', {
      message: '无法找到指定的引导元素',
      element: element
    })
    if (props.missingStrategy === 'skip') {
      handleNext()
    } else if (props.missingStrategy === 'hide') {
      emit('update:modelValue', false)
    }
  }
}

/**
 * 更新系统信息
 */
function updateSystemInfo() {
  const sysInfo = getSystemInfo()
  windowHeight.value = sysInfo.windowHeight
  windowTop.value = sysInfo.windowTop || 0
  statusBarHeight.value = sysInfo.statusBarHeight || 0
}

/**
 * 初始化元素信息
 * @param res 元素节点信息
 */
function initializeElementInfo(res: any) {
  elementInfo.value = { ...res }
  // 调整元素位置信息，加上窗口顶部偏移量
  elementInfo.value.top = (res.top || 0) + windowTop.value
  elementInfo.value.bottom = ((res.bottom !== undefined ? res.bottom : (res.top || 0) + (res.height || 0)) as number) + windowTop.value
}

/**
 * 获取有效的页面边界（顶部和底部安全区域）
 */
function getEffectiveBoundaries() {
  // 有效顶部边界初始化为窗口顶部 + 顶部偏移量
  let effectiveWindowTop = windowTop.value + Number(topOffset.value)
  // 有效底部边界为窗口高度
  let effectiveWindowBottom = windowHeight.value
  return {
    top: effectiveWindowTop,
    bottom: effectiveWindowBottom
  }
}

/**
 * 检查是否需要滚动
 * @param res 元素节点信息
 * @param boundaries 边界信息
 */
function checkScrollNeeds(res: any, boundaries: { top: number; bottom: number }) {
  // 判断元素是否被顶部遮挡（需要向上滚动）
  const needScrollUp = Number(res.top) < boundaries.top
  // 判断元素是否被底部遮挡（需要向下滚动）
  const needScrollDown = (res.bottom !== undefined ? res.bottom : 0) + Number(props.bottomSafetyOffset) > boundaries.bottom
  return {
    up: needScrollUp, //提示框往上走
    down: needScrollDown //提示框往下走
  }
}

/**
 * 处理滚动逻辑
 * @param res 元素节点信息
 * @param scrollNeeds 滚动需求
 * @param boundaries 边界信息
 */
function handleScrolling(res: any, scrollNeeds: { up: boolean; down: boolean }, boundaries: { top: number; bottom: number }) {
  if (scrollNeeds.up) {
    // 元素被顶部遮挡，需要提示框往上走，页面往下走
    scrollUp(res, boundaries)
  } else if (scrollNeeds.down) {
    // 元素被底部遮挡，需要提示框向下走，页面向上走
    scrollDown(res)
  }
}

/**
 * 向引导上滚动处理
 * @param res 元素节点信息
 * @param boundaries 边界信息
 */
function scrollUp(res: any, boundaries: { top: number; bottom: number }) {
  const padding = Number(currentStep.value.padding ?? props.padding)
  requestScroll(lastScrollTop.value + Number(res.top) - padding - boundaries.top)
}

/**
 * 引导向下滚动处理
 * @param res 元素节点信息
 */
function scrollDown(res: any) {
  const bottom = res.bottom ?? Number(res.top) + Number(res.height)
  const padding = Number(currentStep.value.padding ?? props.padding)
  requestScroll(lastScrollTop.value + bottom - windowHeight.value + padding + Number(props.bottomSafetyOffset))
}
function requestScroll(scrollTop: number) {
  if (!hasUniAdapter('pageScrollTo')) return
  const request = rectRequest
  const index = currentIndex.value
  const element = currentStep.value.element
  uni.pageScrollTo({
    scrollTop: Math.max(0, scrollTop),
    duration: Number(props.duration),
    success: async () => {
      if (!isAlive() || !props.modelValue || request !== rectRequest || index !== currentIndex.value || !element) return
      lastScrollTop.value = Math.max(0, scrollTop)
      const rect = await getRect(element, false, props.scope)
      if (!isAlive() || !props.modelValue || request !== rectRequest || index !== currentIndex.value || element !== currentStep.value.element || (!rect.width && !rect.height)) return
      initializeElementInfo(rect)
      calculateTipPosition(rect)
    }
  })
}

/**
 * 计算提示框显示位置（上方或下方）
 * @param res 元素节点信息
 */
function calculateTipPosition(res: any) {
  // 计算导航区域总高度
  let totalNavHeight = statusBarHeight.value
  // 计算屏幕中心点位置
  const screenCenter = (windowHeight.value + totalNavHeight) / 2 + windowTop.value

  // 计算元素中心点位置
  const elementCenter = (res.top || 0) + (res.height || 0) / 2 + windowTop.value

  // 根据元素位置决定提示框显示在上方还是下方
  if (elementCenter < screenCenter) {
    isElementInTop.value = true
  } else {
    isElementInTop.value = false
  }
}

/**
 * 上一步
 */
function handlePrev() {
  if (!isAlive() || !props.modelValue) return
  if (currentIndex.value > 0) {
    const oldIndex = currentIndex.value
    currentIndex.value--
    emit('prev', {
      prevCurrent: oldIndex,
      current: currentIndex.value,
      total: props.steps.length,
      isElementInTop: isElementInTop.value
    })
    emit('change', { current: currentIndex.value })
  }
}

/**
 * 下一步
 */
function handleNext() {
  if (!isAlive() || !props.modelValue) return
  if (currentIndex.value < props.steps.length - 1) {
    const oldIndex = currentIndex.value
    currentIndex.value++
    emit('next', {
      prevCurrent: oldIndex,
      current: currentIndex.value,
      total: props.steps.length,
      isElementInTop: isElementInTop.value
    })
    emit('change', { current: currentIndex.value })
  } else {
    handleFinish()
  }
}

/**
 * 完成
 */
function handleFinish() {
  if (!isAlive() || !props.modelValue) return
  ++rectRequest
  emit('finish', {
    current: currentIndex.value,
    total: props.steps.length
  })
  currentIndex.value = 0
  lastScrollTop.value = 0 // 重置滚动位置
  emit('update:modelValue', false)
}

/**
 * 跳过
 */
function handleSkip() {
  if (!isAlive() || !props.modelValue) return
  ++rectRequest
  emit('skip', {
    current: currentIndex.value,
    total: props.steps.length
  })
  currentIndex.value = 0
  lastScrollTop.value = 0 // 重置滚动位置
  emit('update:modelValue', false)
}
/**
 * 点击遮罩层
 */
function handleMask() {
  if (props.clickMaskNext) {
    handleNext()
  }
}

watch(
  () => props.current,
  (value) => { currentIndex.value = normalizeCurrent(value) }
)
watch(() => props.steps.length, () => { currentIndex.value = normalizeCurrent(currentIndex.value) })
// 在 setup 作用域中创建 raf 实例，避免在 watch 回调中调用 onUnmounted
const indexRaf = useRaf(updateElementInfo)
const modelRaf = useRaf(() => {
  if (!isAlive() || !props.modelValue) return
  updateElementInfo()
  emit('update:current', currentIndex.value)
})

watch([() => currentStep.value.element, () => props.scope], () => {
  ++rectRequest
  elementInfo.value = { top: 0, left: 0, width: 0, height: 0, bottom: 0 }
  indexRaf.cancel()
  nextTick(() => { if (isAlive() && props.modelValue) indexRaf.start() })
})

// 监听 currentIndex 变化，同步到父组件
watch(
  () => currentIndex.value,
  (newVal) => {
    ++rectRequest
    indexRaf.cancel()
    nextTick(() => {
      if (isAlive() && props.modelValue) indexRaf.start()
    })
    emit('update:current', newVal)
  }
)

// 监听 modelValue 变化，当组件显示时更新系统信息
watch(
  () => props.modelValue,
  (newVal) => {
    ++rectRequest
    indexRaf.cancel()
    modelRaf.cancel()
    if (newVal) {
      // 组件显示时重置滚动位置并更新系统信息
      lastScrollTop.value = 0
      updateSystemInfo()
      modelRaf.cancel()
      nextTick(() => {
        if (isAlive() && props.modelValue) modelRaf.start()
      })
    }
  },
  {
    immediate: true
  }
)

watch([() => props.customNav, () => props.topSafetyOffset], () => {
  menuButtonInfo.value = props.customNav && !props.topSafetyOffset ? uni.getMenuButtonBoundingClientRect() || null : null
  topOffset.value = Number(props.topSafetyOffset) || menuButtonInfo.value?.top || 0
}, { immediate: true })
defineExpose<TourExpose>({
  handlePrev,
  handleNext,
  handleFinish,
  handleSkip
})
</script>

<template>
  <view :class="`wd-tour ${customClass}`" v-if="modelValue" :style="rootStyle" @touchmove.stop.prevent="noop">
    <view class="wd-tour__mask" @tap.stop="handleMask">
      <slot name="highlight" :elementInfo="highlightElementInfo">
        <view :class="highlightClass" :style="highlightStyle"></view>
      </slot>
      <view class="wd-tour__popover" :style="popoverStyle" @tap.stop="() => {}">
        <view class="wd-tour__info">
          <slot name="content">
            <!-- Lynx 适配：参考源为 rich-text :nodes，Lynx 无该元素，降级为 text -->
            <text>{{ contentText }}</text>
          </slot>
        </view>

        <view class="wd-tour__buttons" v-if="showTourButtons">
          <!-- 上一步按钮 -->
          <view class="wd-tour__prev" v-if="currentIndex > 0" @tap.stop="handlePrev">
            <slot name="prev">
              <WdButton class="wd-tour__prev-default" size="mini" variant="text">
                <text>{{ prevText }}</text>
              </WdButton>
            </slot>
          </view>

          <!-- 跳过按钮 -->
          <view class="wd-tour__skip" @tap.stop="handleSkip">
            <slot name="skip">
              <WdButton class="wd-tour__skip-default" size="mini" variant="text">
                <text>{{ skipText }}</text>
              </WdButton>
            </slot>
          </view>

          <!-- 下一步按钮 -->
          <view class="wd-tour__next" v-if="currentIndex !== steps.length - 1" @tap.stop="handleNext">
            <slot name="next">
              <WdButton class="wd-tour__next-default" size="mini">
                <text>{{ `${nextText}(${currentIndex + 1}/${steps.length})` }}</text>
              </WdButton>
            </slot>
          </view>

          <!-- 完成按钮 -->
          <view class="wd-tour__finish" v-if="currentIndex === steps.length - 1" @tap.stop="handleFinish">
            <slot name="finish">
              <WdButton class="wd-tour__finish-default" size="mini" type="primary">
                <text>{{ finishText }}</text>
              </WdButton>
            </slot>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>
