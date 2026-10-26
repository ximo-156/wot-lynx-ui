/*
 * wd-segmented — 分段器
 *
 * Lynx 实现说明（相对 wot-ui 2.3.2 的适配点）：
 * - card 主题的滑块位置经 getRect 一次性度量全部选项宽度并缓存
 *   （CONVENTIONS §16：不在触摸热路径重复度量；此处仅挂载后与
 *   值变化时度量），位移用 transform: translateX + transition，且经
 *   Style Funnel（defineStyleKeys + resolveStyle）输出完整键集，
 *   选中首项时显式写 translateX(0px)（CONVENTIONS §20）；
 * - outline 主题的外描边：wot-ui 用 `&::before` 覆盖层绘制，Lynx 无伪元素，
 *   改为主元素真实 border；
 * - outline 主题选项间的分隔线：wot-ui 用 `.wd-segmented__item +
 *   .wd-segmented__item` 相邻兄弟选择器，Lynx 无等价物，改为 v-for 索引类名
 *   `is-not-first`；
 * - `cursor: no-drop` 等 Web 专有属性删除；
 * - `@click` → `@tap`；customStyle 经 parseStyle 归一为对象（CONVENTIONS §19）。
 */
<script lang="ts" setup>
import './index.css'

import { computed, getCurrentInstance, onMounted, reactive, watch } from 'vue-lynx'
import { segmentedProps, type SegmentedExpose, type SegmentedOption } from './types'
import { addUnit, getRect, isEqual, isObj, pause, parseStyle, uuid } from '../../common/util'
import { defineStyleKeys, resolveStyle } from '../../common/style'
import { uni } from '../../common/uni'
import { useAlive } from '../../composables/useAlive'

const props = defineProps(segmentedProps)
const emit = defineEmits(['update:value', 'change', 'click'])
const isAlive = useAlive()
let styleRequest = 0
const segmentedId = `wd-segmented-${uuid()}`

/**
 * 滑块可切换的全部样式键 + 中性值（CONVENTIONS §20）。
 *
 * Lynx 的 SetStyle 是逐属性合并语义：省略某个键不会清除元素上已经应用的内联
 * 属性。经 Style Funnel 统一下发后，无论条件如何翻转，键集始终完整——
 * 选中首项（位移为 0）时 `transform` 仍写 `translateX(0px)`，滑块必然归位。
 */
const SLIDER_STYLE = defineStyleKeys({
  position: 'absolute',
  width: '0px',
  'z-index': '0',
  transform: 'translateX(0px)',
  transition: 'none'
})

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

/**
 * 当前激活项是否处于禁用状态
 * 检查全局禁用或当前激活选项的禁用状态
 */
const activeDisabled = computed(() => {
  const active = props.options[state.activeIndex]
  return props.disabled || (active && isObj(active) ? active.disabled : false)
})

watch(
  () => props.value,
  () => {
    updateCurrentIndex()
    updateActiveStyle()
    if (props.vibrateShort) {
      uni.vibrateShort({ fail: () => {} })
    }
  },
  {
    immediate: false
  }
)

watch([() => props.options, () => props.theme], () => {
  updateCurrentIndex()
  updateActiveStyle(false)
}, { deep: true })

const { proxy } = getCurrentInstance() as any

onMounted(async () => {
  updateCurrentIndex()
  await pause()
  if (!isAlive()) return
  updateActiveStyle(false)
})

/**
 * 更新滑块的位置和样式
 * 仅在 card 主题下执行,outline 主题下滑块隐藏无需更新
 * @param {boolean} animation 是否启用过渡动画,默认为 true
 */
function updateActiveStyle(animation: boolean = true) {
  const request = ++styleRequest
  const index = state.activeIndex
  if (props.theme === 'outline' || index < 0 || !props.options.length) {
    state.activeStyle = resolveStyle(SLIDER_STYLE)
    return
  }

  getRect(`#${segmentedId} .wd-segmented__item`, true, proxy).then((rects: any[]) => {
    // 度量回调晚于组件卸载落地时丢弃（真机 9902 晚到 patch 家族）
    if (!isAlive() || request !== styleRequest) return
    const rect = rects[index]
    if (!rect) return
    const left = rects.slice(0, index).reduce((prev, curr) => prev + Number(curr.width), 0)
    // 经 Style Funnel 下发：键集恒完整（transform 无条件写入 translateX(left)，
    // 归零时写 translateX(0px) 而非省略），从根上消除 SetStyle 合并语义下的脏值残留。
    // 同类缺陷参见 wd-transition 的 display、wd-swipe-action 的 transition。
    state.activeStyle = resolveStyle(SLIDER_STYLE, {
      width: addUnit(rect.width!),
      transform: `translateX(${left}px)`,
      transition: animation ? 'transform 0.2s cubic-bezier(0.645, 0.045, 0.355, 1)' : 'none'
    })
  })
}

/**
 * 更新选中值并触发相应事件
 * @param {string | number} newValue 新的选中值
 * @param {string | number | SegmentedOption} option 对应的选项数据
 */
function updateValue(newValue: string | number, option: string | number | SegmentedOption) {
  if (!isEqual(newValue, props.value)) {
    emit('update:value', newValue)
    emit('change', isObj(option) ? option : { value: newValue })
  }
}

/**
 * 根据当前值更新激活项的索引
 * 如果未找到匹配项,则默认选中第一项
 */
function updateCurrentIndex() {
  // options 为空数组时早退：否则会 emit update:value=undefined
  if (!props.options.length) {
    state.activeIndex = -1
    return
  }
  const index = props.options.findIndex((option) => isEqual(optionValue(option), props.value))
  if (index >= 0) {
    state.activeIndex = index
  } else {
    state.activeIndex = 0
    updateValue(optionValue(props.options[0]), props.options[0])
  }
}

/**
 * 处理选项点击事件
 * @param {string | number | SegmentedOption} option 被点击的选项
 * @param {number} index 选项索引
 */
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
  if (props.customClass) classes.push(props.customClass)
  return classes.join(' ')
})

/** 根节点样式：customStyle 经 parseStyle 归一为对象（CONVENTIONS §19） */
const rootStyle = computed(() => parseStyle(props.customStyle))

defineExpose<SegmentedExpose>({
  updateActiveStyle
})
</script>

<template>
  <view :id="segmentedId" :class="rootClass" :style="rootStyle">
    <view
      v-for="(option, index) in options"
      :key="index"
      :class="[
        'wd-segmented__item',
        state.activeIndex === index ? 'is-active' : '',
        optionDisabled(option) ? 'is-disabled' : '',
        index > 0 ? 'is-not-first' : ''
      ]"
      @tap="handleClick(option, index)"
    >
      <view class="wd-segmented__item-label">
        <slot v-if="$slots.label" name="label" :option="isObj(option) ? option : { value: option }" />
        <!-- Lynx 适配（真机 2026-10-26 巡检）：省略号不走 CSS 的
             overflow:hidden + text-overflow:ellipsis —— 真机上该组合会把
             文字整段裁空（分段器只剩灰底、无「日/周/月」，图二缺陷），
             改用 Lynx 原生 text-maxline 单行截断。 -->
        <text v-else text-maxline="1">{{ isObj(option) ? option.value : option }}</text>
      </view>
    </view>
    <view v-if="theme === 'card'" :class="['wd-segmented__slider', activeDisabled ? 'is-disabled' : '']" :style="state.activeStyle" />
  </view>
</template>
