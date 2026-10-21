/*
 * wd-tabbar — 标签栏
 *
 * Lynx 实现说明（相对 wot-ui 的适配点）：
 * - rootStyle：参考源以 objToStyle 字符串拼接 customStyle 后绑定，Lynx 的
 *   patchProp 对字符串 style 会静默丢弃（CONVENTIONS §19），改为对象语法并经
 *   parseStyle(customStyle) 合并；z-index 经 Style Funnel（defineStyleKeys +
 *   resolveStyle）输出完整键集（CONVENTIONS §20，该 prop 默认 10 恒有值）；
 * - 占位 view 的 height 由 getRect('.wd-tabbar') 度量后经 addUnit 下发，
 *   度量不可用时 getRect 降级为零矩形（common/util.ts 兜底，不 reject）；
 *   未度量时经 Style Funnel 输出中性值 auto（参考源 addUnit('') 会产出
 *   非法值 'px'，Lynx 下同上但显式中性值更稳，CONVENTIONS §20）；
 * - 安全区：保留 env(safe-area-inset-bottom)（Lynx 写法），删除 Web 专有的
 *   constant(safe-area-inset-bottom) 重复声明；
 * - is-border 的参考源 halfPixelBorder 为 ::after 伪元素描边，Lynx 无伪元素，
 *   改为主元素真实 border-top（1ppx），参考源 mixin 前置的 position: relative
 *   显式保留；
 * - round 变体 box-shadow 按参考源保留（PORTING §4 未列入删除清单，令牌定制点
 *   不丢失）；
 * - 原生优先重写（NATIVE-REWRITE §3.1）：占位根 view（SFC 根）经 Style Funnel
 *   常量键显式下发 display: flex + flex-direction: column 三件套——该类名仅在
 *   round + fixed + placeholder + 安全区场景挂载，未挂载时根 view 不得退回
 *   Lynx 默认 linear 布局；内部 .wd-tabbar 亦显式 flex-direction: row（SCSS）。
 */
<script lang="ts" setup>
import './index.css'

import { computed, nextTick, onMounted, ref, watch } from 'vue-lynx'
import type { TabbarItem } from '../wd-tabbar-item/types'
import { addUnit, getRect, isDef, parseStyle, uuid } from '../../common/util'
import { useChildren } from '../../composables/useChildren'
import { callInterceptor } from '../../common/interceptor'
import { defineStyleKeys, resolveStyle } from '../../common/style'
import { TABBAR_KEY, tabbarProps } from './types'
import { useAlive } from '../../composables/useAlive'

const props = defineProps(tabbarProps)
const emit = defineEmits(['change', 'update:modelValue'])
const isAlive = useAlive()
const tabbarId = `wd-tabbar-${uuid()}`
let changeRequest = 0
let heightRequest = 0
watch(() => props.modelValue, () => { ++changeRequest }, { flush: 'sync' })

const height = ref<number | string>('') // 占位高度

const { linkChildren } = useChildren(TABBAR_KEY)

linkChildren({
  props,
  setChange
})

/** 占位根三件套（NATIVE-REWRITE §3.1）：display / flex-direction 为常量键，
    随每帧完整下发；z-index 中性值：prop 默认 10，恒有值；经 Style Funnel
    保证键集完整 */
const ROOT_STYLE = defineStyleKeys({ 'z-index': '10' })

const rootStyle = computed(() => {
  return resolveStyle(ROOT_STYLE, { 'z-index': isDef(props.zIndex) ? String(props.zIndex) : '' })
})

/** 占位高度中性值 auto：未度量时与不设置视觉等价（键集完整，CONVENTIONS §20） */
const PLACEHOLDER_STYLE = defineStyleKeys({
  display: 'flex',
  'flex-direction': 'column',
  height: 'auto'
})

const placeholderStyle = computed(() => {
  return resolveStyle(PLACEHOLDER_STYLE, { height: height.value === '' ? '' : addUnit(height.value) })
})

watch(
  [() => props.fixed, () => props.placeholder, () => props.shape, () => props.safeAreaInsetBottom, () => props.bordered, () => props.customStyle, () => props.customClass],
  () => {
    ++heightRequest
    nextTick(() => { if (isAlive()) setPlaceholderHeight() })
  },
  { deep: true, immediate: false }
)

onMounted(() => {
  if (props.fixed && props.placeholder) {
    nextTick(() => {
      setPlaceholderHeight()
    })
  }
})

/**
 * 子项状态变更
 * @param child 子项
 */
function setChange(child: TabbarItem, isCurrent: () => boolean = () => true) {
  const request = ++changeRequest
  if (!isAlive()) return
  const active = child.name
  if (active === props.modelValue) {
    return
  }
  const change = () => {
    if (!isAlive() || request !== changeRequest || !isCurrent()) return
    emit('update:modelValue', active)
    emit('change', {
      value: active
    })
  }
  callInterceptor(props.beforeChange, { args: [active], done: change })
}

function setPlaceholderHeight() {
  const request = ++heightRequest
  if (!props.fixed || !props.placeholder) {
    height.value = ''
    return
  }

  getRect(`#${tabbarId}`, false).then((res) => {
    if (!isAlive() || request !== heightRequest || !props.fixed || !props.placeholder) return
    height.value = Number(res.height)
  })
}
</script>

<template>
  <view :class="{ 'wd-tabbar__placeholder': fixed && placeholder && safeAreaInsetBottom && shape === 'round' }" :style="placeholderStyle">
    <view
      :id="tabbarId"
      :class="`wd-tabbar wd-tabbar--${shape} ${customClass} ${fixed ? 'is-fixed' : ''} ${safeAreaInsetBottom ? 'is-safe' : ''} ${
        bordered ? 'is-border' : ''
      }`"
      :style="{ ...rootStyle, ...parseStyle(customStyle) }"
    >
      <slot></slot>
    </view>
  </view>
</template>
