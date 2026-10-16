/*
 * wd-slider — 滑块
 *
 * Lynx 实现说明：
 * - 拖动状态在后台线程 ref 中维护，进度条样式经计算属性输出
 *   （CONVENTIONS §10：不用 Main Thread Script）；
 * - 轨道宽度经 getRect 一次性测量并缓存（initSlider），不在
 *   touchmove 热路径重复查询（CONVENTIONS §16）；
 * - 跟手时段禁用 CSS transition（拖动中），落位恢复。
 */
<script lang="ts" setup>
import './index.css'

import { computed, getCurrentInstance, onMounted, ref, watch } from 'vue-lynx'
import WdIcon from '../wd-icon/wd-icon.vue'
import { sliderProps, type SliderEmits, type SliderExpose, type SliderMarks, type SliderPopoverVisible, type SliderValue } from './types'
import { deepClone, getRect, isArray, isDef, isEqual, uuid, parseStyle, filterStyle } from '../../common/util'
import { useFormDisabled } from '../../composables/useFormDisabled'
import { useTouch } from '../../composables/useTouch'

const props = defineProps(sliderProps)
const emit = defineEmits<SliderEmits>()
const isDisabled = useFormDisabled(props)

const sliderId = ref<string>(`wd-slider-${uuid()}`)
const trackId = ref<string>(`${sliderId.value}-track`)
const touch = useTouch()
const touchIndex = ref<number>(0)
const isDragging = ref<boolean>(false)
const { proxy } = getCurrentInstance() as any

const trackSize = ref<number>(0)
const startValue = ref<SliderValue>(0)
const modelValue = ref<SliderValue>(getInitValue())

const scope = computed(() => props.max - props.min)

// computed 必须保持纯函数：step<=0 时 calcByStep 会在 touchmove / 长按 100ms
// 定时器热路径上反复求值，原地 console.warn 会刷屏。告警移到 step 变化时
// 触发一次（含首次），computed 只负责取值。
const validStep = computed(() => (props.step > 0 ? props.step : 1))

watch(
  () => props.step,
  (step) => {
    if (step <= 0) {
      console.warn('[wot-lynx-ui] warning(wd-slider): step must be greater than 0')
    }
  },
  { immediate: true }
)

const currentValue = computed<[number, number]>(() => {
  if (props.range && isArray(modelValue.value)) {
    return normalizeRangeValues(modelValue.value as number[])
  }
  return [modelValue.value as number, 0]
})

const hasMarks = computed(() => isDef(props.marks))

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

const rootClass = computed(() => {
  const classes = ['wd-slider', `wd-slider--theme-${props.theme}`]
  if (isDisabled.value) classes.push('is-disabled')
  classes.push(props.vertical ? 'wd-slider--vertical' : 'wd-slider--horizontal')
  if (hasMarks.value) classes.push('is-marks')
  if (props.showExtremeValue) classes.push('wd-slider--with-extreme')
  if (props.range) classes.push('is-range')
  if (props.customClass) classes.push(props.customClass)
  return classes.join(' ')
})

const barClass = computed(() => {
  const classes = ['wd-slider__bar', `wd-slider__bar--${props.theme}`]
  if (isDisabled.value) classes.push('is-disabled')
  return classes.join(' ')
})

const barStyle = computed(() => {
  const style: Record<string, string> = {}
  if (props.inactiveColor) style.background = props.inactiveColor
  return filterStyle(style)
})

const lineClass = computed(() => {
  const classes = ['wd-slider__line', `wd-slider__line--${props.theme}`]
  if (!props.range) classes.push('wd-slider__line--single')
  if (isDisabled.value) classes.push('is-disabled')
  return classes.join(' ')
})

const lineStyle = computed(() => {
  const style: Record<string, string> = {}
  if (scope.value === 0) return filterStyle(style)

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
    style[startProp] = '0'
    style[prop] = `${size}%`
  }
  if (props.activeColor) style.background = props.activeColor
  return filterStyle(style)
})

watch(
  () => props.modelValue,
  (newValue) => {
    if (!isEqual(newValue, modelValue.value)) {
      modelValue.value = getInitValue()
    }
  },
  { deep: true }
)

watch(modelValue, (newVal) => {
  emit('update:modelValue', newVal)
})

onMounted(() => {
  initSlider()
})

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function initSlider() {
  getRect(`#${trackId.value}`, false, proxy).then((data) => {
    if (props.vertical) {
      trackSize.value = Number(data.height)
    } else {
      trackSize.value = Number(data.width)
    }
  })
}

function getPointerPosition(event: any): number {
  const pick = (...keys: string[]) => {
    for (const key of keys) {
      const v = event.detail?.[key] ?? event[key] ?? event.touches?.[0]?.[key]
      if (isDef(v)) return Number(v)
    }
    return 0
  }
  return props.vertical ? pick('y', 'clientY') : pick('x', 'clientX')
}

function getInitValue(): SliderValue {
  if (props.range) {
    if (isArray(props.modelValue)) {
      return normalizeRangeValues(props.modelValue as number[])
    }
    return [props.min, props.max]
  }
  return clamp(props.modelValue as number, props.min, props.max)
}

function normalizeRangeValues(value: number[]): [number, number] {
  if (!Array.isArray(value) || value.length < 2) {
    console.warn('[wot-lynx-ui] warning(wd-slider): range value should be an array with at least 2 elements')
    return [props.min, props.max]
  }
  const left = clamp(value[0], props.min, props.max)
  const right = clamp(value[1], props.min, props.max)
  return left > right ? [right, left] : [left, right]
}

