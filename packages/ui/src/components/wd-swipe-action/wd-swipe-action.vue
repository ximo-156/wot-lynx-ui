/*
 * wd-swipe-action — 滑动操作
 *
 * Lynx 实现说明：
 * - 左右操作区经绝对定位叠在内容两侧，内容容器位移露出；
 * - 拖动状态在后台线程 ref 中维护，落位吸附用 transition
 *   （不用 MTS，CONVENTIONS §10）；
 * - 操作区宽度一次性度量并缓存（CONVENTIONS §16），选择器带实例
 *   唯一类名——getRect 的静态类名在 Lynx 会命中页面第一个节点，
 *   同页多个滑动行必须按实例度量；
 * - 事件绑定为 @tap：Lynx view 不派发 click（CONVENTIONS §14，
 *   真机 2026-10 缺陷：@click 导致操作按钮点击无响应）；
 * - 多行互斥经 clickoutside 队列：touchstart 时收起其他展开行；
 * - modelValue 外部可编程控制展开/收起（watch → changeState）。
 */
<script lang="ts" setup>
import './index.css'

import { computed, getCurrentInstance, inject, onBeforeMount, onBeforeUnmount, onMounted, ref, watch } from 'vue-lynx'
import { swipeActionProps, type SwipeActionPosition, type SwipeActionReason, type SwipeActionStatus } from './types'
import { closeOther, pushToQueue, removeFromQueue } from '../../common/clickoutside'
import { callInterceptor } from '../../common/interceptor'
import { getRect, parseStyle, uuid } from '../../common/util'
import { useAlive } from '../../composables/useAlive'
import { type Queue, queueKey } from '../../composables/useQueue'
import { useTouch } from '../../composables/useTouch'

const props = defineProps(swipeActionProps)
// 'tap' 必须声明并转发：根 view 绑 @tap，若不在 emits 中声明，消费方的 @tap
// 监听会落入 $attrs 与原生绑定合并成数组 handler，设备上事件到达即抛
// registry TypeError（CONVENTIONS §14，event-registry 全覆盖矩阵守护）
const emit = defineEmits(['update:modelValue', 'click', 'tap', 'touchstart', 'touchmove', 'touchend', 'touchcancel'])

const { proxy } = getCurrentInstance() as any
const isAlive = useAlive()
const touch = useTouch()

/** clickoutside 队列（页面级 useQueue 提供时走队列，否则走全局队列） */
const queue = inject<Queue | null>(queueKey, null)

/** 实例唯一类名：操作区宽度按实例度量，避免命中同页其他实例 */
const instanceId = `wd-swipe-action-${uuid()}`

const offsetX = ref<number>(0)
const dragging = ref(false)
const startX = ref(0)
const startOffset = ref(0)
const leftWidth = ref(0)
const rightWidth = ref(0)

const wrapperStyle = computed<Record<string, string>>(() => {
  // 合并语义（CONVENTIONS §19 注）：Lynx 的 SetStyle 逐属性 Object.assign，
  // 「删键」不会清除元素上已应用的内联属性——跟手时段必须显式置 none
  // （ omission 会让上一次落位的 transition 残留，拖动全程带过渡、不跟手），
  // 落位时再恢复吸附过渡。
  return {
    transform: `translateX(${offsetX.value}px)`,
    transition: dragging.value ? 'none' : 'transform 0.25s cubic-bezier(0.645, 0.045, 0.355, 1)'
  }
})

onBeforeMount(() => {
  if (queue && queue.pushToQueue) {
    queue.pushToQueue(proxy)
  } else {
    pushToQueue(proxy)
  }
})

onBeforeUnmount(() => {
  if (queue && queue.removeFromQueue) {
    queue.removeFromQueue(proxy)
  } else {
    removeFromQueue(proxy)
  }
})

onMounted(() => {
  // 操作区宽度一次性度量。回调晚于组件卸载落地时丢弃：在已销毁树上写
  // ref 会触发 vue-lynx 继续 patch，产生晚到的 remove/insert
  // （真机 9902 removeNode 家族）。
  getRect(`.${instanceId}__left`, false, proxy).then((data) => {
    if (!isAlive()) return
    leftWidth.value = Number(data.width) || 0
  })
  getRect(`.${instanceId}__right`, false, proxy).then((data) => {
    if (!isAlive()) return
    rightWidth.value = Number(data.width) || 0
  })
})

