/*
 * wd-fab — 悬浮按钮（原生优先重写版）
 *
 * Lynx 实现说明（相对 wot-ui 2.3.2 的适配点）：
 * - **拖动跟手走主线程（声明式 MTS）**：触发器包裹 view 绑定
 *   `main-thread-bindtouchstart` / `main-thread-bindtouchmove` 两个
 *   'main thread' worklet——touchstart 时经
 *   `MainThread.Element.invoke('boundingClientRect')` 一次性度量 fab 盒子
 *   并算出触点偏移（CONVENTIONS §16：热路径不重复度量），touchmove 时按
 *   绝对定位公式算出新 top / left 并 `setStyleProperty` 直改根节点——
 *   零线程跨越，低端机跟手无滞后（CONVENTIONS §10）；
 * - **落定走后台**：根 view 的 `@touchend`（后台绑定）用同一公式由落定
 *   后的元素矩形重算吸附目标（贴边 + 菜单方向翻转），提交逻辑留在后台、
 *   可单测；度量每手势一次（touchend 非高频，CONVENTIONS §16 允许）；
 * - **分工边界**：move 跟手走主线程（触发器上的 worklet）、end 落定走后
 *   台（根 view 上的 @touchend）——同名事件不双绑（CONVENTIONS §10）；
 * - **真机冒泡语义**：手指在触发器上按下后 touchmove 目标固定为触发器并
 *   向上冒泡到根 view，故根 view 的后台 `@touchmove.stop.prevent` 仍能收
 *   到事件（阻止页面滚动 + 转发原生事件，emits 声明，CONVENTIONS §14）；
 *   jsdom 不模拟冒泡，测试中直接派发到根元素验证处理器逻辑（同 slider
 *   范本）；
 * - **边界下发**：可拖动边界（min/max left/top）经根 view 元素属性
 *   drag-min-left / drag-max-left / drag-min-top / drag-max-top 向主线程
 *   下发（后台随 gap / 屏幕尺寸 / fab 尺寸变化重渲染更新），worklet 跟手
 *   时经 `getAttribute` 实时读取（同 wd-slider 的 left-bound / right-bound
 *   手法）；边界未就绪（度量尚未完成）时 worklet 守值不写；
 * - worklet 捕获的 draggable 为 setup 期常量快照（props 实例内不变，与
 *   slider 范本一致）；
 * - 模板结构逐节点对齐参考源：根 view（触摸拖动 + 冒泡阻止）→ 触发器包裹
 *   view（visibility 门控）→ wd-button 触发器 → wd-transition 动作菜单；
 *   动作菜单的定位与方向类名（wd-fab__actions 加方向后缀）经 transition 的
 *   custom-class 下发，与参考源一致；
 * - 事件映射（CONVENTIONS §6）：参考源的 @click.stop="" 占位改写为
 *   @tap.stop=""（Lynx view 不派发 click）；
 * - 根 view 绑定 @touchstart / @touchmove / @touchend（拖动），按
 *   CONVENTIONS §14 在 emits 声明同名事件并转发——消费方在组件上绑触摸
 *   事件不会与根元素监听合并崩溃（回归见 test/event-merge-props.test.ts）；
 * - 节点度量：参考源用静态 id="trigger" + getRect('#trigger')，同页多实例会
 *   撞 Lynx 引擎 id 注册表（且 getRect 无组件作用域），改为实例唯一类名
 *   （wd-fab-trigger- 加 uuid 后缀）度量；
 * - isH5 在 Lynx 恒为 false（common/util），参考源 getBounding 中的 H5 分支
 *   （windowTop 偏移）不适用，取 else 分支；
 * - 根节点样式：参考源为 objToStyle 字符串拼接 customStyle，Lynx 的字符串
 *   :style 会被静默丢弃（CONVENTIONS §19），改为对象语法并经 parseStyle 归一；
 *   top / left / transition 三键恒写（Style Funnel，CONVENTIONS §20：省略键
 *   等于保留旧值）——跟手期间由 worklet 每帧全量直改这三个键，落定时由后台
 *   一次性写回（先写位移目标再开吸附过渡，避免陈旧中间态）；
 * - 布局居中（NATIVE-REWRITE §3）：根节点显式 display: flex +
 *   flex-direction: column；触发器（wd-fab__trigger）补 flex-direction: row
 *   并与 justify-content / align-items 成对居中；动作菜单基础规则补
 *   flex-direction: column（四个方向修饰类在后方同权重覆盖）；
 * - 图标名 plus 在本地 iconfont 集中无对应字形，取最近似字形 add（消费者
 *   显式传入的其它名字原样下发）；
 * - 点击空白关闭：参考源依赖页面根元素的 closeOutside（useQueue 模式），
 *   Lynx 无全局点击链路，降级为「激活时经 useQueue / clickoutside 队列关闭
 *   其它弹出层」；根 view 的 @tap.stop="" 占位保留（宿主在页面根节点监听
 *   tap 冒泡时阻止触发）。
 */
