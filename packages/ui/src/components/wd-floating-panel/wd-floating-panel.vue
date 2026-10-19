/*
 * wd-floating-panel — 浮动面板
 *
 * Lynx 实现说明（相对 wot-ui 2.3.2 的适配点）：
 * - 事件映射：touch 事件同名保留；`.passive` 修饰符在 vue-lynx 下会编译成
 *   `onTouchstartPassive` 这类永不派发的键（引擎只派发 touchstart，见
 *   parseEventProp），故删除 .passive（Lynx 无 passive 监听概念，
 *   语义等效）；scroll-view 的 catchtouchmove 按 @touchmove.stop.prevent 书写。
 * - 根 view 绑 touchstart/touchmove/touchend/touchcancel，按 CONVENTIONS §14
 *   在 emits 声明同名事件并转发，避免消费方绑定时与根元素监听合并崩溃。
 * - rootStyle 由参考源的 objToStyle 字符串拼接改为对象语法（CONVENTIONS §19：
 *   字符串 :style 会被 vue-lynx 静默丢弃），并与 parseStyle(customStyle) 合并；
 *   transition 键在跟手/落位两态都显式输出（Style Funnel，§20）。
 * - SCSS：width: 100vw 改用 left/right: 0 贴边撑满（Lynx 视口单位支持不确定）；
 *   ::after 伪元素（把面板底色延伸到屏外，视觉为空操作）删除；cursor /
 *   user-select 等 Web 专有属性删除；constant() 安全区写法删除仅留 env()。
 */
<script lang="ts" setup>
import './index.css'

import { computed, onBeforeMount, ref, watch } from 'vue-lynx'
import { floatingPanelProps } from './types'
import { addUnit, closest, getSystemInfo, parseStyle } from '../../common/util'
import { useTouch } from '../../composables/useTouch'

const touch = useTouch()

const props = defineProps(floatingPanelProps)
const emit = defineEmits(['update:height', 'height-change', 'touchstart', 'touchmove', 'touchend', 'touchcancel'])

const heightValue = ref<number>(props.height)

const DAMP = 0.2 // 阻尼系数
let startY: number // 起始位置
const windowHeight = ref<number>(0)
const dragging = ref<boolean>(false) // 是否正在拖拽

const boundary = computed(() => ({
  min: props.anchors[0] ? props.anchors[0] : 100,
  max: props.anchors[props.anchors.length - 1] ? props.anchors[props.anchors.length - 1] : Math.round(windowHeight.value * 0.6)
}))

const anchors = computed(() => (props.anchors.length >= 2 ? props.anchors : [boundary.value.min, boundary.value.max]))

// Lynx 适配：参考源为 `${objToStyle(style)}${props.customStyle}` 字符串，
// 本地改为对象语法（CONVENTIONS §19）
const rootStyle = computed<Record<string, string>>(() => {
  const style: Record<string, string> = {
    height: addUnit(boundary.value.max),
    transform: `translateY(calc(100% + ${addUnit(-heightValue.value)}))`,
    transition: !dragging.value ? `transform ${props.duration}ms cubic-bezier(0.18, 0.89, 0.32, 1.28)` : 'none'
  }

  return { ...style, ...parseStyle(props.customStyle) }
})

const updateHeight = (value: number) => {
  heightValue.value = value
  emit('update:height', value)
}

const handleTouchStart = (event: any) => {
  touch.touchStart(event)
  dragging.value = true
  startY = -heightValue.value
  // CONVENTIONS §14：根 view 原生事件名声明为 emit 并转发
  emit('touchstart', event)
}

const handleTouchMove = (event: any) => {
  // CONVENTIONS §14：根 view 原生事件名声明为 emit 并转发
  emit('touchmove', event)
  const target = event.currentTarget as any
  if (target.dataset.id == 'content') {
    if (!props.contentDraggable) return
  }
  touch.touchMove(event)
  const moveY = touch.deltaY.value + startY
  updateHeight(-ease(moveY))
}

const handleTouchEnd = (event?: any) => {
  dragging.value = false
  updateHeight(closest(anchors.value, heightValue.value) as number)

  if (heightValue.value !== -startY) {
    emit('height-change', { height: heightValue.value })
  }
  emit('touchend', event)
}

const ease = (y: number) => {
  const absDistance = Math.abs(y)
  const { min, max } = boundary.value

  if (absDistance > max) {
    return -(max + (absDistance - max) * DAMP)
  }

  if (absDistance < min) {
    return -(min - (min - absDistance) * DAMP)
  }

  return y
}

watch(
  () => props.height,
  (value) => {
    heightValue.value = value
  }
)

watch(
  boundary,
  () => {
    updateHeight(closest(anchors.value, heightValue.value) as number)
  },
  { immediate: true }
)

onBeforeMount(() => {
  const { windowHeight: _windowHeight } = getSystemInfo()
  windowHeight.value = _windowHeight
})
</script>

<template>
  <view
    :class="`wd-floating-panel ${customClass} ${safeAreaInsetBottom ? 'is-safe' : ''}`"
    :style="rootStyle"
    @touchstart="handleTouchStart"
    @touchmove="handleTouchMove"
    @touchend="handleTouchEnd"
    @touchcancel="handleTouchEnd"
  >
    <view :class="`wd-floating-panel__header`">
      <view :class="`wd-floating-panel__header-bar`"></view>
    </view>

    <scroll-view
      :class="`wd-floating-panel__content`"
      data-id="content"
      :show-scrollbar="showScrollbar"
      scroll-y
      @touchmove.stop.prevent="handleTouchMove"
    >
      <slot />
    </scroll-view>
  </view>
</template>
