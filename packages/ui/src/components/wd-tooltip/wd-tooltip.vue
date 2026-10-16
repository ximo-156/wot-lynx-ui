/*
 * wd-tooltip — 文字提示
 *
 * Lynx 实现说明：经 usePopover 计算定位；与 popover 的区别是
 * 内容为纯文本且不可交互（pointer-events 控制）。
 */
<script lang="ts" setup>
import './index.css'
import { parseStyle } from '../../common/util'

import { computed, onMounted, ref, useSlots, watch } from 'vue-lynx'
import WdIcon from '../wd-icon/wd-icon.vue'
import WdTransition from '../wd-transition/wd-transition.vue'
import { tooltipProps, type TooltipExpose } from './types'
import { usePopover } from '../../composables/usePopover'

const props = defineProps(tooltipProps)
const emit = defineEmits(['change', 'update:modelValue', 'tap'])

const slots = useSlots()
const showTooltip = ref<boolean>(false)

const popover = usePopover(props.visibleArrow)

/** wot-ui 位置名 → floating-ui 位置名（usePopover 约定） */
function toFloatingPlacement(placement: string): any {
  const map: Record<string, string> = {
    top: 'top',
    'top-left': 'top-start',
    'top-right': 'top-end',
    bottom: 'bottom',
    'bottom-left': 'bottom-start',
    'bottom-right': 'bottom-end',
    left: 'left',
    'left-top': 'left-start',
    'left-bottom': 'left-end',
    right: 'right',
    'right-top': 'right-start',
    'right-bottom': 'right-end'
  }
  return map[placement] || placement
}


// 按 placement/offset 初始化与更新定位。
// 第三个参数为 BEM 类名前缀（tooltip），节点度量走 usePopover 生成的实例唯一 id
// （静态 id 在同页多实例下会撞引擎 id 注册表，见 usePopover.ids 注释）。
//
// ① 初始化定位移到 onMounted：setup 同步执行时目标节点尚未渲染，getRect 取不到
//    尺寸（width/height=0），此前在 setup 里同步算一次导致定位恒为 0 且之后无重算。
const placement = computed(() => toFloatingPlacement(props.placement))

function controlPosition() {
  popover.control(placement.value, props.offset as any)
}

/** 重新度量目标/气泡尺寸并重算定位 */
function refreshPosition() {
  popover.init(placement.value, props.visibleArrow, 'tooltip')
  controlPosition()
}

onMounted(() => {
  refreshPosition()
})

// ② / ⑥ 打开时重新定位：normal 模式下隐藏副本与真实内容同尺寸，updatePosition
//    的尺寸比对不会触发重算，故打开时显式 control 一次强制重算。
watch(showTooltip, (val) => {
  if (val) {
    refreshPosition()
  }
})

// ③ placement 变化时重新定位。
watch(
  () => props.placement,
  () => {
    controlPosition()
  }
)

function toggle() {
  if (props.disabled) return
  showTooltip.value = !showTooltip.value
  emit('update:modelValue', showTooltip.value)
  emit('change', { show: showTooltip.value })
  emit('tap')
}

function open() {
  showTooltip.value = true
  emit('update:modelValue', true)
}

function close() {
  showTooltip.value = false
  emit('update:modelValue', false)
}

function updatePosition() {
  popover.updatePosition(toFloatingPlacement(props.placement), props.offset as any)
}

defineExpose<TooltipExpose>({
  open,
  close,
  updatePosition
})
</script>

<template>
  <view :class="`wd-tooltip ${customClass}`" :style="parseStyle(customStyle)" :id="popover.ids.root" @tap.stop="toggle">
    <view class="wd-tooltip__pos wd-tooltip__hidden" :id="popover.ids.pos">
      <view :class="`wd-tooltip__container ${customPop}`">
        <view v-if="!slots.content" class="wd-tooltip__inner">
          <text>{{ content }}</text>
        </view>
      </view>
    </view>
    <!-- ⑤ 点击空白关闭：透明全屏 backdrop 捕获气泡外 tap -->
    <view v-if="showTooltip" class="wd-tooltip__backdrop" @tap.stop="close" />
    <wd-transition
      custom-class="wd-tooltip__pos"
      :custom-style="popover.popStyle.value"
      :show="showTooltip"
      name="fade"
      :duration="200"
      @after-enter="updatePosition()"
    >
      <view :class="`wd-tooltip__container ${customPop}`" :id="popover.ids.content">
        <view
          v-if="visibleArrow"
          :class="`wd-tooltip__arrow ${popover.arrowClass.value} ${customArrow}`"
          :style="popover.arrowStyle.value"
        />
        <slot name="content">
          <view class="wd-tooltip__inner">
            <text>{{ content }}</text>
          </view>
        </slot>
        <wd-icon v-if="showClose" name="close" custom-class="wd-tooltip__close-icon" @tap.stop="close" />
      </view>
    </wd-transition>
    <view class="wd-tooltip__target" :id="popover.ids.target">
      <slot />
    </view>
  </view>
</template>
