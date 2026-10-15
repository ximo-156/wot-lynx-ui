/*
 * wd-segmented — 分段器
 *
 * Lynx 实现说明：
 * - card 主题的滑块位置经 getRect 一次性度量全部选项宽度并缓存
 *   （CONVENTIONS §16：不在触摸热路径重复度量；此处仅挂载后与
 *   值变化时度量），位移用 transform: translateX + transition；
 * - outline 主题无滑块，仅样式切换；
 * - 振动反馈经 common/uni 兼容层下发，失败静默。
 */
<script lang="ts" setup>
import './index.css'

import { computed, getCurrentInstance, onMounted, reactive, watch } from 'vue-lynx'
import { segmentedProps, type SegmentedExpose, type SegmentedOption } from './types'
import { addUnit, filterStyle, getRect, isEqual, isObj, pause, parseStyle } from '../../common/util'
import { uni } from '../../common/uni'
import { useAlive } from '../../composables/useAlive'

const props = defineProps(segmentedProps)
const emit = defineEmits(['update:value', 'change', 'click'])
const isAlive = useAlive()

const state = reactive({
  activeIndex: 0,
  activeStyle: {} as Record<string, string>
})

const optionValue = (option: string | number | SegmentedOption): string | number => {
  return isObj(option) ? option.value : option
}

const optionDisabled = (option: string | number | SegmentedOption): boolean => {
  return props.disabled || (isObj(option) ? option.disabled === true : false)
}

watch(
  () => props.value,
  () => {
    updateCurrentIndex()
    updateActiveStyle()
    if (props.vibrateShort) {
      uni.vibrateShort({ fail: () => {} })
    }
  }
)

const { proxy } = getCurrentInstance() as any

onMounted(async () => {
  updateCurrentIndex()
  await pause()
  if (!isAlive()) return
  updateActiveStyle(false)
})

/** 更新滑块位置（card 主题） */
function updateActiveStyle(animation: boolean = true) {
  if (props.theme === 'outline') return

  getRect('.wd-segmented__item', true, proxy).then((rects: any[]) => {
    // 度量回调晚于组件卸载落地时丢弃（真机 9902 晚到 patch 家族）
    if (!isAlive()) return
    const rect = rects[state.activeIndex]
    if (!rect) return
    const style: Record<string, string> = {
      position: 'absolute',
      width: addUnit(rect.width!),
      'z-index': '0'
    }
    const left = rects.slice(0, state.activeIndex).reduce((prev, curr) => prev + Number(curr.width), 0)
    if (left) {
      style.transform = `translateX(${left}px)`
    }
    if (animation) {
      style.transition = 'transform 0.2s cubic-bezier(0.645, 0.045, 0.355, 1)'
    }
    state.activeStyle = filterStyle(style)
  })
}

function updateValue(newValue: string | number, option: string | number | SegmentedOption) {
  if (!isEqual(newValue, props.value)) {
    emit('update:value', newValue)
    emit('change', isObj(option) ? option : { value: newValue })
  }
}

/** 根据当前值更新激活索引，未匹配时回落第一项 */
function updateCurrentIndex() {
  const index = props.options.findIndex((option) => isEqual(optionValue(option), props.value))
  if (index >= 0) {
    state.activeIndex = index
  } else {
    updateValue(optionValue(props.options[0]), props.options[0])
  }
}

function handleClick(option: string | number | SegmentedOption, index: number) {
  if (optionDisabled(option)) return
  const value = optionValue(option)
  state.activeIndex = index
  updateActiveStyle()
  updateValue(value, option)
  emit('click', isObj(option) ? option : { value })
}

const rootClass = computed(() => {
  const classes = ['wd-segmented']
  if (props.theme) classes.push(`wd-segmented--${props.theme}`)
  if (props.disabled) classes.push('is-disabled')
  if (props.customClass) classes.push(props.customClass)
  return classes.join(' ')
})

defineExpose<SegmentedExpose>({
  updateActiveStyle
})
</script>

<template>
  <view :class="rootClass" :style="parseStyle(customStyle)">
    <view
      v-for="(option, index) in options"
      :key="index"
      :class="[
        'wd-segmented__item',
        state.activeIndex === index ? 'is-active' : '',
        isObj(option) && option.disabled ? 'is-disabled' : ''
      ]"
      @tap="handleClick(option, index)"
    >
      <view class="wd-segmented__item-label">
        <slot v-if="$slots.label" name="label" :option="isObj(option) ? option : { value: option }" />
        <text v-else>{{ isObj(option) ? option.value : option }}</text>
      </view>
    </view>
    <view v-if="theme === 'card'" class="wd-segmented__slider" :style="state.activeStyle" />
  </view>
</template>
