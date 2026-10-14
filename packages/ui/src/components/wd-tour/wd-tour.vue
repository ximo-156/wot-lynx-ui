<template>
  <view class="wd-tour" v-if="modelValue" :style="styleToObject(rootStyle)" @touchmove.stop.prevent="noop">
    <view class="wd-tour__mask" @tap.stop="handleMask">
      <slot name="highlight" :elementInfo="highlightElementInfo">
        <view :class="highlightClass" :style="styleToObject(highlightStyle)"></view>
      </slot>
      <view class="wd-tour__popover" :style="styleToObject(popoverStyle)">
        <view class="wd-tour__info">
          <slot name="content">
            <!-- Lynx 适配：rich-text 为小程序专有元素，Lynx 用 text 元素渲染；
                 富文本 HTML 在 Lynx 中降级为纯文本展示。 -->
            <text class="wd-tour__content-text">{{ currentStep.content }}</text>
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

<script setup lang="ts">
import './index.css'
import { uni } from '../../common/uni'
import {ref, computed, watch, nextTick} from 'vue-lynx'
import { styleToObject, type CSSProperties, addUnit, getRect, getSystemInfo, isDef, objToStyle, warnOnce } from '../../common/util'
import { tourProps, type TourEmits, type TourExpose } from './types'
import { useRaf } from '../../composables/useRaf'
import { useTranslate } from '../../composables/useTranslate'
import WdButton from '../wd-button/wd-button.vue'

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

const currentIndex = ref<number>(0) // 当前步骤索引
const elementInfo = ref<any>({
  top: 0,
  left: 0,
  width: 0,
  height: 0
}) // 元素信息
const windowHeight = ref<number>(0) // 窗口高度
const windowTop = ref<number>(0) // 窗口顶部位置
const isElementInTop = ref<boolean>(true) // 判断元素位置，确定提示信息在该元素的上方还是下方，true为上方，false为下方
const lastScrollTop = ref<number>(0) //记录上一次滚动位置
const statusBarHeight = ref<number>(0) // 状态栏高度
const menuButtonInfo = ref<any>(null)
const topOffset = ref<number>(0) // 顶部偏移量

const rootStyle = computed(() => {
  const style: CSSProperties = {}
  if (isDef(props.zIndex)) {
    style.zIndex = props.zIndex
  }
  return objToStyle(style)
})

const highlightClass = computed(() => {
  return `wd-tour__highlight ${props.mask ? 'wd-tour__highlight--mask' : ''}`
})

// 计算属性
const currentStep = computed(() => {
  return props.steps[currentIndex.value] || {}
})
// 提取公共的默认样式函数
/**
 * 获取默认样式
 */
function getDefaultStyle(): CSSProperties {
  return {
    transition: props.duration + 'ms all'
  }
}

/**
 * 计算高亮样式
 * @param padding 内边距
 */
function calculateHighlightStyle(padding: number): CSSProperties {
  return {
    transition: props.duration + 'ms all,boxShadow 0s,height 0s,width 0s',
    borderRadius: addUnit(props.borderRadius),
    padding: addUnit(padding)
  }
}
const highlightStyle = computed(() => {
  // 如果元素信息尚未获取到，返回空样式避免闪烁
  if (!elementInfo.value.width && !elementInfo.value.height) {
    return getDefaultStyle()
  }
  const stepPadding = Number(isDef(currentStep.value.padding) ? currentStep.value.padding : props.padding)
  const baseStyle = calculateHighlightStyle(stepPadding)
  const style: CSSProperties = {
    ...baseStyle,
    top: addUnit((elementInfo.value.top || 0) - stepPadding),
    left: addUnit((elementInfo.value.left || 0) - stepPadding),
    height: addUnit(elementInfo.value.height || 0),
    width: addUnit(elementInfo.value.width || 0)
  }
  if (isDef(props.mask) && isDef(props.maskColor)) {
    style.boxShadow = `0 0 0 100vh ${props.maskColor}`
  }
  return objToStyle([{ ...style }, props.highlightStyle])
})