<script lang="ts" setup>
import './index.css'

import { computed, getCurrentInstance, inject, onBeforeUnmount, onMounted, reactive, ref, watch, useMainThreadRef } from 'vue-lynx'
import WdButton from '../wd-button/wd-button.vue'
import WdTransition from '../wd-transition/wd-transition.vue'
import { fabProps, type FabExpose } from './types'
import { filterStyle, getRect, getSystemInfo, isDef, parseStyle, uuid } from '../../common/util'
import { useRaf } from '../../composables/useRaf'
import { useAlive } from '../../composables/useAlive'
import { closeOther, pushToQueue, removeFromQueue } from '../../common/clickoutside'
import { type Queue, queueKey } from '../../composables/useQueue'
import { hasIcon } from '../../icons/registry'

const props = defineProps(fabProps)
const emit = defineEmits(['update:active', 'click', 'tap', 'touchstart', 'touchmove', 'touchend'])

/** 触发器包裹 view 的实例唯一类名（视口钳制度量用，避免同页多实例 id 碰撞） */
const triggerId = `wd-fab-trigger-${uuid()}`

/** 异步度量回调落地时组件可能已卸载（真机 9902 防护） */
const isAlive = useAlive()

/** 是否完成初始化 */
const inited = ref<boolean>(false)
/** 是否处于激活（展开）状态 */
const isActive = ref<boolean>(false)
const queue = inject<Queue | null>(queueKey, null)
const { proxy } = getCurrentInstance() as any

watch(
  () => props.active,
  (newValue) => {
    isActive.value = newValue
  },
  { immediate: true, deep: true }
)

watch(
  () => isActive.value,
  (newValue) => {
    if (newValue) {
      if (queue && queue.closeOther) {
        queue.closeOther(proxy)
      } else {
        closeOther(proxy)
      }
    }
  }
)

const fabDirection = ref(props.direction)

watch(
  () => props.direction,
  (direction) => (fabDirection.value = direction)
)

watch(
  () => props.position,
  () => initPosition()
)

/** 浮动按钮顶部位置 */
const top = ref<number>(0)
/** 浮动按钮左侧位置 */
const left = ref<number>(0)
/** 屏幕尺寸信息 */
const screen = reactive({ width: 0, height: 0 })
/** 浮动按钮尺寸 */
const fabSize = reactive({ width: 56, height: 56 })
/** 浮动按钮可移动边界 */
const bounding = reactive({
  minTop: 0,
  minLeft: 0,
  maxTop: 0,
  maxLeft: 0
})

/**
 * 获取浮动按钮和屏幕的边界信息
 */
