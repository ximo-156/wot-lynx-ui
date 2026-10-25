/*
 * wd-progress — 进度条
 *
 * Lynx 实现说明（相对 wot-ui 2.3.2 的适配点）：
 * - 进度推进算法与参考源逐段一致：颜色数组（string[] / ProgressColor[]）经
 *   createPartList 对齐刻度，前进 / 后退分别走 updateProgressForward /
 *   updateProgressBackward，renderProgressStep 以 50ms 步进 + duration 毫秒
 *   阶梯推进；无 color 时经 pause() 一帧后直接落位；
 * - 内联样式：参考源 rootStyle 为 objToStyle 字符串（background / width /
 *   transition-duration），Lynx 的字符串 style 会被静默丢弃
 *   （CONVENTIONS §19），改为对象语法；customStyle 经 parseStyle 归一；
 * - 参考源 view 内的裸文本（{{ percentage }}%）包进 text 元素
 *   （CONVENTIONS §4）；
 * - 参考源 inner 态图标 / 文案 / zero 态配色用 !important 覆盖状态色，
 *   Lynx 默认不支持 !important（PORTING §4.5），改由选择器特异度
 *   （.wd-progress--inner.is-zero 三类选择器）在源码序上覆盖，行为等价；
 * - 布局三件套（NATIVE-REWRITE §3 / CONVENTIONS §15）：根节点与 outer /
 *   inner 均显式 display: flex + flex-direction: row——参考源 outer 的
 *   display: block 引擎不识别（仅认 flex/none/linear），显式改写后与 Web
 *   的 block 容器语义一致（唯一子节点为绝对定位的 inner）；
 * - 根 view 无事件绑定，不涉及 CONVENTIONS §14 的 tap 转发。
 */
<script lang="ts" setup>
import './index.css'

import { computed, onBeforeUnmount, ref, watch } from 'vue-lynx'
import WdIcon from '../../primitives/wd-icon/wd-icon.vue'
import { isArray, isDef, isObj, isString, parseStyle, pause } from '../../common/util'
import { createStyleResolver } from '../../common/style'
import { progressProps, type ProgressColor } from './types'

const props = defineProps(progressProps)
const duration = computed(() => Number.isFinite(props.duration) ? Math.max(0, props.duration) : 0)
const targetPercentage = computed(() => Number.isFinite(props.percentage) ? Math.max(0, Math.min(100, props.percentage)) : 0)
const position = computed(() => ({ type: props.percentPosition?.type || 'outer', align: props.percentPosition?.align || 'right' }))
const resolveCustomStyle = createStyleResolver()
const customRootStyle = computed(() => resolveCustomStyle(parseStyle(props.customStyle)))
// 进度条渲染颜色
const displayColor = ref<string>('')

// 进度条渲染进度比例
const displayPercentage = ref<number>(0)

// 百分比变更差值
const percentageDiff = ref<number>(0)

// 进度条延迟定时器
let animationTimer: ReturnType<typeof setTimeout> | null = null
let renderTimer: ReturnType<typeof setTimeout> | null = null
let revision = 0
let alive = true

function clearAnimation() {
  if (animationTimer !== null) clearTimeout(animationTimer)
  if (renderTimer !== null) clearTimeout(renderTimer)
  animationTimer = renderTimer = null
}
onBeforeUnmount(() => {
  alive = false
  revision++
  clearAnimation()
})

/**
 * 根节点样式，控制进度条底色、宽度及过渡动画
 */
const rootStyle = computed<Record<string, string>>(() => {
  return {
    'background-color': displayColor.value,
    width: `${displayPercentage.value}%`,
    'transition-duration': `${percentageDiff.value * duration.value * 0.001}s`
  }
})

/**
 * 内置或外置图标的名称，根据状态不同返回对应图标
 */
const iconName = computed(() => {
  let icon: string = ''
  switch (props.status) {
    case 'danger':
      icon = 'close-circle-fill'
      break
    case 'success':
      icon = 'check-circle-fill'
      break
    case 'warning':
      icon = 'exclamation-circle-fill'
      break
    default:
      break
  }
  return icon
})

watch(
  () => [props.percentage, props.color, props.duration],
  () => {
    validatePercentage(props.percentage)
    clearAnimation()
    revision++
    updateProgress(revision)
  },
  { immediate: true, deep: true }
)

/**
 * 校验 percentage 是否合法
 * @param {number} value 百分比值
 */
function validatePercentage(value: number) {
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    console.error('The value of percentage must be between 0 and 100')
  }
}

/**
 * 进度条前进算法
 * @param {ProgressColor[]} partList 颜色及对应进度断点数组
 * @param {number} percentage 目标进度值
 * @returns {boolean}
 */
function updateProgressForward(partList: ProgressColor[], percentage: number) {
  return partList.some((part, index) => {
    if (displayPercentage.value < part.percentage && part.percentage <= percentage) {
      renderProgressStep(part.percentage, part.color)
      return true
    } else if (index === partList.length - 1) {
      renderProgressStep(percentage, part.color)
    }
  })
}

/**
 * 进度条后退算法
 * @param {ProgressColor[]} partList 颜色及对应进度断点数组
 * @param {number} percentage 目标进度值
 * @returns {boolean}
 */
function updateProgressBackward(partList: ProgressColor[], percentage: number) {
  return partList.some((part) => {
    if (percentage <= part.percentage) {
      renderProgressStep(percentage, part.color)
      return true
    }
  })
}