const popoverStyle = computed(() => {
  const style: CSSProperties = {}
  if (isDef(props.zIndex)) {
    const zIndex = Number(props.zIndex)
    style.zIndex = zIndex + 1
    style.transitionDuration = `${props.duration}ms`
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

  return objToStyle(style)
})

const highlightElementInfo = computed(() => {
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
  if (isDef(props.mask) && isDef(props.maskColor)) {
    style.boxShadow = `0 0 0 100vh ${props.maskColor}`
  }
  return style
})
function noop() {}

/**
 * 更新元素信息
 *
 * 兜底约定（异常一律不得逃逸到渲染路径 / raf 回调）：
 * 1. **引导元素缺失**（getRect 按约定降级为零尺寸矩形）→ 走显式分支
 *    handleMissingElement：触发 error 事件并按 missingStrategy（skip / hide）
 *    降级。这里不再用 throw 做控制流——那会让"预期内的缺失"每次都打出
 *    带堆栈的 console.error，也会把后续 pageScrollTo 等真实异常误判成缺失。
 * 2. **意外异常**（如宿主 pageScrollTo 抛错）→ 走 handleUpdateError：保留上
 *    一次有效的元素信息，引导继续可用，只按 key 去重告警一次。
 */
async function updateElementInfo() {
  updateSystemInfo()
  const element = currentStep.value.element
  if (!element) return

  let res: UniApp.NodeInfo
  try {
    res = (await getRect(element, false, props.scope)) as UniApp.NodeInfo
  } catch (error) {
    // getRect 约定永不 reject；真出现异常时按"度量不可用"兜底，
    // 保持上一次有效的元素信息，不误报成"引导元素缺失"。
    handleUpdateError(`度量引导元素失败: ${element}`, error)
    return
  }

  // getRect 约定永不 reject：选择器未命中 / 宿主度量不可用时返回零尺寸矩形。
  // 引导需要区分"元素缺失"，零矩形按缺失进入显式分支，
  // 保证 missingStrategy（skip / hide / stop）与 error 事件行为不回归。
  if (!res || (!res.width && !res.height)) {
    handleMissingElement(element)
    return
  }

  try {
    initializeElementInfo(res)
    const effectiveBoundaries = getEffectiveBoundaries()
    const scrollNeeds = checkScrollNeeds(res, effectiveBoundaries)
    handleScrolling(res, scrollNeeds, effectiveBoundaries)
    calculateTipPosition(res)
  } catch (error) {
    handleUpdateError(`处理引导元素信息失败: ${element}`, error)
  }
}

/**
 * 引导元素缺失的兜底：error 事件 + missingStrategy 降级。
 * 该场景对消费方是可预期的（有 error 事件与 missingStrategy 两个出口），
 * 因此只按「步骤 + 元素」去重告警一次，不再打带堆栈的 error。
 */
function handleMissingElement(element: string) {
  warnOnce(
    `tour:missing:${currentIndex.value}:${element}`,
    `[wot-lynx-ui] wd-tour 未找到引导元素 ${element}，已按 missing-strategy="${props.missingStrategy}" 降级处理（同步触发 error 事件）`
  )
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

/**
 * 意外异常的兜底：保留上一次有效的元素信息（不清零、不误报缺失），
 * 仅按 key 去重告警一次，异常不向上抛。
 */
function handleUpdateError(message: string, error: unknown) {
  warnOnce(`tour:update:${message}`, `[wot-lynx-ui] wd-tour ${message}，已保留上一次有效的元素信息`, error)
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
function initializeElementInfo(res: UniApp.NodeInfo) {
  elementInfo.value = res
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
function checkScrollNeeds(res: UniApp.NodeInfo, boundaries: { top: number; bottom: number }) {
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
function handleScrolling(res: UniApp.NodeInfo, scrollNeeds: { up: boolean; down: boolean }, boundaries: { top: number; bottom: number }) {
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
function scrollUp(res: UniApp.NodeInfo, boundaries: { top: number; bottom: number }) {
  // 计算需要滚动的距离
  let scrollDistance = lastScrollTop.value + Number(res.top) - props.padding - boundaries.top
  // 更新元素位置信息（滚动后）
  elementInfo.value.top = boundaries.top + props.padding
  elementInfo.value.bottom = windowHeight.value - (boundaries.top + props.padding)
  uni.pageScrollTo({
    scrollTop: scrollDistance,
    duration: Number(props.duration),
    success: () => {
      // 更新已滚动距离
      lastScrollTop.value = scrollDistance
    }
  })
}

/**
 * 引导向下滚动处理
 * @param res 元素节点信息
 */
function scrollDown(res: UniApp.NodeInfo) {
  // 计算需要滚动的距离
  const bottom = res.bottom || 0
  let scrollDistance = bottom - windowHeight.value + props.padding + Number(props.bottomSafetyOffset)

  // 更新元素位置信息（滚动后）
  elementInfo.value.top = windowHeight.value - bottom - props.padding - Number(props.bottomSafetyOffset) // 应该是减去安全偏移量
  elementInfo.value.bottom = windowHeight.value - props.padding - Number(props.bottomSafetyOffset)

  uni.pageScrollTo({
    scrollTop: scrollDistance + lastScrollTop.value,
    duration: Number(props.duration),
    success: () => {
      // 更新已滚动距离
      lastScrollTop.value = scrollDistance + lastScrollTop.value
    }
  })
}

/**
 * 计算提示框显示位置（上方或下方）
 * @param res 元素节点信息
 */
function calculateTipPosition(res: UniApp.NodeInfo) {
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
  (newVal) => {
    currentIndex.value = newVal
  }
)
// 在 setup 作用域中创建 raf 实例，避免在 watch 回调中调用 onUnmounted
const indexRaf = useRaf(updateElementInfo)
const modelRaf = useRaf(() => {
  updateElementInfo()
  emit('update:current', currentIndex.value)
})

// 监听 currentIndex 变化，同步到父组件
watch(
  () => currentIndex.value,
  (newVal) => {
    indexRaf.cancel()
    nextTick(() => {
      indexRaf.start()
    })
    emit('update:current', newVal)
  }
)

// 监听 modelValue 变化，当组件显示时更新系统信息
watch(
  () => props.modelValue,
  (newVal) => {
    if (newVal) {
      // 组件显示时重置滚动位置并更新系统信息
      lastScrollTop.value = 0
      updateSystemInfo()
      modelRaf.cancel()
      nextTick(() => {
        modelRaf.start()
      })
    }
  },
  {
    immediate: true
  }
)

// 所有平台统一处理逻辑
if (props.customNav) {
  // 开启了自定义导航栏
  if (props.topSafetyOffset && Number(props.topSafetyOffset) > 0) {
    // 用户传入了顶部安全偏移量，优先使用用户设置的值
    topOffset.value = Number(props.topSafetyOffset)
  } else {
    // 未传入顶部偏移量
    // 微信小程序平台获取菜单按钮信息并使用其顶部位置
    menuButtonInfo.value = uni.getMenuButtonBoundingClientRect() || null
    topOffset.value = menuButtonInfo.value ? menuButtonInfo.value.top : 0
    // 非微信小程序平台默认为0
    topOffset.value = 0
  }
} else {
  // 未开启自定义导航栏，直接使用用户传入的顶部安全偏移量
  topOffset.value = Number(props.topSafetyOffset) || 0
}
defineExpose<TourExpose>({
  handlePrev,
  handleNext,
  handleFinish,
  handleSkip
})
</script>

