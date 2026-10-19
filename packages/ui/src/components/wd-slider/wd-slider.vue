/*
 * wd-slider — 滑块
 *
 * Lynx 实现说明（相对 wot-ui 2.3.2 的适配点）：
 * - 拖动状态在后台线程 ref 中维护，进度条样式经计算属性输出
 *   （CONVENTIONS §10：不用 Main Thread Script）；
 * - 轨道宽度经 getRect 一次性测量并缓存（initSlider），不在 touchmove
 *   热路径重复查询（CONVENTIONS §16）；
 * - `@click` → `@tap`；`catchtouchmove` → `@touchmove.stop.prevent`；
 * - wot-ui 的 `:first-child / :last-child`（胶囊刻度首尾透明）与
 *   `a + b` 兄弟选择器无 Lynx 等价物，首尾刻度改用 v-for 索引类名
 *   `is-edge-start / is-edge-end`；
 * - 滑块内置图标：wot-ui 用 multiple-horizontal，内置 iconfont 集无该字形，
 *   改用同语义的 drag；
 * - `cursor` / `pointer-events` / `box-shadow` 等 Web 专有属性删除
 *   （Lynx 不识别）；
 * - customStyle 经 parseStyle 归一为对象（CONVENTIONS §19）；
 *   activeColor / inactiveColor 为 prop 驱动的条件内联键，按 CONVENTIONS §20
 *   的「低风险」类别处理（仅在 prop 由有值变无值时触发）。
 */
<script lang="ts" setup>
import './index.css'

import { computed, getCurrentInstance, onMounted, ref, watch } from 'vue-lynx'
import WdIcon from '../wd-icon/wd-icon.vue'
import { sliderProps, type SliderEmits, type SliderExpose, type SliderMarks, type SliderPopoverVisible, type SliderValue } from './types'
import { deepClone, filterStyle, getRect, isArray, isDef, isEqual, parseStyle, uuid } from '../../common/util'
import { useFormDisabled } from '../../composables/useFormDisabled'
import { useTouch } from '../../composables/useTouch'
import { useAlive } from '../../composables/useAlive'

const props = defineProps(sliderProps)
const emit = defineEmits<SliderEmits>()
const isDisabled = useFormDisabled(props)
const isAlive = useAlive()

const sliderId = ref<string>(`wd-slider-${uuid()}`)
const trackId = ref<string>(`${sliderId.value}-track`)
const touch = useTouch()
const touchIndex = ref<number>(0) // 当前正在拖动的滑块索引 (0 为左/单，1 为右)
const isDragging = ref<boolean>(false) // 是否正在拖动
const { proxy } = getCurrentInstance() as any

/**
 * 轨道长度 (水平为宽度，垂直为高度)
 */
const trackSize = ref<number>(0)
const startValue = ref<SliderValue>(0) // 拖动开始时的初始值
const modelValue = ref<SliderValue>(getInitValue()) // 内部维护的滑块值

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
 */
const barStyle = computed(() => filterStyle(props.inactiveColor ? { background: props.inactiveColor } : {}))

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
 * 宽度/高度样式计算
 */
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

  return filterStyle(props.activeColor ? { ...style, background: props.activeColor } : style)
})

// ----------- 监听器 -----------

/**
 * 监听 modelValue 属性变化
 */
watch(
  () => props.modelValue,
  (newValue) => {
    if (!isEqual(newValue, modelValue.value)) {
      modelValue.value = getInitValue()
    }
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
 * 初始化滑块尺寸
 * 获取轨道的宽高用于后续计算
 */
function initSlider() {
  getRect(`#${trackId.value}`, false, proxy).then((data) => {
    // 度量回调晚于卸载落地时丢弃（真机 9902 晚到 patch 家族）
    if (!isAlive()) return
    if (props.vertical) {
      trackSize.value = Number(data.height)
    } else {
      trackSize.value = Number(data.width)
    }
  })
}

/**
 * 获取事件触点坐标
 * @param event 事件对象
 * @returns {number} 水平取 x，垂直取 y
 */
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
  return parseFloat((props.min + steps * validStep.value).toFixed(10))
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
    modelValue.value = newValue
  }
}

