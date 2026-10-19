/*
 * wd-swipe-action — 滑动操作
 *
 * Lynx 实现说明（相对 wot-ui 2.3.2 的适配点）：
 * - 脚本逻辑（状态机 / 阈值 / 边界）逐段对齐参考源：originOffset 记录滑动
 *   起点偏移，endDrag 按 0.3 阈值判定回归/展开，close 经 beforeClose 拦截器；
 * - 操作区宽度：参考源在 touchmove 热路径里反复 getRect（Promise.all 两次
 *   线程间往返），按 CONVENTIONS §16 改为挂载后一次性度量并缓存，触摸热路径
 *   只读缓存；选择器带实例唯一类名（getRect 的静态类名在 Lynx 会命中页面
 *   第一个节点，同页多个滑动行必须按实例度量）；
 * - 参考源 onDrag 在横向位移时 event.preventDefault()/stopPropagation() 阻止
 *   页面跟随滚动：Lynx 的事件修饰符是静态绑定、无法按方向条件阻止，若整体
 *   catch touchmove 会连带阻断纵向滚动，故不放修饰符（纵向仍可滚页面）；
 * - 内联样式：参考源为 objToStyle 字符串拼接，改为对象语法（CONVENTIONS
 *   §19）；transform / transition 两个键恒写（CONVENTIONS §20 Style Funnel：
 *   跟手时段显式置 none，省略键会让上一次落位的过渡残留、拖动不跟手）；
 *   位移用 translateX（与 translate3d 等价，Lynx 下更直观），过渡时长与缓动
 *   取参考源的 0.6s cubic-bezier(0.18, 0.89, 0.32, 1)；
 * - @click → @tap（CONVENTIONS §14：Lynx view 不存在 click 事件）；根 view 的
 *   touch 事件在 emits 声明并转发（同名监听不声明会落入 $attrs 与原生绑定
 *   合并成数组 handler，事件派发即抛注册表 TypeError）；
 * - 多行互斥经 clickoutside 队列：touchstart 时收起其他展开行；
 * - 异步拦截器 / 度量回调落地前组件可能已卸载，写 ref 前判活（真机 9902
 *   晚到 patch 家族）。
 */
<script lang="ts" setup>
import './index.css'

import { computed, getCurrentInstance, inject, onBeforeMount, onBeforeUnmount, onMounted, ref, watch } from 'vue-lynx'
import { swipeActionProps, type SwipeActionEmits, type SwipeActionExpose, type SwipeActionPosition, type SwipeActionReason, type SwipeActionStatus } from './types'
import { closeOther, pushToQueue, removeFromQueue } from '../../common/clickoutside'
import { callInterceptor } from '../../common/interceptor'
import { getRect, parseStyle, uuid } from '../../common/util'
import { useAlive } from '../../composables/useAlive'
import { type Queue, queueKey } from '../../composables/useQueue'
import { useTouch } from '../../composables/useTouch'

const props = defineProps(swipeActionProps)
const emit = defineEmits<SwipeActionEmits & { tap: [event: any]; touchstart: [event: any]; touchmove: [event: any]; touchend: [event: any]; touchcancel: [event: any] }>()

const { proxy } = getCurrentInstance() as any
const isAlive = useAlive()
const touch = useTouch()

/** clickoutside 队列（页面级 useQueue 提供时走队列，否则走全局队列） */
const queue = inject<Queue | null>(queueKey, null)

/** 实例唯一类名：操作区宽度按实例度量，避免命中同页其他实例 */
const instanceId = `wd-swipe-action-${uuid()}`

/** 本次滑动开始时容器的偏移量（px） */
const originOffset = ref<number>(0)
/** 当前容器的偏移量（px） */
const wrapperOffset = ref<number>(0)
/** 是否处于手指滑动中（用于区分程序设置与手势） */
const touching = ref<boolean>(false)

const leftWidth = ref(0)
const rightWidth = ref(0)

/**
 * 内容容器内联样式（平移与过渡）
 * 键集合恒定（CONVENTIONS §20）：跟手时段显式写 transition: none，
 * 落位时恢复吸附过渡。
 */
