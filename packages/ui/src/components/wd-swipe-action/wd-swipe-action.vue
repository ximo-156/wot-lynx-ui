/*
 * wd-swipe-action — 滑动操作（原生优先重写版）
 *
 * Lynx 实现说明（相对 wot-ui 2.3.2 的适配点）：
 * - **跟手走主线程（声明式 MTS）**：横向拖拽的 touchmove 经根 view 的
 *   `main-thread-bindtouchmove` 绑定 'main thread' worklet，触点经绝对
 *   定位公式（手势起点 + 触点横移）换算后 `setStyleProperty` 直改内容
 *   容器 transform——零线程跨越，低端机跟手无滞后（CONVENTIONS §10）；
 * - **跨元素分工（真机冒泡语义）**：主线程 touchstart / touchmove 绑在
 *   根 view（worklet：记起点、方向锁、跟手直改），后台 touchstart /
 *   touchmove / touchend / touchcancel 绑在内容容器 wrapper（子节点）
 *   ——同名事件禁双绑（CONVENTIONS §10），主线程与后台处理器分挂父子
 *   两层。真机上内容区 / 操作区的触摸事件先经 wrapper 的后台处理器，
 *   再冒泡到根 view 的主线程 worklet；jsdom 的 bindEvent 事件不冒泡，
 *   测试中按分工直接派发到对应元素验证（touchstart/touchmove 派发到
 *   wrapper 验后台、派发到 root 验主线程，touchend 派发到 wrapper 落定）；
 * - **手势起点双通道记录**：主线程侧由根 view 的主线程 touchstart 记入
 *   MainThreadRef（跟手用，当前偏移经容器元素属性 origin-offset 实时
 *   读取）；后台侧由 wrapper 的后台 touchstart 记录（落定重算用，
 *   floating-panel / slide-verify 同款分工）——两通道各持一份起点，
 *   互不阻塞；
 * - **操作区宽度经元素属性桥接**：left-width / right-width 由后台度量
 *   后随重渲染下发到容器元素，worklet 经 getAttribute 实时读取
 *   （slider 的 left-bound / right-bound 同款）；宽度未度量（0）时
 *   该侧不可拖（与参考源「无操作区不动」一致）；
 * - **提交走后台**：touchend / touchcancel 用同一套绝对公式由
 *   changedTouches 重算落定偏移（方向锁与 worklet 一致），再按 0.3
 *   阈值状态机决定回归 / 展开 / 收起并 commit——update:modelValue 与
 *   beforeClose 拦截器留在后台，可单测；
 * - **方向锁**：纵向位移大于横向时不横移（与 useTouch 的 direction
 *   判定一致：offsetY > offsetX 判 vertical）；参考源在横向拖动时
 *   event.preventDefault()/stopPropagation() 阻止页面跟随滚动——
 *   Lynx 的事件修饰符是静态绑定、无法按方向条件阻止，若整体 catch
 *   touchmove 会连带阻断纵向滚动，故不放修饰符（纵向仍可滚页面）；
 * - **禁用态经元素属性桥接**：drag-disabled 随重渲染下发，worklet
 *   跟手前实时读取（setup 期 props 快照在实例生命周期内可能过期）；
 * - 内联样式：transform / transition 两个键恒写（CONVENTIONS §20
 *   Style Funnel：跟手时段显式置 none，省略键会让上一次落位的过渡
 *   残留、拖动不跟手）；位移用 translateX（与 translate3d 等价，
 *   Lynx 下更直观），过渡时长与缓动取参考源的 0.6s
 *   cubic-bezier(0.18, 0.89, 0.32, 1)；
 * - @click → @tap（CONVENTIONS §14：Lynx view 不存在 click 事件）；根
 *   view 的 tap 与 wrapper 的 touch 事件在 emits 声明并转发（同名监听
 *   不声明会落入 $attrs 与原生绑定合并成数组 handler，事件派发即抛
 *   注册表 TypeError）；touchmove 的跟手在主线程 worklet，后台 wrapper
 *   的同名处理器只做事件转发（不同元素，不构成双绑）；
 * - 多行互斥经 clickoutside 队列：touchstart 时收起其他展开行；
 * - 异步拦截器 / 度量回调落地前组件可能已卸载，写 ref 前判活（真机
 *   9902 晚到 patch 家族）。
 */
<script lang="ts" setup>
import './index.css'

