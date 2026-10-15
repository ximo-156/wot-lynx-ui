/*
 * wd-swipe-action — 滑动操作
 *
 * Lynx 实现说明：
 * - 左右操作区经绝对定位叠在内容两侧，内容容器位移露出；
 * - 拖动状态在后台线程 ref 中维护，落位吸附用 transition
 *   （不用 MTS，CONVENTIONS §10）；
 * - 操作区宽度一次性度量并缓存（CONVENTIONS §16）。
 */
<script lang="ts" setup>
import './index.css'

import { computed, getCurrentInstance, onMounted, ref } from 'vue-lynx'
import { swipeActionProps, type SwipeActionPosition, type SwipeActionReason } from './types'
import { callInterceptor } from '../../common/interceptor'
import { getRect, parseStyle } from '../../common/util'
import { useAlive } from '../../composables/useAlive'

const props = defineProps(swipeActionProps)
const emit = defineEmits(['update:modelValue', 'click', 'touchstart', 'touchmove', 'touchend', 'touchcancel'])

const { proxy } = getCurrentInstance() as any
const isAlive = useAlive()

const offsetX = ref<number>(0)
const dragging = ref(false)
const startX = ref(0)
const startOffset = ref(0)
const leftWidth = ref(0)
const rightWidth = ref(0)

const status = computed(() => props.modelValue)

const wrapperStyle = computed<Record<string, string>>(() => {
  const style: Record<string, string> = { transform: `translateX(${offsetX.value}px)` }
  if (!dragging.value) {
    style.transition = 'transform 0.25s cubic-bezier(0.645, 0.045, 0.355, 1)'
  }
  return style
})

onMounted(() => {
  // 操作区宽度一次性度量。回调晚于组件卸载落地时丢弃：在已销毁树上写
  // ref 会触发 vue-lynx 继续 patch，产生晚到的 remove/insert
  // （真机 9902 removeNode 家族）。
  getRect('.wd-swipe-action__left', false, proxy).then((data) => {
    if (!isAlive()) return
    leftWidth.value = Number(data.width) || 0
  })
  getRect('.wd-swipe-action__right', false, proxy).then((data) => {
    if (!isAlive()) return
    rightWidth.value = Number(data.width) || 0
  })
})

function startDrag(event: any) {
  emit('touchstart', event)
  if (props.disabled) return
  dragging.value = true
  startX.value = Number(event.touches?.[0]?.clientX || 0)
  startOffset.value = offsetX.value
}

function onDrag(event: any) {
  emit('touchmove', event)
  if (!dragging.value) return
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

async function finishDrag() {
  if (!dragging.value) return
  dragging.value = false
  // 过半吸附
  if (offsetX.value > leftWidth.value / 2) {
    offsetX.value = leftWidth.value
    setStatus('left')
  } else if (offsetX.value < -rightWidth.value / 2) {
    offsetX.value = -rightWidth.value
    setStatus('right')
  } else {
    offsetX.value = 0
    setStatus('close')
  }
}

async function setStatus(next: SwipeActionPosition) {
  const allowed = await callCloseInterceptor('drag', next)
  // beforeClose 可返回长时间 pending 的 Promise：期间组件可能已卸载
  // （如所在列表项被移除），晚到的 ref 写与 emit 不得作用在死树上。
  if (!isAlive()) return
  if (!allowed) {
    offsetX.value = 0
    return
  }
  emit('update:modelValue', next)
}

function callCloseInterceptor(reason: SwipeActionReason, position: SwipeActionPosition): Promise<boolean> {
  return new Promise((resolve) => {
    if (!props.beforeClose) {
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

function handleClick(position?: SwipeActionPosition) {
  if (props.disabled) return
  if (position) {
    // 点击操作区按钮后关闭（由消费方处理业务）
    offsetX.value = 0
    emit('update:modelValue', 'close')
  }
  emit('click', { position })
}
</script>

<template>
  <view :class="`wd-swipe-action ${disabled ? 'is-disabled' : ''} ${customClass}`" :style="parseStyle(customStyle)" @click.stop="handleClick()" @touchstart="startDrag" @touchmove="onDrag" @touchend="endDrag" @touchcancel="cancelDrag">
    <view class="wd-swipe-action__wrapper" :style="wrapperStyle">
      <view class="wd-swipe-action__left" @click.stop="handleClick('left')">
        <slot name="left" />
      </view>
      <slot />
      <view class="wd-swipe-action__right" @click.stop="handleClick('right')">
        <slot name="right" />
      </view>
    </view>
  </view>
</template>
