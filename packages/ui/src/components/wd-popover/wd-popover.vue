<template>
  <view :class="`wd-popover ${customClass}`" :style="styleToObject(customStyle)" id="popover" @tap.stop>
    <view class="wd-popover__pos wd-popover__hidden" id="pos">
      <view :class="`wd-popover__container ${customPop}`">
        <view v-if="!$slots.content && mode === 'normal'" class="wd-popover__inner">
          <text>{{ content }}</text>
        </view>
        <view v-if="!$slots.content && mode === 'menu' && typeof content === 'object'" class="wd-popover__menu">
          <view v-for="(item, index) in content" :key="index" :class="['wd-popover__menu-inner', index === 0 ? 'is-first' : '']" @tap="menuClick(index)">
            <WdIcon v-if="item.iconClass" :name="item.iconClass" custom-class="wd-popover__icon" />
            <text>{{ item.content }}</text>
          </view>
        </view>
      </view>
    </view>
    <WdTransition
      custom-class="wd-popover__pos"
      :custom-style="popover.popStyle.value"
      :show="showPopover"
      name="fade"
      @after-enter="handleAfterEnter"
    >
      <view :class="`wd-popover__container ${customPop}`" id="content">
        <view
          v-if="props.visibleArrow"
          :class="`wd-popover__arrow ${popover.arrowClass.value} ${customArrow}`"
          :style="styleToObject(popover.arrowStyle.value)"
        ></view>
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

        <WdIcon v-if="showClose" name="close" custom-class="wd-popover__close-icon" :size="12" :color="COOLGREY[6]" @click="toggle"></WdIcon>
      </view>
    </WdTransition>
    <view @tap="toggle" class="wd-popover__target" id="target">
      <slot />
    </view>
  </view>
</template>

<script setup lang="ts">
import './index.css'
import WdIcon from '../wd-icon/wd-icon.vue'
import WdTransition from '../wd-transition/wd-transition.vue'
import { getCurrentInstance, inject, onBeforeMount, onBeforeUnmount, onMounted, ref, watch } from 'vue-lynx'
import { usePopover } from '../../composables/usePopover'
import { closeOther, pushToQueue, removeFromQueue } from '../../common/clickoutside'
import { type Queue, queueKey } from '../../composables/useQueue'
import { popoverProps, type PopoverExpose } from './types'
import { styleToObject, isArray, isObj } from '../../common/util'
import { COOLGREY } from '../../common/theme'

const props = defineProps(popoverProps)
const emit = defineEmits(['update:modelValue', 'menuclick', 'change', 'open', 'close'])

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
  popover.showStyle.value = showPopover.value ? 'display: inline-block;' : 'display: none;'
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
    item: (props.content as Array<Record<string, any>>)[index],
    index
  })
}

/**
 * 切换 popover 的显示状态
 */
function toggle() {
  if (props.disabled) return
  updateModelValue(!showPopover.value)
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

defineExpose<PopoverExpose>({
  open,
  close,
  updatePosition: () => popover.updatePosition(props.placement, props.offset)
})
</script>
