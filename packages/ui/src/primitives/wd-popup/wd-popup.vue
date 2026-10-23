/*
 * wd-popup — 弹出层
 *
 * Lynx 实现说明（相对 wot-ui 2.3.2 的适配点）：
 * - 结构：wd-root-portal（可选）> view.wd-popup-wrapper > [wd-overlay + wd-transition]，
 *   与 wot-ui 一致；Lynx 中 position: fixed 节点由引擎提升至页面根节点，
 *   无需 teleport，root-portal  prop 仅决定是否套 wd-root-portal 主题镜像容器；
 * - 参考源在 wd-overlay 上补绑 @touchmove="noop" 锁滚：Lynx 的锁滚已由
 *   wd-overlay → wd-transition 的 disable-touch-move 链路承担，禁止在包裹层
 *   再绑裸 @touchmove（同名 on* 监听会被 mergeProps 合成数组，事件派发即崩，
 *   CONVENTIONS §14），故删除；
 * - 遮罩点击：wd-overlay 把 transition 根 view 的引擎原生 tap 重新 emit 为
 *   click 与 tap（Lynx view 不派发 click，只派发 tap，CONVENTIONS §14），
 *   此处绑 @click 与 wot-ui API 对齐；
 * - safeAreaInsetBottom：参考源读 getSystemInfo().safeAreaInsets.bottom
 *   （MP-WEIXIN 走 screenHeight - safeArea.bottom 分支），Lynx 的 SystemInfo
 *   不提供安全区数据（CONVENTIONS §7：置零、可由宿主注入），宿主注入
 *   SystemInfo.safeAreaInsets 时取 bottom，否则降级为 0；
 * - 样式由参考源的字符串拼接（z-index/padding-bottom/customStyle）改为对象
 *   语法并经 parseStyle 归一 customStyle（字符串 :style 会被 vue-lynx 静默
 *   丢弃，CONVENTIONS §19）；z-index 与 padding-bottom 经 Style Funnel
 *   （defineStyleKeys + resolveStyle）每帧写全，条件由真转假时回落中性值
 *   0px（CONVENTIONS §20）；
 * - 根节点三件套（NATIVE-REWRITE §3.1）：.wd-popup 显式 display: flex +
 *   flex-direction: column——Lynx 3.x 默认 linear 布局下 flex-direction
 *   会被静默丢弃；贴边位置（top/bottom/left/right）内容自贴边起纵向排布；
 * - 过渡动画名：参考源 center 位置返回 ['zoom-in', 'fade'] 数组（uni-app
 *   transition 的多样式名），本地 wd-transition 底层框架仅接受单 name，
 *   取首个元素 'zoom-in'，行为与参考源一致。
 */
<script lang="ts" setup>
import './index.css'

import { computed, ref, watch } from 'vue-lynx'
import WdOverlay from '../wd-overlay/wd-overlay.vue'
import WdTransition from '../wd-transition/wd-transition.vue'
import WdRootPortal from '../wd-root-portal/wd-root-portal.vue'
import WdIcon from '../wd-icon/wd-icon.vue'
import { popupProps, type PopupType } from './types'
import type { TransitionName } from '../wd-transition/types'
import { getSystemInfo, parseStyle } from '../../common/util'
import { defineStyleKeys, resolveStyle } from '../../common/style'

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

/**
 * 弹层根节点可切换样式键（CONVENTIONS §20）：z-index 由 prop 驱动、
 * padding-bottom 由 safeAreaInsetBottom 的有无驱动，两者都可能在同一实例上
 * 切换，故经 Style Funnel 每帧输出完整键集，中性值为「视觉上等同于不设置」。
 */
const POPUP_STYLE = defineStyleKeys({
  'z-index': '10',
  'padding-bottom': '0px'
})

const style = computed<Record<string, string>>(() => {
  return {
    ...resolveStyle(POPUP_STYLE, {
      'z-index': String(props.zIndex),
      'padding-bottom': `${safeBottom.value}px`
    }),
    ...parseStyle(props.customStyle)
  }
})

const rootClass = computed(() => {
  const classes = [
    'wd-popup',
    `wd-popup--${props.position}`,
    // 未显式指定 transition 的居中弹出使用更深的缩放（is-deep）
    !props.transition && props.position === 'center' ? 'is-deep' : '',
    props.round ? 'is-round' : '',
    props.customClass || ''
  ]
  return classes.filter(Boolean).join(' ')
})

watch(() => props.safeAreaInsetBottom, (enabled) => {
  safeBottom.value = 0
  if (enabled) {
    const { safeAreaInsets } = getSystemInfo()

    if (safeAreaInsets) {
      safeBottom.value = Number(safeAreaInsets.bottom) || 0
    } else {
      safeBottom.value = 0
    }
  }
}, { immediate: true })

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

<template>
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
        <WdIcon v-if="closable" custom-class="wd-popup__close" name="close" @tap="close" />
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
      <WdIcon v-if="closable" custom-class="wd-popup__close" name="close" @tap="close" />
    </WdTransition>
  </view>
</template>
