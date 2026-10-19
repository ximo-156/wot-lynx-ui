/*
 * wd-popover — 气泡弹出
 *
 * Lynx 实现说明（相对 wot-ui 2.3.2 的适配点）：
 * - 事件映射：@click → @tap（CONVENTIONS §6，Lynx view 不派发 click）；
 *   根 view 绑 @tap.stop 阻止冒泡，故 emits 声明 'tap' 并在 toggle 中转发
 *   （CONVENTIONS §14：消费方在组件上绑 @tap 不会与根元素监听合并崩溃）。
 * - 文本一律包在 text 元素中；customStyle 经 parseStyle 归一为对象语法
 *   （CONVENTIONS §19：字符串 :style 会被 vue-lynx 静默丢弃）。
 * - 定位样式：usePopover 返回的 popStyle / arrowStyle 为对象语法。
 * - 节点 id：wot-ui 用静态 id（popover/pos/content/target），同页多实例会撞
 *   Lynx 引擎 id 注册表；这里改用 usePopover.ids 的实例唯一 id。
 * - 点击空白关闭：wot-ui 依赖页面根元素的 closeOutside（useQueue 模式），
 *   Lynx 无对应全局点击链路，降级为自包含的全屏透明 backdrop 捕获气泡外
 *   tap；useQueue / clickoutside 队列逻辑保留（打开时关闭其它气泡）。
 * - showStyle 为 wot-ui 遗留状态（模板未消费），此处按对象语法同步赋值以
 *   保持脚本逐段对齐；显示值取 Lynx 可识别的 flex（参考源的 inline-block
 *   在 Lynx 3.x 下被静默丢弃，CONVENTIONS §15）。
 */
<script lang="ts" setup>
import './index.css'

import { getCurrentInstance, inject, onBeforeMount, onBeforeUnmount, onMounted, ref, useSlots, watch } from 'vue-lynx'
import WdIcon from '../wd-icon/wd-icon.vue'
import WdTransition from '../wd-transition/wd-transition.vue'
import { popoverProps, type PopoverExpose, type PopoverMenuItem } from './types'
import { usePopover } from '../../composables/usePopover'
import { closeOther, pushToQueue, removeFromQueue } from '../../common/clickoutside'
import { type Queue, queueKey } from '../../composables/useQueue'
import { isArray, isObj, parseStyle } from '../../common/util'

const props = defineProps(popoverProps)
const emit = defineEmits(['update:modelValue', 'menuclick', 'change', 'open', 'close', 'tap'])

const slots = useSlots()
const queue = inject<Queue | null>(queueKey, null)
const selector: string = 'popover'
const { proxy } = getCurrentInstance() as any
const popover = usePopover(props.visibleArrow)

const showPopover = ref<boolean>(false) // 控制popover显隐