import { computed, getCurrentInstance, inject, onBeforeMount, onBeforeUnmount, onMounted, ref, watch, useMainThreadRef } from 'vue-lynx'
import { swipeActionProps, type SwipeActionEmits, type SwipeActionExpose, type SwipeActionPosition, type SwipeActionReason, type SwipeActionStatus } from './types'
import { closeOther, pushToQueue, removeFromQueue } from '../../common/clickoutside'
import { callInterceptor } from '../../common/interceptor'
import { getRect, parseStyle, uuid } from '../../common/util'
import { useAlive } from '../../composables/useAlive'
import { type Queue, queueKey } from '../../composables/useQueue'

const props = defineProps(swipeActionProps)
const emit = defineEmits<SwipeActionEmits & { tap: [event: any]; touchstart: [event: any]; touchmove: [event: any]; touchend: [event?: any]; touchcancel: [event?: any] }>()

const { proxy } = getCurrentInstance() as any
const isAlive = useAlive()

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
/** 后台手势起点（wrapper 的 touchstart 记录，touchend 落定重算用） */
const gestureStart = ref<{ clientX: number; clientY: number } | null>(null)

const leftWidth = ref(0)
const rightWidth = ref(0)

/**
 * 根节点内联样式：customStyle 经 parseStyle 归一为对象（CONVENTIONS §19）。
 * 参照 slider / floating-panel 范本走 computed——模板不直接引用导入绑定
 * （script-setup 会为其生成 getter，测试侧 MTS worklet 包装正则会因此
 * 失配，见交付报告「跨组件问题记录」）。
 */
const rootStyle = computed<Record<string, string>>(() => parseStyle(props.customStyle))

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
 * 偏移钳制（与主线程 worklet 同一套边界规则）：
 * 左操作区宽度为 0 时不允许左移（offset ≤ 0），右操作区宽度为 0 时
 * 不允许右移（offset ≥ 0）；有操作区时以操作区宽度为界。
 * @param offset 原始偏移量（px）
 */
function clampOffset(offset: number): number {
  const min = rightWidth.value > 0 ? -rightWidth.value : 0
  const max = leftWidth.value > 0 ? leftWidth.value : 0
  return Math.min(Math.max(offset, min), max)
}

/**
 * 设置内容容器横向偏移（带动画或跟随手指）
 * @param offset 偏移量（px），正数为向左滑出左按钮，负数为向右滑出右按钮
 */
function swipeMove(offset = 0) {
  wrapperOffset.value = offset
}

/**
 * 触摸开始（后台，wrapper）：记录初始偏移与手势起点并关闭其他已展开的滑动项
 * @param event 触摸事件
 */
function startDrag(event: any) {
  emit('touchstart', event)
  if (props.disabled) return

  originOffset.value = wrapperOffset.value
  const touch0 = event && event.touches && event.touches[0]
  gestureStart.value = touch0 ? { clientX: Number(touch0.clientX), clientY: Number(touch0.clientY) } : null
  touching.value = true
  // 互斥：收起其他已展开的滑动行
  if (queue && queue.closeOther) {
    queue.closeOther(proxy)
  } else {
    closeOther(proxy)
  }
}

/**
 * 触摸移动（后台，wrapper）：仅转发原生事件——跟手直改已由根 view 的
 * 主线程 worklet 承担（不同元素，不构成同名双绑）。
 * @param event 触摸事件
 */
function onDrag(event: any) {
  emit('touchmove', event)
}

/**
 * 触摸结束（后台，wrapper）：根据滑动距离与阈值决定保持展开或收起
 */
function endDrag(event: any) {
  emit('touchend', event)
  finishDrag(event)
}

/** touchcancel 与 touchend 共用收尾逻辑，但分别转发各自的原生事件 */
function cancelDrag(event: any) {
  emit('touchcancel', event)
  finishDrag(event)
}