async function getBounding() {
  const sysInfo = getSystemInfo()
  try {
    const trigerInfo = await getRect(`.${triggerId}`, false, proxy)
    fabSize.width = trigerInfo.width || 56
    fabSize.height = trigerInfo.height || 56
  } catch {
    // getRect 约定永不 reject（common/util.ts）；此处为防御性分支
  }

  const { top = 16, left = 16, right = 16, bottom = 16 } = props.gap
  screen.width = sysInfo.windowWidth
  screen.height = sysInfo.windowHeight
  bounding.minTop = top
  bounding.minLeft = left
  bounding.maxLeft = screen.width - fabSize.width - right
  bounding.maxTop = screen.height - fabSize.height - bottom
}

/**
 * 根据 position 属性初始化浮动按钮位置
 */
function initPosition() {
  const pos = props.position
  const { minLeft, minTop, maxLeft, maxTop } = bounding
  const centerY = (maxTop + minTop) / 2
  const centerX = (maxLeft + minLeft) / 2

  switch (pos) {
    case 'left-top':
      top.value = minTop
      left.value = minLeft
      break
    case 'right-top':
      top.value = minTop
      left.value = maxLeft
      break
    case 'left-bottom':
      top.value = maxTop
      left.value = minLeft
      break
    case 'right-bottom':
      top.value = maxTop
      left.value = maxLeft
      break
    case 'left-center':
      top.value = centerY
      left.value = minLeft
      break
    case 'right-center':
      top.value = centerY
      left.value = maxLeft
      break
    case 'top-center':
      top.value = minTop
      left.value = centerX
      break
    case 'bottom-center':
      top.value = maxTop
      left.value = centerX
      break
  }
}

/** 是否启用吸附动画 */
const attractTransition = ref<boolean>(false)

/**
 * 处理触摸开始事件（后台：仅转发原生事件 + 关闭吸附过渡）。
 *
 * 触点偏移由主线程 worklet 在触发器 touchstart 时自算（见
 * onTriggerTouchStart），后台不再重复计算——同一元素同名事件不得同时挂
 * 主线程与后台两个处理器（CONVENTIONS §10）。
 * @param {TouchEvent} e 触摸事件对象
 */
function handleTouchStart(e: TouchEvent) {
  emit('touchstart', e)
  if (props.draggable === false) return

  attractTransition.value = false
}

/**
 * 处理触摸移动事件（后台：仅转发原生事件）。
 *
 * 跟手改位置已由触发器上的主线程 worklet 完成（零线程跨越），后台不再回写
 * top / left——每帧写响应式 ref 等于每帧一次线程往返，低端机上拖动明显滞后。
 * @param {TouchEvent} e 触摸事件对象
 */
function handleTouchMove(e: TouchEvent) {
  emit('touchmove', e)
}

/**
 * 处理触摸结束事件，实现吸附效果（后台：一次性度量后落定）。
 *
 * 跟手期间位置由 worklet 直改根节点（不经后台状态），故落定时先经 getRect
 * 取一次当前矩形（每手势一次，非热路径，CONVENTIONS §16），再由元素中心
 * 与屏幕中心的比较结果吸附到最近侧边，同时翻转动作菜单方向——与参考源
 * handleTouchEnd 的公式一致。
 *
 * **提交顺序**：先把跟手末位置（纵向）与吸附目标（横向）写回后台状态，
 * 最后才开吸附过渡。若先开过渡，中间帧的后台重渲染会把 dragging 前的旧
 * top / left 下发到节点（Style Funnel 的键集恒定，值却是陈旧快照），
 * 表现为「松手后先跳回原位再吸附」。
 */
async function handleTouchEnd(e?: TouchEvent) {
  emit('touchend', e)
  if (props.draggable === false) return

  const triggerInfo = await getRect(`.${triggerId}`, false, proxy)
  // 度量回调晚于卸载落地时丢弃（真机 9902 防护）
  if (!isAlive()) return

  // 纵向跟随落定后的实际位置写回后台状态（吸附只改横向，与参考源一致）
  top.value = Number(triggerInfo.top || 0)

  const screenCenterX = screen.width / 2
  const fabCenterX = Number(triggerInfo.left || 0) + Number(triggerInfo.width || 0) / 2
  if (fabCenterX < screenCenterX) {
    left.value = bounding.minLeft
    fabDirection.value = 'right'
  } else {
    left.value = bounding.maxLeft
    fabDirection.value = 'left'
  }

  // 位移与目标就绪后再开过渡：同一帧一次性下发，无陈旧中间态
  attractTransition.value = true
}

