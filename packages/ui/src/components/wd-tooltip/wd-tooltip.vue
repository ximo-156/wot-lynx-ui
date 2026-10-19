/*
 * wd-tooltip — 文字提示
 *
 * Lynx 实现说明（相对 wot-ui 2.3.2 的适配点）：
 * - 事件映射：@click → @tap（CONVENTIONS §6，Lynx view 不派发 click）；
 *   根 view 绑 @tap.stop 阻止冒泡，故 emits 声明 'tap' 并在 toggle 中转发
 *   （CONVENTIONS §14：消费方在组件上绑 @tap 不会与根元素监听合并崩溃）。
 * - 文本一律包在 text 元素中；customStyle 经 parseStyle 归一为对象语法
 *   （CONVENTIONS §19：字符串 :style 会被 vue-lynx 静默丢弃）。
 * - 定位样式：usePopover 返回的 popStyle / arrowStyle 为对象语法。
 * - 节点 id：wot-ui 用静态 id（tooltip/pos/content/target），同页多实例会撞
 *   Lynx 引擎 id 注册表；这里改用 usePopover.ids 的实例唯一 id。
 * - 点击空白关闭：wot-ui 依赖页面根元素的 closeOutside（useQueue 模式），
 *   Lynx 无对应全局点击链路，降级为自包含的全屏透明 backdrop 捕获气泡外
 *   tap；useQueue / clickoutside 队列逻辑保留（打开时关闭其它气泡）。
 * - showStyle 为 wot-ui 遗留状态（模板未消费），此处按对象语法同步赋值以
 *   保持脚本逐段对齐。
 */
<script lang="ts" setup>
import './index.css'

import { getCurrentInstance, inject, onBeforeMount, onBeforeUnmount, onMounted, ref, useSlots, watch } from 'vue-lynx'
import WdIcon from '../wd-icon/wd-icon.vue'
import WdTransition from '../wd-transition/wd-transition.vue'
import { tooltipProps, type TooltipExpose } from './types'
import { usePopover } from '../../composables/usePopover'
import { closeOther, pushToQueue, removeFromQueue } from '../../common/clickoutside'
import { type Queue, queueKey } from '../../composables/useQueue'
import { parseStyle } from '../../common/util'

const props = defineProps(tooltipProps)
const emit = defineEmits(['update:modelValue', 'menuclick', 'change', 'open', 'close', 'tap'])

const slots = useSlots()
const popover = usePopover(props.visibleArrow)
const queue = inject<Queue | null>(queueKey, null)
const selector: string = 'tooltip'
const { proxy } = getCurrentInstance() as any
const showTooltip = ref<boolean>(false) // 控制tooltip显隐

watch(
  () => props.content,
  (newVal) => {
    if (newVal === null || newVal === undefined) {
      console.error('[wot-design] warning(wd-tooltip): content can\'t be null or undefined')
    }
  }
)

watch(
  () => props.placement,
  () => {
    popover.init(props.placement, props.visibleArrow, selector)
  }
)

watch(
  () => props.modelValue,
  (newValue) => {
    showTooltip.value = newValue
  }
)

watch(
  () => showTooltip.value,
  (newValue) => {
    if (newValue) {
      popover.control(props.placement, props.offset)
      if (queue && queue.closeOther) {
        queue.closeOther(proxy)
      } else {
        closeOther(proxy)
      }
    }
    // wot-ui 此处为字符串（display: inline-block;），本地 showStyle 为对象语法
    popover.showStyle.value = newValue ? { display: 'inline-block' } : { display: 'none' }
    emit('change', { show: newValue })
    emit(`${newValue ? 'open' : 'close'}`)
  }
)

onMounted(() => {
  popover.init(props.placement, props.visibleArrow, selector)
})

onBeforeMount(() => {
  if (queue && queue.pushToQueue) {
    queue.pushToQueue(proxy)
  } else {
    pushToQueue(proxy)
  }
  popover.showStyle.value = props.modelValue ? { display: 'inline-block' } : { display: 'none' }
})

onBeforeUnmount(() => {
  if (queue && queue.removeFromQueue) {
    queue.removeFromQueue(proxy)
  } else {
    removeFromQueue(proxy)
  }
})

/**
 * 切换 tooltip 的显示状态
 */
function toggle() {
  if (props.disabled) return
  updateModelValue(!showTooltip.value)
  // CONVENTIONS §14：根 view 原生事件名声明为 emit 并转发
  emit('tap')
}

/**
 * 打开 tooltip
 */
function open() {
  updateModelValue(true)
}

/**
 * 关闭 tooltip
 */
function close() {
  updateModelValue(false)
}

/**
 * 过渡动画完成后重新测量弹出层尺寸并更新定位
 */
function handleAfterEnter() {
  popover.updatePosition(props.placement, props.offset)
}

/**
 * 更新 tooltip 显示状态
 * @param {boolean} value 显示状态
 */
function updateModelValue(value: boolean) {
  showTooltip.value = value
  emit('update:modelValue', value)
}

/** 根 view 的 @tap.stop 占位（仅阻止冒泡，行为对齐 wot-ui 的 @click.stop） */
function noop() {}

defineExpose<TooltipExpose>({
  open,
  close,
  updatePosition: () => popover.updatePosition(props.placement, props.offset)
})
</script>

<template>
  <view :class="`wd-tooltip ${customClass}`" :style="parseStyle(customStyle)" :id="popover.ids.root" @tap.stop="noop">
    <view class="wd-tooltip__pos wd-tooltip__hidden" :id="popover.ids.pos">
      <view :class="`wd-tooltip__container ${customPop}`">
        <view v-if="!slots.content" class="wd-tooltip__inner"><text>{{ content }}</text></view>
      </view>
    </view>
    <!-- 点击空白关闭：透明全屏 backdrop 捕获气泡外 tap（Lynx 无全局 click，
         module 级 clickoutside/useQueue 队列未接全局监听，故用自包含 backdrop） -->
    <view v-if="showTooltip" class="wd-tooltip__backdrop" @tap.stop="close" />
    <WdTransition
      custom-class="wd-tooltip__pos"
      :custom-style="popover.popStyle.value"
      :show="showTooltip"
      name="fade"
      :duration="200"
      @after-enter="handleAfterEnter"
    >
      <view :class="`wd-tooltip__container ${customPop}`" :id="popover.ids.content">
        <view
          v-if="visibleArrow"
          :class="`wd-tooltip__arrow ${popover.arrowClass.value} ${customArrow}`"
          :style="popover.arrowStyle.value"
        />
        <slot name="content">
          <view class="wd-tooltip__inner"><text>{{ content }}</text></view>
        </slot>
        <WdIcon v-if="showClose" name="close" custom-class="wd-tooltip__close-icon" @tap="toggle" />
      </view>
    </WdTransition>
    <view class="wd-tooltip__target" :id="popover.ids.target" @tap="toggle">
      <slot />
    </view>
  </view>
</template>
