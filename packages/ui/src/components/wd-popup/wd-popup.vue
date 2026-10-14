<template>
  <!-- 注意：不要在本组件（或任何包裹 WdOverlay/WdTransition 的组件）上给
       <WdOverlay> 绑 @touchmove="noop"——WdOverlay → WdTransition 的根 view 在
       lockScroll 为真时已绑定 @touchmove.stop.prevent，父级再绑一个同名 on*
       监听会被 Vue 的 mergeProps 合并成**数组**注册进 vue-lynx 事件注册表，
       touchmove 派发时 publishEvent 调用数组即抛
       "TypeError: _getRegistryState_handlers_get is not a function"。
       锁滚已由 :lock-scroll → disable-touch-move 链路完成，此处无需重复绑定。 -->
  <WdRootPortal v-if="rootPortal">
    <view class="wd-popup-wrapper">
      <WdOverlay
        v-if="modal"
        :show="modelValue"
        :z-index="zIndex"
        :lock-scroll="lockScroll"
        :duration="duration"
        :custom-style="modalStyle"
        @click="handleClickModal"
      />
      <WdTransition
        :lazy-render="lazyRender"
        :custom-class="rootClass"
        :custom-style="style"
        :duration="duration"
        :show="modelValue"
        :name="transitionName"
        :destroy="hideWhenClose"
        @before-enter="emit('before-enter')"
        @enter="emit('enter')"
        @after-enter="emit('after-enter')"
        @before-leave="emit('before-leave')"
        @leave="emit('leave')"
        @after-leave="emit('after-leave')"
      >
        <slot />
        <WdIcon v-if="closable" custom-class="wd-popup__close" name="close" :size="16" :color="closeIconColor" @click="close" />
      </WdTransition>
    </view>
  </WdRootPortal>

  <!-- 非传送模式 -->
  <view v-else class="wd-popup-wrapper">
    <WdOverlay
      v-if="modal"
      :show="modelValue"
      :z-index="zIndex"
      :lock-scroll="lockScroll"
      :duration="duration"
      :custom-style="modalStyle"
      @click="handleClickModal"
    />
    <WdTransition
      :lazy-render="lazyRender"
      :custom-class="rootClass"
      :custom-style="style"
      :duration="duration"
      :show="modelValue"
      :name="transitionName"
      :destroy="hideWhenClose"
      @before-enter="emit('before-enter')"
      @enter="emit('enter')"
      @after-enter="emit('after-enter')"
      @before-leave="emit('before-leave')"
      @leave="emit('leave')"
      @after-leave="emit('after-leave')"
    >
      <slot />
      <WdIcon v-if="closable" custom-class="wd-popup__close" name="close" :size="16" :color="closeIconColor" @click="close" />
    </WdTransition>
  </view>
</template>

<script setup lang="ts">
import './index.css'
import { computed, onBeforeMount, ref } from 'vue-lynx'
import WdIcon from '../wd-icon/wd-icon.vue'
import WdOverlay from '../wd-overlay/wd-overlay.vue'
import WdTransition from '../wd-transition/wd-transition.vue'
import WdRootPortal from '../wd-root-portal/wd-root-portal.vue'
import { popupProps } from './types'
import type { TransitionName } from '../wd-transition/types'
import { getSystemInfo } from '../../common/util'
import { COOLGREY } from '../../common/theme'

const props = defineProps(popupProps)
const emit = defineEmits([
  'update:modelValue',
  'before-enter',
  'enter',
  'before-leave',
  'leave',
  'after-leave',
  'after-enter',
  'click-modal',
  'close'
])

/**
 * 弹出位置
 */
const transitionName = computed<TransitionName | TransitionName[]>(() => {
  if (props.transition) {
    return props.transition
  }
  if (props.position === 'center') {
    return ['zoom-in', 'fade']
  }
  if (props.position === 'left') {
    return 'slide-left'
  }
  if (props.position === 'right') {
    return 'slide-right'
  }
  if (props.position === 'bottom') {
    return 'slide-up'
  }
  if (props.position === 'top') {
    return 'slide-down'
  }
  return 'slide-up'
})

const safeBottom = ref<number>(0)

// 关闭图标颜色：Lynx 的 svg content 不继承 CSS currentColor，需显式下发颜色；
// 取辅助灰（--wot-icon-auxiliary 的 JS 令牌常量），在浅填充圆底的明暗主题下均清晰。
const closeIconColor = COOLGREY[6]

const style = computed(() => {
  return `z-index:${props.zIndex}; padding-bottom: ${safeBottom.value}px;${props.customStyle}`
})

const rootClass = computed(() => {
  return `wd-popup wd-popup--${props.position} ${!props.transition && props.position === 'center' ? 'is-deep' : ''} ${
    props.round ? 'is-round' : ''
  } ${props.customClass || ''}`
})

onBeforeMount(() => {
  if (props.safeAreaInsetBottom) {
    const { safeArea, screenHeight, safeAreaInsets } = getSystemInfo()

    if (safeArea) {
      safeBottom.value = screenHeight - (safeArea!.bottom || 0)
      safeBottom.value = safeAreaInsets ? safeAreaInsets.bottom : 0
    } else {
      safeBottom.value = 0
    }
  }
})

function handleClickModal() {
  emit('click-modal')
  if (props.closeOnClickModal) {
    close()
  }
}

function close() {
  emit('close')
  emit('update:modelValue', false)
}
</script>

