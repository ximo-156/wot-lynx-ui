<template>
  <view :class="`wd-tooltip ${customClass}`" :style="styleToObject(customStyle)" id="tooltip" @tap.stop>
    <view class="wd-tooltip__pos wd-tooltip__hidden" id="pos">
      <view :class="`wd-tooltip__container ${customPop}`">
        <view v-if="!$slots.content" class="wd-tooltip__inner"><text>{{ content }}</text></view>
      </view>
    </view>
    <WdTransition
      custom-class="wd-tooltip__pos"
      :custom-style="popover.popStyle.value"
      :show="showTooltip"
      name="fade"
      :duration="200"
      @after-enter="handleAfterEnter"
    >
      <view :class="`wd-tooltip__container ${customPop}`" id="content">
        <view v-if="visibleArrow" :class="`wd-tooltip__arrow ${popover.arrowClass.value} ${customArrow}`" :style="styleToObject(popover.arrowStyle.value)"></view>
        <slot name="content">
          <view class="wd-tooltip__inner"><text>{{ content }}</text></view>
        </slot>
        <WdIcon v-if="showClose" name="close" custom-class="wd-tooltip__close-icon" :size="12" :color="WHITE" @click="toggle"></WdIcon>
      </view>
    </WdTransition>
    <view @tap="toggle" class="wd-tooltip__target" id="target">
      <slot />
    </view>
  </view>
</template>

<script setup lang="ts">
import './index.css'
import { styleToObject } from '../../common/util'
import { WHITE } from '../../common/theme'
import WdIcon from '../wd-icon/wd-icon.vue'
import WdTransition from '../wd-transition/wd-transition.vue'
import { getCurrentInstance, inject, onBeforeMount, onBeforeUnmount, onMounted, ref, watch } from 'vue-lynx'
import { usePopover } from '../../composables/usePopover'
import { closeOther, pushToQueue, removeFromQueue } from '../../common/clickoutside'
import { type Queue, queueKey } from '../../composables/useQueue'
import { tooltipProps, type TooltipExpose } from './types'

const props = defineProps(tooltipProps)
const emit = defineEmits(['update:modelValue', 'menuclick', 'change', 'open', 'close'])

const popover = usePopover(props.visibleArrow)
const queue = inject<Queue | null>(queueKey, null)
const selector: string = 'tooltip'
const { proxy } = getCurrentInstance() as any
const showTooltip = ref<boolean>(false) // 控制tooltip显隐

watch(
  () => props.content,
  (newVal) => {
    if (newVal === null || newVal === undefined) {
      // eslint-disable-next-line prettier/prettier
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
    popover.showStyle.value = newValue ? 'display: inline-block;' : 'display: none;'
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
  popover.showStyle.value = props.modelValue ? 'display: inline-block;' : 'display: none;'
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

defineExpose<TooltipExpose>({
  open,
  close,
  updatePosition: () => popover.updatePosition(props.placement, props.offset)
})
</script>