/** 外部 modelValue 变化 → 同步展开/收起状态 */
watch(
  () => props.modelValue,
  (value, old) => {
    changeState(value, old)
  }
)

function changeState(value: SwipeActionStatus, old?: SwipeActionStatus) {
  if (props.disabled) return
  switch (value) {
    case 'close':
      if (offsetX.value === 0) return
      close('value', old)
      break
    case 'left':
      swipeMove(leftWidth.value)
      break
    case 'right':
      swipeMove(-rightWidth.value)
      break
  }
}

function swipeMove(offset = 0) {
  offsetX.value = offset
}

function startDrag(event: any) {
  emit('touchstart', event)
  if (props.disabled) return
  startOffset.value = offsetX.value
  startX.value = Number(event.touches?.[0]?.clientX || 0)
  dragging.value = true
  touch.touchStart(event)
  // 互斥：收起其他已展开的滑动行
  if (queue && queue.closeOther) {
    queue.closeOther(proxy)
  } else {
    closeOther(proxy)
  }
}

function onDrag(event: any) {
  emit('touchmove', event)
  if (!dragging.value || props.disabled) return
  touch.touchMove(event)
  // 方向锁：纵向滑动（页面滚动）不触发横移，避免误触
  if (touch.direction.value === 'vertical') return
  const x = Number(event.touches?.[0]?.clientX || 0)
  let next = startOffset.value + (x - startX.value)
  // 限制范围
  next = Math.min(Math.max(next, -rightWidth.value), leftWidth.value)
  offsetX.value = next
}

async function endDrag(event?: any) {
  emit('touchend', event)
  finishDrag()
}

/** touchcancel 与 touchend 共用收尾逻辑，但分别转发各自的原生事件 */
function cancelDrag(event?: any) {
  emit('touchcancel', event)
  finishDrag()
}

function finishDrag() {
  if (!dragging.value) return
  dragging.value = false
  // 过半吸附
  if (offsetX.value > leftWidth.value / 2) {
    swipeMove(leftWidth.value)
    if (isAlive()) emit('update:modelValue', 'left')
  } else if (offsetX.value < -rightWidth.value / 2) {
    swipeMove(-rightWidth.value)
    if (isAlive()) emit('update:modelValue', 'right')
  } else {
    close('swipe')
  }
}

function callCloseInterceptor(reason: SwipeActionReason, position?: SwipeActionPosition): Promise<boolean> {
  return new Promise((resolve) => {
    if (!props.beforeClose || !position) {
      resolve(true)
      return
    }
    callInterceptor(props.beforeClose, {
      args: [reason, position],
      done: () => resolve(true),
      canceled: () => resolve(false)
    })
  })
}

/**
 * 关闭：先过 beforeClose 拦截器，通过后再归位并同步 modelValue
 * （拦截器 pending 期间组件可能已卸载，晚到写入不得作用在死树上）
 */
async function close(reason: SwipeActionReason, position?: SwipeActionPosition, afterClose?: () => void) {
  const allowed = await callCloseInterceptor(reason, position)
  if (!isAlive()) return
  if (!allowed) return
  swipeMove(0)
  if (props.modelValue !== 'close') {
    emit('update:modelValue', 'close')
  }
  afterClose?.()
}

/** 暴露给 clickoutside 队列的关闭方法 */
defineExpose({ close: () => close('value') })

function handleClick(position?: SwipeActionPosition, event?: any) {
  // 原生 tap 转发（CONVENTIONS §14）：先声明后转发，避免与消费方监听合并
  if (event) emit('tap', event)
  if (props.disabled || offsetX.value === 0) return
  const clickPosition = position || 'inside'
  close('click', clickPosition, () => {
    emit('click', { value: clickPosition })
  })
}
</script>

<template>
  <view
    :class="`wd-swipe-action ${disabled ? 'is-disabled' : ''} ${customClass}`"
    :style="parseStyle(customStyle)"
    @tap.stop="handleClick(undefined, $event)"
    @touchstart="startDrag"
    @touchmove="onDrag"
    @touchend="endDrag"
    @touchcancel="cancelDrag"
  >
    <view class="wd-swipe-action__wrapper" :style="wrapperStyle">
      <view :class="`wd-swipe-action__left ${instanceId}__left`" @tap.stop="handleClick('left')">
        <slot name="left" />
      </view>
      <slot />
      <view :class="`wd-swipe-action__right ${instanceId}__right`" @tap.stop="handleClick('right')">
        <slot name="right" />
      </view>
    </view>
  </view>
</template>