// ---------- 主线程 worklet（跟手，零线程跨越） ----------
/**
 * 触发器触摸开始（主线程）：一次性度量 fab 盒子并算出触点偏移。
 *
 * 经 fab 根节点（而非触发器）度量：根节点即 position: fixed 的定位盒子，
 * touchstart 时它尚未被跟手位移污染，取到的是手势起始位置；度量结果缓入
 * geomRef，touchmove 热路径只读缓存（CONVENTIONS §16）。
 */
const onTriggerTouchStart = (event: any) => {
  'main thread'
  const fab = fabRef.current
  if (!fab || typeof fab.invoke !== 'function') return
  const touch = event.touches && event.touches[0]
  if (!touch) return
  fab.invoke('boundingClientRect').then((rect: any) => {
    geomRef.current = {
      offsetX: Number(touch.clientX) - Number(rect.left || 0),
      offsetY: Number(touch.clientY) - Number(rect.top || 0)
    }
  })
}

/**
 * 触发器跟手移动（主线程）：绝对定位公式 + 根节点样式直改。
 *
 * 边界经根节点元素属性 drag-min-left / drag-max-left / drag-min-top /
 * drag-max-top 实时读取（后台随 gap / 屏幕尺寸 / fab 尺寸更新）；边界未就
 * 绪（maxLeft <= 0，度量尚未完成）时守值不写，避免把 fab 钉到角上。
 * top / left / transition 三个键每帧全量直改（CONVENTIONS §20：省略键等于
 * 保留旧值），与后台 rootStyle 的键集一致。
 */
const onTriggerTouchMove = (event: any) => {
  'main thread'
  if (cfgDraggable === false) return
  const fab = fabRef.current
  const geom = geomRef.current
  if (!fab || !geom) return
  const touch = event.touches && event.touches[0]
  if (!touch) return

  const minLeft = Number(fab.getAttribute('drag-min-left'))
  const maxLeft = Number(fab.getAttribute('drag-max-left'))
  const minTop = Number(fab.getAttribute('drag-min-top'))
  const maxTop = Number(fab.getAttribute('drag-max-top'))
  if (!(maxLeft > 0) || !(maxTop > 0) || isNaN(minLeft) || isNaN(minTop)) return

  let x = Number(touch.clientX) - geom.offsetX
  let y = Number(touch.clientY) - geom.offsetY

  if (x < minLeft) x = minLeft
  else if (x > maxLeft) x = maxLeft

  if (y < minTop) y = minTop
  else if (y > maxTop) y = maxTop

  fab.setStyleProperty('transition', 'none')
  fab.setStyleProperty('top', `${y}px`)
  fab.setStyleProperty('left', `${x}px`)
}

/**
 * 计算浮动按钮的根元素样式
 */
const rootStyle = computed(() => {
  const style: Record<string, string | number> = {
    top: top.value + 'px',
    left: left.value + 'px',
    transition: attractTransition.value ? 'all ease 0.3s' : 'none'
  }
  if (isDef(props.zIndex)) {
    style['z-index'] = props.zIndex
  }
  return { ...filterStyle(style), ...parseStyle(props.customStyle) }
})

onMounted(() => {
  if (queue && queue.pushToQueue) {
    queue.pushToQueue(proxy)
  } else {
    pushToQueue(proxy)
  }

  const { start } = useRaf(async () => {
    await getBounding()
    // 度量回调可能晚于卸载落地：已销毁时不再写 ref（真机 9902 防护）
    if (!isAlive()) return
    initPosition()
    inited.value = true
  })
  start()
})