/**
 * 将坐标位置转换为对应的滑块值
 * @param {number} position 相对轨道起点的像素距离
 * @returns {number} 转换后的数值
 */
function positionToValue(position: number): number {
  if (trackSize.value === 0) return props.min
  return (position / trackSize.value) * scope.value + props.min
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
 * 滑块触摸开始
 * @param event 触摸事件
 * @param {number} index 滑块索引
 */
function onTouchStart(event: any, index: number) {
  if (isDisabled.value) return

  touchIndex.value = index
  isDragging.value = true
  touch.touchStart(event)

  startValue.value = deepClone(modelValue.value)
  emit('dragstart', { value: modelValue.value })
}

/**
 * 滑块触摸移动
 * @param event 触摸事件
 */
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

/**
 * 滑块触摸结束
 */
function onTouchEnd() {
  if (isDisabled.value) return

  isDragging.value = false
  emit('dragend', { value: modelValue.value })
  emit('change', modelValue.value)
}

/**
 * 点击轨道跳转
 * @param event 点击事件
 */
function onBarClick(event: any) {
  if (isDisabled.value) return

  // 基于可滑动有效轨道换算点击位置，避免主题内边距造成偏差
  getRect(`#${trackId.value}`, false, proxy).then((data) => {
    // 度量回调晚于卸载落地时丢弃（真机 9902 晚到 patch 家族）
    if (!isAlive()) return
    const pointer = getPointerPosition(event)
    const start = props.vertical ? Number(data.top) : Number(data.left)
    const pos = pointer - start
    handleBarClickAt(pos)
  })
}

/**
 * 处理轨道点击跳转具体逻辑
 * @param {number} position 相对起始点的点击位置
 */
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
  <view :class="rootClass" :style="rootStyle">
    <!-- 最小值文本 -->
    <view v-if="showExtremeValue" class="wd-slider__value wd-slider__value--min">
      <text>{{ min }}</text>
    </view>

    <!-- 轨道 -->
    <view :id="sliderId" :class="barClass" :style="barStyle" @tap.stop="onBarClick">
      <!-- 可滑动有效轨道（用于尺寸测量与 marks 定位） -->
      <view :id="trackId" class="wd-slider__track">
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

      <!-- 进度条 + 滑块 -->
      <view :class="lineClass" :style="lineStyle">
        <!-- 单滑块 / 双滑块左侧 -->
        <view
          :class="`wd-slider__dot ${range ? 'wd-slider__dot--left' : ''}`"
          @touchstart.stop="(e: any) => onTouchStart(e, 0)"
          @touchmove.stop.prevent="onTouchMove"
          @touchend.stop="onTouchEnd"
          @touchcancel.stop="onTouchEnd"
        >
          <view v-if="popoverVisible !== 'never'" class="wd-slider__dot-popover" :class="{ 'is-visible': showDotPopover(0) }">
            <text class="wd-slider__dot-popover-text">{{ dotDisplayValue(0) }}</text>
            <view class="wd-slider__dot-popover-arrow" />
          </view>
          <view class="wd-slider__dot-slider">
            <wd-icon name="drag" size="14px" color="#868a9c" />
          </view>
        </view>

        <!-- 双滑块右侧 -->
        <view
          v-if="range"
          :class="`wd-slider__dot wd-slider__dot--right`"
          @touchstart.stop="(e: any) => onTouchStart(e, 1)"
          @touchmove.stop.prevent="onTouchMove"
          @touchend.stop="onTouchEnd"
          @touchcancel.stop="onTouchEnd"
        >
          <view v-if="popoverVisible !== 'never'" class="wd-slider__dot-popover" :class="{ 'is-visible': showDotPopover(1) }">
            <text class="wd-slider__dot-popover-text">{{ dotDisplayValue(1) }}</text>
            <view class="wd-slider__dot-popover-arrow" />
          </view>
          <view class="wd-slider__dot-slider">
            <wd-icon name="drag" size="14px" color="#868a9c" />
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
