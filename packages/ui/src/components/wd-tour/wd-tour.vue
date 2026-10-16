/*
 * wd-tour — 新手引导
 *
 * Lynx 实现说明：
 * - 遮罩 + 高亮框 + 提示气泡三段式；目标元素位置经 getRect 度量（切换步骤 /
 *   显示时一次性度量，CONVENTIONS §16）；
 * - Lynx 无 canvas 遮罩：高亮框用一个带超大 spread box-shadow 的 view 在目标处
 *   「挖洞」——spread 覆盖整屏形成遮罩，view 自身透明区透出目标元素；
 * - 高亮框 / 气泡定位全部由内联样式（对象语法，CONVENTIONS §19）驱动，
 *   SCSS 不再写死 left/top；
 * - 气泡默认置于目标下方，下方空间不足且上方放得下时移到上方；
 * - 步骤切换经内部 current 状态驱动，派发 skip / prev / next 事件。
 */
<script lang="ts" setup>
import './index.css'

import { computed, nextTick, onMounted, ref, watch } from 'vue-lynx'
import WdButton from '../wd-button/wd-button.vue'
import { tourProps, type TourStep } from './types'
import { useTranslate } from '../../composables/useTranslate'
import { getRect, getSystemInfo, uuid } from '../../common/util'
import { useAlive } from '../../composables/useAlive'

const props = defineProps(tourProps)
const emit = defineEmits(['change', 'finish', 'skip', 'prev', 'next', 'update:modelValue', 'update:current'])

const { translate } = useTranslate('tour')
const isAlive = useAlive()

const bubbleId = `wd-tour-bubble-${uuid()}`

const current = ref(props.current)

watch(
  () => props.current,
  (val) => {
    current.value = val
  }
)

const step = computed<TourStep | undefined>(() => props.steps[current.value])

const isLast = computed(() => current.value >= props.steps.length - 1)
const isFirst = computed(() => current.value <= 0)

// 目标元素度量结果（视口坐标）与气泡实测高度
const targetRect = ref({ left: 0, top: 0, width: 0, height: 0 })
const measured = ref(false)
const bubbleHeight = ref(0)

/** 度量气泡高度（用于上方/下方判定），一次性 */
function measureBubble() {
  getRect(`#${bubbleId}`)
    .then((rect) => {
      if (!isAlive() || !rect) return
      if (rect.height) bubbleHeight.value = rect.height
    })
    .catch(() => {
      // 度量失败用估算高度兜底
    })
}

/** 切换步骤 / 显示时度量目标元素，再度量气泡 */
function measure() {
  const el = step.value?.element
  if (!el || !props.modelValue) {
    measured.value = false
    return
  }
  getRect(el)
    .then((rect) => {
      if (!isAlive()) return
      if (!rect || !rect.width) {
        // 目标未命中 / 不可度量：不渲染高亮与气泡，保持页面可用
        measured.value = false
        return
      }
      targetRect.value = {
        left: rect.left || 0,
        top: rect.top || 0,
        width: rect.width || 0,
        height: rect.height || 0
      }
      measured.value = true
      // 气泡渲染后度量其高度
      nextTick(measureBubble)
    })
    .catch(() => {
      measured.value = false
    })
}

watch(
  () => [current.value, props.modelValue],
  () => {
    measure()
  }
)

onMounted(() => {
  measure()
})

const highlightOffset = computed(() => step.value?.offset ?? props.offset)

/** 高亮框样式：position/width/height 由目标度量 + offset 得出，遮罩经 box-shadow */
const highlightStyle = computed<Record<string, string>>(() => {
  if (!measured.value || targetRect.value.width === 0) return {} as Record<string, string>
  const off = highlightOffset.value
  const style: Record<string, string> = {
    position: 'absolute',
    left: `${targetRect.value.left - off}px`,
    top: `${targetRect.value.top - off}px`,
    width: `${targetRect.value.width + off * 2}px`,
    height: `${targetRect.value.height + off * 2}px`,
    'border-radius': `${props.borderRadius}px`
  }
  if (props.mask) {
    style['box-shadow'] = `0 0 0 9999px ${props.maskColor || 'rgba(0, 0, 0, 0.6)'}`
  }
  return style
})

/** 气泡样式：默认目标下方，空间不足时上方；水平以目标中心对齐并夹紧在屏内 */
const bubbleStyle = computed<Record<string, string>>(() => {
  if (!measured.value || targetRect.value.width === 0) return {} as Record<string, string>
  const { windowWidth, windowHeight } = getSystemInfo()
  const gap = 12
  const bubbleW = 280
  const off = highlightOffset.value
  const targetLeft = targetRect.value.left - off
  const targetTop = targetRect.value.top - off
  const targetW = targetRect.value.width + off * 2
  const targetH = targetRect.value.height + off * 2

  let left = targetLeft + targetW / 2 - bubbleW / 2
  left = Math.max(8, Math.min(left, windowWidth - bubbleW - 8))

  const belowTop = targetTop + targetH + gap
  const estimatedH = bubbleHeight.value || 140
  let top = belowTop
  if (belowTop + estimatedH > windowHeight - 8 && targetTop - gap - estimatedH > 8) {
    top = targetTop - gap - estimatedH
  }
  return {
    position: 'absolute',
    left: `${left}px`,
    top: `${top}px`,
    width: `${bubbleW}px`
  } as Record<string, string>
})

function next() {
  emit('next', { current: current.value })
  if (isLast.value) {
    finish()
    return
  }
  current.value += 1
  emit('update:current', current.value)
  emit('change', { current: current.value })
}

function prev() {
  emit('prev', { current: current.value })
  if (isFirst.value) return
  current.value -= 1
  emit('update:current', current.value)
  emit('change', { current: current.value })
}

function finish() {
  emit('finish')
  emit('update:modelValue', false)
}

function skip() {
  emit('skip')
  emit('update:modelValue', false)
}
</script>

<template>
  <view v-if="modelValue" class="wd-tour">
    <!-- 高亮框（兼遮罩挖洞）：box-shadow spread 形成遮罩，目标区透出 -->
    <view v-if="step && measured" class="wd-tour__highlight" :style="highlightStyle" />
    <!-- 提示气泡：定位由内联样式驱动 -->
    <view v-if="step && measured" class="wd-tour__bubble" :id="bubbleId" :style="bubbleStyle">
      <view v-if="step.title" class="wd-tour__title">
        <text>{{ step.title }}</text>
      </view>
      <view class="wd-tour__content">
        <text>{{ step.content }}</text>
      </view>
      <view class="wd-tour__footer">
        <text class="wd-tour__skip" @tap="skip">{{ translate('skip') }}</text>
        <view class="wd-tour__actions">
          <wd-button v-if="!isFirst" size="mini" variant="plain" @tap="prev">{{ prevText || translate('prev') }}</wd-button>
          <wd-button type="primary" size="mini" @tap="next">
            {{ isLast ? (finishText || translate('finish')) : (nextText || translate('next')) }}
          </wd-button>
        </view>
      </view>
    </view>
  </view>
</template>