onBeforeUnmount(() => {
  if (queue && queue.removeFromQueue) {
    queue.removeFromQueue(proxy)
  } else {
    removeFromQueue(proxy)
  }
})

/** 图标名归一：本地 iconfont 集缺少 wot-ui 的 plus 字形，取最近似字形 */
function resolveIconName(name: string) {
  if (!name || hasIcon(name)) return name
  if (name === 'plus') return 'add'
  return name
}

/**
 * 处理点击事件
 */
function handleClick() {
  if (props.disabled) {
    return
  }
  if (!props.expandable) {
    emit('click')
    return
  }
  isActive.value = !isActive.value
  emit('update:active', isActive.value)
}

/**
 * 展开菜单
 */
function open() {
  isActive.value = true
  emit('update:active', true)
}

/**
 * 收起菜单
 */
function close() {
  isActive.value = false
  emit('update:active', false)
}

defineExpose<FabExpose>({
  open,
  close
})

// ---------- 主线程（MTS）引用与边界下发 ----------
/**
 * 主线程元素桩类型（worklet 内经 .current 取用）。
 * 与 @lynx-js/types 的 MainThread.Element 对齐的常用子集。
 */
interface MtElement {
  setStyleProperty(name: string, value: string): void
  getAttribute(name: string): string | null
  invoke(method: string, params?: any): Promise<any>
}

/** fab 根节点：跟手直改 top / left + 经元素属性读取拖动边界 */
const fabRef = useMainThreadRef<MtElement | null>(null)

/** 触点偏移快照 { offsetX, offsetY }（worklet 内 .current 活值） */
const geomRef = useMainThreadRef<{ offsetX: number; offsetY: number } | null>(null)

/** worklet 捕获的静态配置快照（setup 期求值；props 实例内不变） */
const cfgDraggable = props.draggable

/**
 * 可拖动边界（元素属性字符串，随 gap / 屏幕尺寸 / fab 尺寸变化重渲染更新）。
 *
 * 主线程 worklet 无法读后台响应式状态，按 wd-slider 的 left-bound /
 * right-bound 手法经元素属性把边界下发（getAttribute 实时读）。
 */
const dragBoundAttrs = computed(() => ({
  'drag-min-left': String(bounding.minLeft),
  'drag-max-left': String(bounding.maxLeft),
  'drag-min-top': String(bounding.minTop),
  'drag-max-top': String(bounding.maxTop)
}))
</script>

<template>
  <view
    @touchmove.stop.prevent="handleTouchMove"
    @touchstart="handleTouchStart"
    @touchend="handleTouchEnd"
    :class="`wd-fab ${customClass}`"
    :style="rootStyle"
    @tap.stop="emit('tap', $event)"
    :main-thread-ref="fabRef"
    v-bind="dragBoundAttrs"
  >
    <view
      @tap.stop=""
      :style="{ visibility: inited ? 'visible' : 'hidden' }"
      :class="triggerId"
      :main-thread-bindtouchstart="onTriggerTouchStart"
      :main-thread-bindtouchmove="onTriggerTouchMove"
    >
      <slot name="trigger" :disabled="disabled">
        <wd-button
          @click="handleClick"
          :icon="isActive ? resolveIconName(activeIcon) : resolveIconName(inactiveIcon)"
          custom-class="wd-fab__trigger"
          round
          :type="type"
          :disabled="disabled"
        ></wd-button>
      </slot>
    </view>
    <wd-transition
      v-if="expandable"
      :enter-class="`wd-fab__transition-enter--${fabDirection}`"
      enter-active-class="wd-fab__transition-enter-active"
      :leave-to-class="`wd-fab__transition-leave-to--${fabDirection}`"
      leave-active-class="wd-fab__transition-leave-active"
      :custom-class="`wd-fab__actions wd-fab__actions--${fabDirection}`"
      :show="isActive"
      :duration="300"
    >
      <slot></slot>
    </wd-transition>
  </view>
</template>
