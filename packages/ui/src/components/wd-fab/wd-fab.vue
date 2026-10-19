/*
 * wd-fab — 悬浮按钮
 *
 * Lynx 实现说明（相对 wot-ui 2.3.2 的适配点）：
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
 *   top / left / transition 每帧全量写入（Style Funnel，CONVENTIONS §20）；
 * - 图标名 plus 在本地 iconfont 集中无对应字形，取最近似字形 add（消费者
 *   显式传入的其它名字原样下发）；
 * - 点击空白关闭：参考源依赖页面根元素的 closeOutside（useQueue 模式），
 *   Lynx 无全局点击链路，降级为「激活时经 useQueue / clickoutside 队列关闭
 *   其它弹出层」；根 view 的 @tap.stop="" 占位保留（宿主在页面根节点监听
 *   tap 冒泡时阻止触发）。
 */
<script lang="ts" setup>
import './index.css'

import { computed, getCurrentInstance, inject, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue-lynx'
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
  } catch (error) {
    console.log(error)
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

/** 按下时触摸点相对于元素的偏移量 */
const touchOffset = reactive({ x: 0, y: 0 })
/** 是否启用吸附动画 */
const attractTransition = ref<boolean>(false)

/**
 * 处理触摸开始事件
 * @param {TouchEvent} e 触摸事件对象
 */
function handleTouchStart(e: TouchEvent) {
  emit('touchstart', e)
  if (props.draggable === false) return

  const touch = e.touches[0]
  touchOffset.x = touch.clientX - left.value
  touchOffset.y = touch.clientY - top.value
  attractTransition.value = false
}

/**
 * 处理触摸移动事件，实现拖动功能
 * @param {TouchEvent} e 触摸事件对象
 */
function handleTouchMove(e: TouchEvent) {
  emit('touchmove', e)
  if (props.draggable === false) return

  const touch = e.touches[0]
  const { minLeft, minTop, maxLeft, maxTop } = bounding
  let x = touch.clientX - touchOffset.x
  let y = touch.clientY - touchOffset.y

  if (x < minLeft) x = minLeft
  else if (x > maxLeft) x = maxLeft

  if (y < minTop) y = minTop
  else if (y > maxTop) y = maxTop

  top.value = y
  left.value = x
}

/**
 * 处理触摸结束事件，实现吸附效果
 */
function handleTouchEnd(e?: TouchEvent) {
  emit('touchend', e)
  if (props.draggable === false) return

  const screenCenterX = screen.width / 2
  const fabCenterX = left.value + fabSize.width / 2
  attractTransition.value = true
  if (fabCenterX < screenCenterX) {
    left.value = bounding.minLeft
    fabDirection.value = 'right'
  } else {
    left.value = bounding.maxLeft
    fabDirection.value = 'left'
  }
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
</script>

<template>
  <view
    @touchmove.stop.prevent="handleTouchMove"
    @touchstart="handleTouchStart"
    @touchend="handleTouchEnd"
    :class="`wd-fab ${customClass}`"
    :style="rootStyle"
    @tap.stop="emit('tap', $event)"
  >
    <view @tap.stop="" :style="{ visibility: inited ? 'visible' : 'hidden' }" :class="triggerId">
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