/**
 * 更新进度条的显示逻辑主入口
 * @returns {Promise<void>}
 */
async function updateProgress(version = revision) {
  if (!alive || version !== revision) return
  const percentage = targetPercentage.value
  const color = props.color
  if (duration.value === 0) {
    percentageDiff.value = 0
    displayPercentage.value = percentage
    if (!isDef(color) || color === '' || (isArray(color) && color.length === 0)) displayColor.value = ''
    else {
      const colorArray = isArray(color) ? color : [color]
      validateColorArray(colorArray)
      const partList = createPartList(colorArray)
      displayColor.value = (partList.find((item) => percentage <= item.percentage) || partList[partList.length - 1])?.color || ''
    }
    return
  }
  if (!isDef(color) || color === '' || (isArray(color) && color.length === 0)) {
    percentageDiff.value = Math.abs(percentage - displayPercentage.value)
    displayColor.value = ''
    await pause()
    if (alive && version === revision) displayPercentage.value = percentage
    return
  }

  const colorArray = isArray(color) ? color : [color]
  validateColorArray(colorArray)
  const partList = createPartList(colorArray)
  if (displayPercentage.value === percentage) {
    const part = partList.find((item) => percentage <= item.percentage) || partList[partList.length - 1]
    displayColor.value = part?.color || ''
    percentageDiff.value = 0
    return
  }
  displayPercentage.value > percentage ? updateProgressBackward(partList, percentage) : updateProgressForward(partList, percentage)
}

/**
 * 判断是否是复合类型的颜色及进度数组
 * @param {string[] | ProgressColor[]} array 要判断的数组
 * @returns {array is ProgressColor[]} 判定依据
 */
function isProgressColorArray(array: string[] | ProgressColor[]): array is ProgressColor[] {
  return array.every(
    (color) => isObj(color) && Object.prototype.hasOwnProperty.call(color, 'color') && Object.prototype.hasOwnProperty.call(color, 'percentage')
  )
}

/**
 * 判断是否是纯字符串形式的颜色数组
 * @param {string[] | ProgressColor[]} array 要判断的数组
 * @returns {array is string[]} 判定依据
 */
function isStringArray(array: string[] | ProgressColor[]): array is string[] {
  return array.every((item) => typeof item === 'string')
}

/**
 * 校验颜色数组结构安全性
 * @param {string[] | ProgressColor[]} colorArray 颜色数组
 * @throws {Error} 未遵循 ProgressColor | String 的数组格式将引发错误
 */
function validateColorArray(colorArray: string[] | ProgressColor[]) {
  const isStrArray = isStringArray(colorArray)
  const isObjArray = isProgressColorArray(colorArray)
  if (!isStrArray && !isObjArray) {
    throw Error('Color must be String or Object with color and percentage')
  }
  if (isObjArray && colorArray.some(({ percentage, color }) => !Number.isFinite(percentage) || percentage < 0 || percentage > 100 || typeof color !== 'string')) {
    throw Error('All the percentage must can be formatted to Number')
  }
}

/**
 * 创建基于刻度的颜色渲染流
 * @param {string[] | ProgressColor[]} colorArray 颜色数组
 * @returns {ProgressColor[]} 对齐进度标识后的颜色数组
 */
function createPartList(colorArray: string[] | ProgressColor[]) {
  const partNum = 100 / colorArray.length
  return isProgressColorArray(colorArray)
    ? [...colorArray].sort((a, b) => a.percentage - b.percentage)
    : colorArray.map((item, index) => ({
        color: item,
        percentage: (index + 1) * partNum
      }))
}

/**
 * 内部驱动方法更新渲染视图及进度
 * @param {number} targetPercent 阶段目标进度
 * @param {string} color 颜色描述
 * @returns {void}
 */
function renderProgressStep(targetPercent: number, color: string) {
  if (!alive || animationTimer !== null || renderTimer !== null) return
  const version = revision
  const stepDuration = duration.value
  percentageDiff.value = Math.abs(targetPercent - displayPercentage.value)
  renderTimer = setTimeout(() => {
    renderTimer = null
    if (!alive || version !== revision) return
    displayPercentage.value = targetPercent
    displayColor.value = color
    animationTimer = setTimeout(() => {
      animationTimer = null
      if (alive && version === revision) updateProgress(version)
    }, percentageDiff.value * stepDuration)
  }, 50)
}
</script>

<template>
  <view :class="`wd-progress ${position.type === 'inner' ? 'wd-progress--inner' : ''} ${status ? 'wd-progress--' + status : ''} ${targetPercentage === 0 ? 'is-zero' : ''} ${customClass}`" :style="customRootStyle">
    <view class="wd-progress__outer">
      <view class="wd-progress__inner" :style="rootStyle">
        <template v-if="position.type === 'inner'">
          <view v-if="!hideText" :class="['wd-progress__label', `is-align-${position.align}`]"><text class="wd-progress__label-text">{{ targetPercentage }}%</text></view>
          <WdIcon v-else-if="status" :custom-class="`wd-progress__label wd-progress__icon is-hide-text is-align-${position.align}`" :name="iconName" />
        </template>
      </view>
    </view>
    <template v-if="position.type === 'outer'">
      <view v-if="!hideText" class="wd-progress__label"><text class="wd-progress__label-text">{{ targetPercentage }}%</text></view>
      <WdIcon v-else-if="status" custom-class="wd-progress__label wd-progress__icon is-hide-text" :name="iconName" :color="isString(color) ? color : ''" />
    </template>
  </view>
</template>
