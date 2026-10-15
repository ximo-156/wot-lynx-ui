/*
 * wd-tooltip — 文字提示
 *
 * Lynx 实现说明：经 usePopover 计算定位；与 popover 的区别是
 * 内容为纯文本且不可交互（pointer-events 控制）。
 */
<script lang="ts" setup>
import './index.css'

import { computed, ref, useSlots } from 'vue-lynx'
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


popover.init(toFloatingPlacement(props.placement), props.visibleArrow, '#tooltip')
popover.control(toFloatingPlacement(props.placement), props.offset as any)

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
  <view :class="`wd-tooltip ${customClass}`" :style="customStyle" id="tooltip" @tap.stop="toggle">
    <view class="wd-tooltip__pos wd-tooltip__hidden" id="pos">
      <view :class="`wd-tooltip__container ${customPop}`">
        <view v-if="!slots.content" class="wd-tooltip__inner">
          <text>{{ content }}</text>
        </view>
      </view>
    </view>
    <wd-transition
      custom-class="wd-tooltip__pos"
      :custom-style="popover.popStyle.value"
      :show="showTooltip"
      name="fade"
      :duration="200"
      @after-enter="updatePosition()"
    >
      <view :class="`wd-tooltip__container ${customPop}`" id="content">
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
    <view class="wd-tooltip__target" id="target">
      <slot />
    </view>
  </view>
</template>