watch(
  () => props.content,
  (newVal) => {
    const { mode } = props
    if (mode === 'normal' && typeof newVal !== 'string') {
      console.error('The value type must be a string type in normal mode')
    } else if (mode === 'menu' && !isArray(newVal)) {
      console.error('The value type must be a Array type in menu mode')
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
    showPopover.value = newValue
  }
)

watch(
  () => showPopover.value,
  (newValue) => {
    if (newValue) {
      popover.control(props.placement, props.offset)
      if (queue && queue.closeOther) {
        queue.closeOther(proxy)
      } else {
        closeOther(proxy)
      }
    }
    // wot-ui 此处为字符串（display: inline-block;），本地 showStyle 为对象语法；
    // inline-block 在 Lynx 不被识别，显示值取语义等价的 flex
    popover.showStyle.value = newValue ? { display: 'flex' } : { display: 'none' }
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
  popover.showStyle.value = showPopover.value ? { display: 'flex' } : { display: 'none' }
})

onBeforeUnmount(() => {
  if (queue && queue.removeFromQueue) {
    queue.removeFromQueue(proxy)
  } else {
    removeFromQueue(proxy)
  }
})

/**
 * 处理菜单列表项点击
 * @param {number} index 点击的项索引
 */
function menuClick(index: number) {
  updateModelValue(false)
  emit('menuclick', {
    item: (props.content as PopoverMenuItem[])[index],
    index
  })
}

/**
 * 切换 popover 的显示状态
 */
function toggle() {
  if (props.disabled) return
  updateModelValue(!showPopover.value)
  // CONVENTIONS §14：根 view 原生事件名声明为 emit 并转发
  emit('tap')
}

/**
 * 打开 popover
 */
function open() {
  updateModelValue(true)
}

/**
 * 关闭 popover
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
 * 更新 popover 显示状态
 * @param {boolean} value 显示状态
 */
function updateModelValue(value: boolean) {
  showPopover.value = value
  emit('update:modelValue', value)
}

/** 根 view 的 @tap.stop 占位（仅阻止冒泡，行为对齐 wot-ui 的 @click.stop） */
function noop() {}

defineExpose<PopoverExpose>({
  open,
  close,
  updatePosition: () => popover.updatePosition(props.placement, props.offset)
})
</script>

<template>
  <view :class="`wd-popover ${customClass}`" :style="parseStyle(customStyle)" :id="popover.ids.root" @tap.stop="noop">
    <view class="wd-popover__pos wd-popover__hidden" :id="popover.ids.pos">
      <view :class="`wd-popover__container ${customPop}`">
        <view v-if="!slots.content && mode === 'normal'" class="wd-popover__inner">
          <text>{{ content }}</text>
        </view>
        <view v-if="!slots.content && mode === 'menu' && typeof content === 'object'" class="wd-popover__menu">
          <view v-for="(item, index) in content" :key="index" class="wd-popover__menu-inner" @tap="menuClick(index)">
            <WdIcon v-if="item.iconClass" :name="item.iconClass" custom-class="wd-popover__icon" />
            <text>{{ item.content }}</text>
          </view>
        </view>
      </view>
    </view>
    <!-- 点击空白关闭：透明全屏 backdrop 捕获气泡外 tap（Lynx 无全局 click，
         module 级 clickoutside/useQueue 队列未接全局监听，故用自包含 backdrop） -->
    <view v-if="showPopover" class="wd-popover__backdrop" @tap.stop="close" />
    <WdTransition
      custom-class="wd-popover__pos"
      :custom-style="popover.popStyle.value"
      :show="showPopover"
      name="fade"
      @after-enter="handleAfterEnter"
    >
      <view :class="`wd-popover__container ${customPop}`" :id="popover.ids.content">
        <view
          v-if="visibleArrow"
          :class="`wd-popover__arrow ${popover.arrowClass.value} ${customArrow}`"
          :style="popover.arrowStyle.value"
        />
        <slot name="content">
          <!-- 普通模式 -->
          <view v-if="mode === 'normal'" class="wd-popover__inner">
            <text>{{ content }}</text>
          </view>
          <!-- 列表模式 -->
          <view v-if="mode === 'menu'" class="wd-popover__menu">
            <view
              v-for="(item, index) in content"
              :key="index"
              :class="['wd-popover__menu-inner', index === 0 ? 'is-first' : '']"
              @tap="menuClick(index)"
            >
              <WdIcon v-if="isObj(item) && item.iconClass" :name="item.iconClass" custom-class="wd-popover__menu-icon" />
              <view class="wd-popover__text"><text>{{ isObj(item) && item.content ? item.content : '' }}</text></view>
            </view>
          </view>
        </slot>

        <WdIcon v-if="showClose" name="close" custom-class="wd-popover__close-icon" @tap="toggle" />
      </view>
    </WdTransition>
    <view class="wd-popover__target" :id="popover.ids.target" @tap="toggle">
      <slot />
    </view>
  </view>
</template>
