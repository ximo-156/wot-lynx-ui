<template>
  <view
    :class="`wd-floating-panel ${customClass} ${safeAreaInsetBottom ? 'is-safe' : ''}`"
    :style="styleToObject(rootStyle)"
    @touchstart.passive="handleTouchStart"
    @touchmove.passive="handleTouchMove"
    @touchend="handleTouchEnd"
    @touchcancel="handleTouchEnd"
  >
    <view :class="`wd-floating-panel__header`">
      <view :class="`wd-floating-panel__header-bar`"></view>
    </view>

    <!-- Lynx 适配：data-id 为小程序专有属性（Lynx __SetAttribute 不支持），
         改由独立的事件处理函数区分内容区与根节点（语义与 wot-ui 一致）。 -->
    <scroll-view
      :class="`wd-floating-panel__content`"
      :show-scrollbar="showScrollbar"
      scroll-y
      @touchmove.stop.prevent="handleContentTouchMove"
    >
      <slot />
    </scroll-view>
  </view>
</template>

<script setup lang="ts">
import './index.css'
import {computed, onBeforeMount, ref, watch} from 'vue-lynx'
import { floatingPanelProps } from './type'
import { styleToObject, type CSSProperties, addUnit, closest, getSystemInfo, objToStyle } from '../../common/util'
import { useTouch } from '../../composables/useTouch'

const touch = useTouch()

const props = defineProps(floatingPanelProps)
const emit = defineEmits(['update:height', 'height-change'])

const heightValue = ref<number>(props.height)

const DAMP = 0.2 // 阻尼系数
let startY: number // 起始位置
const windowHeight = ref<number>(0)
const dragging = ref<boolean>(false) // 是否正在拖拽

/**
 * anchors 可能被显式传 null（父级状态未初始化），null[0] 会在 computed
 * （渲染路径）抛 TypeError 并崩掉整张卡片，这里统一兜底为空数组。
 */
const safeAnchors = computed<number[]>(() => (Array.isArray(props.anchors) ? props.anchors : []))

const boundary = computed(() => ({
  min: safeAnchors.value[0] ? safeAnchors.value[0] : 100,
  max: safeAnchors.value[safeAnchors.value.length - 1]
    ? safeAnchors.value[safeAnchors.value.length - 1]
    : Math.round(windowHeight.value * 0.6)
}))

const anchors = computed(() => (safeAnchors.value.length >= 2 ? safeAnchors.value : [boundary.value.min, boundary.value.max]))

const rootStyle = computed(() => {
  const style: CSSProperties = {
    height: addUnit(boundary.value.max),
    transform: `translateY(calc(100% + ${addUnit(-heightValue.value)}))`,
    transition: !dragging.value ? `transform ${props.duration}ms cubic-bezier(0.18, 0.89, 0.32, 1.28)` : 'none'
  }

  return `${objToStyle(style)}${props.customStyle}`
})

const updateHeight = (value: number) => {
  heightValue.value = value
  emit('update:height', value)
}

const handleTouchStart = (event: TouchEvent) => {
  touch.touchStart(event)
  dragging.value = true
  startY = -heightValue.value
}

const handleTouchMove = (event: TouchEvent) => {
  touch.touchMove(event)
  const moveY = touch.deltaY.value + startY
  updateHeight(-ease(moveY))
}

// 内容区（scroll-view）上的滑动：contentDraggable 为 false 时不拖动面板
const handleContentTouchMove = (event: TouchEvent) => {
  if (!props.contentDraggable) return
  handleTouchMove(event)
}

const handleTouchEnd = () => {
  dragging.value = false
  updateHeight(closest(anchors.value, heightValue.value))

  if (heightValue.value !== -startY) {
    emit('height-change', { height: heightValue.value })
  }
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
    updateHeight(closest(anchors.value, heightValue.value))
  },
  { immediate: true }
)

onBeforeMount(() => {
  const { windowHeight: _windowHeight } = getSystemInfo()
  windowHeight.value = _windowHeight
})
</script>