function calcByStep(value: number): number {
  value = clamp(value, props.min, props.max)
  const steps = Math.round((value - props.min) / validStep.value)
  return parseFloat((props.min + steps * validStep.value).toFixed(10))
}

function updateValue(value: SliderValue) {
  let newValue: SliderValue = deepClone(value)
  if (props.range && isArray(newValue)) {
    newValue = normalizeRangeValues(newValue as number[]).map((v) => calcByStep(v)) as [number, number]
  } else {
    newValue = calcByStep(newValue as number)
  }
  if (!isEqual(newValue, modelValue.value)) {
    modelValue.value = newValue
  }
}

function positionToValue(position: number): number {
  if (trackSize.value === 0) return props.min
  return (position / trackSize.value) * scope.value + props.min
}

function scaleItemClass(val: number): string {
  const classes = ['wd-slider__scale-item', `wd-slider__scale-item--${props.theme}`]
  const isActive = Array.isArray(modelValue.value)
    ? val >= modelValue.value[0] && val <= modelValue.value[1]
    : val <= (modelValue.value as number)
  if (isActive) classes.push('is-active')
  if (isDisabled.value) classes.push('is-disabled')
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

function onTouchStart(event: any, index: number) {
  if (isDisabled.value) return
  touchIndex.value = index
  isDragging.value = true
  touch.touchStart(event)
  startValue.value = deepClone(modelValue.value)
  emit('dragstart', { value: modelValue.value })
}

function onTouchMove(event: any) {
  if (isDisabled.value) return
  // trackSize 为 0（getRect 失败 / 节点未渲染 / 返回零矩形）时以 0 作
  // 除数会得到 Infinity/NaN，拖出 NaN 值写入 modelValue。与
  // positionToValue 的零值守卫一致：先补一次度量并丢弃本帧。
  if (trackSize.value === 0) {
    initSlider()
    return
  }
  touch.touchMove(event)
  const delta = props.vertical ? touch.deltaY.value : touch.deltaX.value
  const diff = (delta / trackSize.value) * scope.value
  let newValue = deepClone(startValue.value)
  if (props.range && isArray(newValue)) {
    ;(newValue as number[])[touchIndex.value] += diff
  } else {
    newValue = (newValue as number) + diff
  }
  updateValue(newValue)
  emit('dragmove', { value: modelValue.value })
}

function onTouchEnd() {
  if (isDisabled.value) return
  isDragging.value = false
  emit('dragend', { value: modelValue.value })
  emit('change', modelValue.value)
}

function onBarClick(event: any) {
  if (isDisabled.value) return
  getRect(`#${trackId.value}`, false, proxy).then((data) => {
    const pointer = getPointerPosition(event)
    const start = props.vertical ? Number(data.top) : Number(data.left)
    handleBarClickAt(pointer - start)
  })
}

function handleBarClickAt(position: number) {
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
</script>

<template>
  <view :class="rootClass" :style="parseStyle(customStyle)">
    <!-- 最小值文本 -->
    <view v-if="showExtremeValue" class="wd-slider__value wd-slider__value--min">
      <text>{{ min }}</text>
    </view>

    <!-- 轨道 -->
    <view :id="sliderId" :class="barClass" :style="barStyle" @tap.stop="onBarClick">
      <view :id="trackId" class="wd-slider__track">
        <template v-if="hasMarks">
          <view
            v-for="(mark, index) in scaleList"
            :key="index"
            :class="scaleItemClass(mark.val)"
            :style="scaleItemStyle(mark.position)"
          >
            <view
              v-if="mark.label"
              :class="`wd-slider__scale-desc ${theme === 'capsule' ? 'wd-slider__scale-desc--capsule' : 'wd-slider__scale-desc--default'}`"
            >
              <text>{{ mark.label }}</text>
            </view>
          </view>
        </template>

        <!-- 进度条 + 滑块 -->
        <view :class="lineClass" :style="lineStyle">
          <view
            :class="['wd-slider__dot', range ? 'wd-slider__dot--left' : '']"
            @touchstart.stop="(e: any) => onTouchStart(e, 0)"
            @touchmove.stop.prevent="onTouchMove"
            @touchend.stop="onTouchEnd"
            @touchcancel.stop="onTouchEnd"
          >
            <view
              v-if="popoverVisible !== 'never'"
              class="wd-slider__dot-popover"
              :class="{ 'is-visible': showDotPopover(0) }"
            >
              <text class="wd-slider__dot-popover-text">{{ dotDisplayValue(0) }}</text>
              <view class="wd-slider__dot-popover-arrow" />
            </view>
            <view class="wd-slider__dot-slider">
              <wd-icon name="drag" size="14px" color="#8B93A3" />
            </view>
          </view>

          <view
            v-if="range"
            class="wd-slider__dot wd-slider__dot--right"
            @touchstart.stop="(e: any) => onTouchStart(e, 1)"
            @touchmove.stop.prevent="onTouchMove"
            @touchend.stop="onTouchEnd"
            @touchcancel.stop="onTouchEnd"
          >
            <view
              v-if="popoverVisible !== 'never'"
              class="wd-slider__dot-popover"
              :class="{ 'is-visible': showDotPopover(1) }"
            >
              <text class="wd-slider__dot-popover-text">{{ dotDisplayValue(1) }}</text>
              <view class="wd-slider__dot-popover-arrow" />
            </view>
            <view class="wd-slider__dot-slider">
              <wd-icon name="drag" size="14px" color="#8B93A3" />
            </view>
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