function finishDrag(event?: any) {
  if (props.disabled) return
  const THRESHOLD = 0.3
  touching.value = false

  // 与主线程 worklet 同一套绝对公式：由落定触点重算偏移（方向锁一致）
  const start = gestureStart.value
  gestureStart.value = null
  if (start) {
    const changed = (event && (event.changedTouches && event.changedTouches[0])) || (event && event.touches && event.touches[0]) || null
    const clientX = changed ? Number(changed.clientX) : NaN
    const clientY = changed ? Number(changed.clientY) : NaN
    if (Number.isFinite(clientX)) {
      const deltaX = clientX - start.clientX
      const deltaY = Number.isFinite(clientY) ? clientY - start.clientY : 0
      // 纵向主导时不横移（与 worklet 的方向锁一致）
      if (Math.abs(deltaY) <= Math.abs(deltaX)) {
        swipeMove(clampOffset(originOffset.value + deltaX))
      }
    }
  }

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

// ---------- 主线程 worklet（跟手，零线程跨越） ----------

/**
 * 主线程元素桩类型（worklet 内经 .current 取用）。
 * 与 @lynx-js/types 的 MainThread.Element 对齐的常用子集。
 */
interface MtElement {
  setStyleProperty(name: string, value: string): void
  getAttribute(name: string): string | null
  invoke(method: string, params?: any): Promise<any>
}

/** 内容容器元素：worklet 跟手直改 transform / transition */
const wrapperRef = useMainThreadRef<MtElement | null>(null)
/** 手势起点 { startX, startY, origin }（worklet 内 .current 活值，每次主线程 touchstart 刷新） */
const dragRef = useMainThreadRef<{ startX: number; startY: number; origin: number } | null>(null)

/**
 * 根 view 触摸开始（主线程）：记录手势起点（触点坐标 + 当前容器偏移）。
 *
 * 当前偏移经容器元素属性 origin-offset 实时读取（后台随重渲染更新），
 * 不依赖后台快照同步；与后台侧 startDrag 各持一份起点，互不阻塞
 * （同名事件禁双绑，故主线程起点只能由主线程 touchstart 记录）。
 */
const onTouchStartMt = (event: any) => {
  'main thread'
  const el = wrapperRef.current
  const touch0 = event.touches && event.touches[0]
  if (!el || !touch0) return
  const origin = Number(el.getAttribute('origin-offset'))
  dragRef.current = {
    startX: Number(touch0.clientX),
    startY: Number(touch0.clientY),
    origin: Number.isFinite(origin) ? origin : 0
  }
}

/**
 * 容器跟手移动（主线程）：绝对定位公式 + 边界钳制 + 容器样式直改。
 *
 * 公式与后台 finishDrag 完全一致（手势起点偏移 + 触点横移，按操作区
 * 宽度钳制），操作区宽度经元素属性 left-width / right-width 实时读取；
 * 方向锁与后台一致（纵向位移大于横向时不横移）；跟手期显式写
 * transition: none（落位恢复由后台 touching 置位驱动，Style Funnel
 * §20——省略键等于保留旧值）。
 */
const onTouchMoveMt = (event: any) => {
  'main thread'
  const el = wrapperRef.current
  const drag = dragRef.current
  if (!el || !drag) return
  if (el.getAttribute('drag-disabled') === 'true') return
  const touch0 = event.touches && event.touches[0]
  if (!touch0) return

  // 方向锁：纵向主导时不横移（与 useTouch 的 direction 判定一致）
  const deltaX = Number(touch0.clientX) - drag.startX
  const deltaY = Number(touch0.clientY) - drag.startY
  if (Math.abs(deltaY) > Math.abs(deltaX)) return

  const leftW = Number(el.getAttribute('left-width'))
  const rightW = Number(el.getAttribute('right-width'))
  const min = Number.isFinite(rightW) && rightW > 0 ? -rightW : 0
  const max = Number.isFinite(leftW) && leftW > 0 ? leftW : 0
  const offset = Math.min(Math.max(drag.origin + deltaX, min), max)

  el.setStyleProperty('transform', `translateX(${offset}px)`)
  el.setStyleProperty('transition', 'none')
}
</script>

<template>
  <!--注意阻止横向滑动的穿透：横向移动时阻止冒泡-->
  <view
    :class="`wd-swipe-action ${customClass}`"
    :style="rootStyle"
    :main-thread-bindtouchstart="onTouchStartMt"
    :main-thread-bindtouchmove="onTouchMoveMt"
    @tap.stop="handleRootTap"
  >
    <!--容器（后台 touch 事件挂载层：真机上内容区 / 操作区触摸先经此处，
         再冒泡到根 view 的主线程 worklet；origin-offset / left-width /
         right-width / drag-disabled 属性向主线程桥接实时状态）-->
    <view
      class="wd-swipe-action__wrapper"
      :style="wrapperStyle"
      :main-thread-ref="wrapperRef"
      :origin-offset="String(wrapperOffset)"
      :left-width="String(leftWidth)"
      :right-width="String(rightWidth)"
      :drag-disabled="String(disabled)"
      @touchstart="startDrag"
      @touchmove="onDrag"
      @touchend="endDrag"
      @touchcancel="cancelDrag"
    >
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