const wrapperStyle = computed<Record<string, string>>(() => {
  return {
    transform: `translateX(${wrapperOffset.value}px)`,
    transition: touching.value ? 'none' : 'transform 0.6s cubic-bezier(0.18, 0.89, 0.32, 1)'
  }
})

onBeforeMount(() => {
  if (queue && queue.pushToQueue) {
    queue.pushToQueue(proxy)
  } else {
    pushToQueue(proxy)
  }
  originOffset.value = 0
  wrapperOffset.value = 0
  touching.value = false
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
    // 补齐「早到的展开态」：modelValue 在宽度落地前被置为 left/right 时，
    // changeState 因宽度为 0 会静默失效（offset 停在 0），而 watch 不会再
    // 触发——编程展开永远不生效。宽度就位且尚未发生位移时补一次。
    if (props.modelValue === 'left' && wrapperOffset.value === 0) swipeMove(leftWidth.value)
  })
  getRect(`.${instanceId}__right`, false, proxy).then((data) => {
    if (!isAlive()) return
    rightWidth.value = Number(data.width) || 0
    if (props.modelValue === 'right' && wrapperOffset.value === 0) swipeMove(-rightWidth.value)
  })
})

/** 外部 modelValue 变化 → 同步展开/收起状态 */
watch(
  () => props.modelValue,
  (value, old) => {
    changeState(value, old)
  },
  {
    deep: true
  }
)

/**
 * 根据 modelValue 切换滑动状态（展开左/右或关闭）
 * @param value 目标状态
 * @param old 上一状态，用于 beforeClose 等逻辑
 */
function changeState(value: SwipeActionStatus, old?: SwipeActionStatus) {
  if (props.disabled) {
    return
  }
  switch (value) {
    case 'close':
      // 调用此函数时，偏移量本就是0
      if (wrapperOffset.value === 0) return
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

/**
 * 设置内容容器横向偏移（带动画或跟随手指）
 * @param offset 偏移量（px），正数为向左滑出左按钮，负数为向右滑出右按钮
 */
function swipeMove(offset = 0) {
  wrapperOffset.value = offset
}

/**
 * 触摸开始：记录初始偏移并关闭其他已展开的滑动项
 * @param event 触摸事件
 */
function startDrag(event: any) {
  emit('touchstart', event)
  if (props.disabled) return

  originOffset.value = wrapperOffset.value
  touch.touchStart(event)
  // 互斥：收起其他已展开的滑动行
  if (queue && queue.closeOther) {
    queue.closeOther(proxy)
  } else {
    closeOther(proxy)
  }
}

/**
 * 触摸移动：根据横向位移更新容器偏移，展示左/右操作按钮
 * @param event 触摸事件
 */
function onDrag(event: any) {
  emit('touchmove', event)
  if (props.disabled) return

  touch.touchMove(event)
  if (touch.direction.value === 'vertical') {
    return
  }

  touching.value = true

  const offset = originOffset.value + touch.deltaX.value
  if ((leftWidth.value === 0 && offset > 0) || (rightWidth.value === 0 && offset < 0)) {
    swipeMove(0)
    return startDrag(event)
  }
  if (leftWidth.value !== 0 && offset >= leftWidth.value) {
    swipeMove(leftWidth.value)
    return startDrag(event)
  } else if (rightWidth.value !== 0 && -offset >= rightWidth.value) {
    swipeMove(-rightWidth.value)
    return startDrag(event)
  }
  swipeMove(offset)
}

/**
 * 触摸结束：根据滑动距离与阈值决定保持展开或收起
 */
function endDrag() {
  emit('touchend')
  finishDrag()
}

/** touchcancel 与 touchend 共用收尾逻辑，但分别转发各自的原生事件 */
function cancelDrag() {
  emit('touchcancel')
  finishDrag()
}

function finishDrag() {
  if (props.disabled) return
  const THRESHOLD = 0.3
  touching.value = false

  if (
    originOffset.value < 0 && // 之前展示的是右按钮
    wrapperOffset.value < 0 && // 目前仍然是右按钮
    wrapperOffset.value - originOffset.value < rightWidth.value * THRESHOLD // 并且滑动的范围不超过右边框阀值
  ) {
    swipeMove(-rightWidth.value) // 回归右按钮
    if (isAlive()) emit('update:modelValue', 'right')
  } else if (
    originOffset.value > 0 && // 之前展示的是左按钮
    wrapperOffset.value > 0 && // 现在仍然是左按钮
    originOffset.value - wrapperOffset.value < leftWidth.value * THRESHOLD // 并且滑动的范围不超过左按钮阀值
  ) {
    swipeMove(leftWidth.value) // 回归左按钮
    if (isAlive()) emit('update:modelValue', 'left')
  } else if (
    rightWidth.value > 0 &&
    originOffset.value >= 0 && // 之前是初始状态或者展示左按钮显
    wrapperOffset.value < 0 && // 现在展示右按钮
    Math.abs(wrapperOffset.value) > rightWidth.value * THRESHOLD // 视图中已经展示的右按钮长度超过阀值
  ) {
    swipeMove(-rightWidth.value)
    if (isAlive()) emit('update:modelValue', 'right')
  } else if (
    leftWidth.value > 0 &&
    originOffset.value <= 0 && // 之前初始状态或者右按钮显示
    wrapperOffset.value > 0 && // 现在左按钮
    Math.abs(wrapperOffset.value) > leftWidth.value * THRESHOLD // 视图中已经展示的左按钮长度超过阀值
  ) {
    swipeMove(leftWidth.value)
    if (isAlive()) emit('update:modelValue', 'left')
  } else {
    // 回归初始状态
    close('swipe')
  }
}

/**
 * 关闭已展开的操作按钮并同步 modelValue；会调用 beforeClose 钩子
 * @param reason 关闭原因
 * @param position 关闭时的操作位置（swipe 时根据当前偏移推断）
 * @param afterClose 关闭成功后的回调
 */
function close(reason: SwipeActionReason, position?: SwipeActionPosition, afterClose?: () => void) {
  if (reason === 'swipe' && originOffset.value === 0) {
    return swipeMove(0)
  }

  let closePosition = position

  if (reason === 'swipe' && originOffset.value > 0) {
    closePosition = 'left'
  } else if (reason === 'swipe' && originOffset.value < 0) {
    closePosition = 'right'
  }

  const doClose = () => {
    // 异步拦截器落地前组件可能已卸载：晚到写入不得作用在死树上
    if (!isAlive()) return
    swipeMove(0)
    if (props.modelValue !== 'close') {
      emit('update:modelValue', 'close')
    }
    afterClose && afterClose()
  }

  if (reason && closePosition) {
    callInterceptor(props.beforeClose, {
      args: [reason, closePosition],
      done: doClose
    })
  } else {
    doClose()
  }
}

/** 暴露给 clickoutside 队列的关闭方法 */
defineExpose<SwipeActionExpose>({ close: () => close('value') })

/**
 * 处理点击：若已展开则关闭并触发 click 事件
 * @param position 点击位置（'left' | 'right' | undefined 表示内容区）
 */
function handleClick(position?: SwipeActionPosition) {
  if (props.disabled || wrapperOffset.value === 0) {
    return
  }

  const clickPosition = position || 'inside'
  close('click', clickPosition, () => {
    emit('click', {
      value: clickPosition
    })
  })
}

/**
 * 根 view 的 tap：先转发原生事件（CONVENTIONS §14），再按参考源语义处理
 * 内容区点击（已展开时关闭并派发 click）。
 */
function handleRootTap(event: any) {
  emit('tap', event)
  handleClick()
}
</script>

<template>
  <!--注意阻止横向滑动的穿透：横向移动时阻止冒泡-->
  <view
    :class="`wd-swipe-action ${customClass}`"
    :style="parseStyle(customStyle)"
    @tap.stop="handleRootTap"
    @touchstart="startDrag"
    @touchmove="onDrag"
    @touchend="endDrag"
    @touchcancel="cancelDrag"
  >
    <!--容器-->
    <view class="wd-swipe-action__wrapper" :style="wrapperStyle">
      <!--左侧操作-->
      <view :class="`wd-swipe-action__left ${instanceId}__left`" @tap.stop="handleClick('left')">
        <slot name="left" />
      </view>
      <!--内容-->
      <slot />
      <!--右侧操作-->
      <view :class="`wd-swipe-action__right ${instanceId}__right`" @tap.stop="handleClick('right')">
        <slot name="right" />
      </view>
    </view>
  </view>
</template>
