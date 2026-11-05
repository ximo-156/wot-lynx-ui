/*
 * wd-popup — 弹出层
 *
 * Lynx 实现说明（相对 wot-ui 2.3.2 的适配点）：
 * - 结构：wd-root-portal（可选）> view.wd-popup-wrapper > [wd-overlay + wd-transition]，
 *   与 wot-ui 一致；Lynx 中 position: fixed 节点由引擎提升至页面根节点，
 *   无需 teleport，root-portal  prop 仅决定是否套 wd-root-portal 主题镜像容器；
 * - Popup 自己持有 useLockScroll lease（不依赖兄弟 Overlay 能收到 panel 手势）；
 *   Popup/自身 Overlay 共享 owner 去重，初始显示立即锁，leave 完成/卸载释放。
 *   disable-touch-move 仅建立冒泡 catch 边界，原生默认滚动经宿主 scroll-enable 锁；
 *   禁止再给包裹组件补同名 touch 监听（CONVENTIONS §14）。
 * - 遮罩点击：wd-overlay 把 transition 根 view 的引擎原生 tap 重新 emit 为
 *   click 与 tap（Lynx view 不派发 click，只派发 tap，CONVENTIONS §14），
 *   此处绑 @click 与 wot-ui API 对齐；
 * - safeAreaInsetBottom：参考源读 getSystemInfo().safeAreaInsets.bottom
 *   （MP-WEIXIN 走 screenHeight - safeArea.bottom 分支），Lynx 的 SystemInfo
 *   不提供安全区数据（CONVENTIONS §7：置零、可由宿主注入），宿主注入
 *   SystemInfo.safeAreaInsets 时取 bottom，否则降级为 0；
 * - 内联样式为对象，createStyleResolver 每帧补全定位/宽高/安全区及曾使用的
 *   customStyle 键；移除定制或切换位置不会留下旧边/尺寸。max-width/max-height
 *   按宿主 windowWidth/windowHeight 限界，border-box 使底部 inset 包含在限界内；
 *   wrapper 明确 position:relative + z-index:0，fixed 仍在过渡根上。
 *   center 保留既有收缩包裹 + translate 定位/缩放契约，不新增全屏不透明父层。
 * - 根节点三件套（NATIVE-REWRITE §3.1）：.wd-popup 显式 display: flex +
 *   flex-direction: column——Lynx 3.x 默认 linear 布局下 flex-direction
 *   会被静默丢弃；贴边位置（top/bottom/left/right）内容自贴边起纵向排布；
 * - 过渡动画名：参考源 center 位置返回 ['zoom-in', 'fade'] 数组（uni-app
 *   transition 的多样式名），本地 wd-transition 底层框架仅接受单 name，
 *   取首个元素 'zoom-in'，行为与参考源一致。
 */
<script lang="ts" setup>
import './index.css'

import { computed, provide, ref, watch } from 'vue-lynx'
import WdOverlay from '../wd-overlay/wd-overlay.vue'
import WdTransition from '../wd-transition/wd-transition.vue'
import WdRootPortal from '../wd-root-portal/wd-root-portal.vue'
import WdIcon from '../wd-icon/wd-icon.vue'
import { popupProps, type PopupType } from './types'
import type { TransitionName } from '../wd-transition/types'
import { getSystemInfo, parseStyle } from '../../common/util'
import { createStyleResolver, defineStyleKeys } from '../../common/style'
import { SCROLL_LOCK_OWNER_KEY, useLockScroll } from '../../composables/useLockScroll'

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

// 遮罩是 panel 的兄弟节点，panel 手势根本不经过它；Popup 自己也必须持锁。
// 自身 Overlay 共用 owner 去重，嵌套 Popup 每层独立，modal=false 同样有效。
const scrollLockOwner = Symbol('popup-scroll-lock-owner')
provide(SCROLL_LOCK_OWNER_KEY, scrollLockOwner)
const inPlace = ref(props.modelValue)
watch(() => props.modelValue, (show) => { if (show) inPlace.value = true }, { flush: 'sync' })
useLockScroll(() => props.lockScroll && inPlace.value, scrollLockOwner)

// fixed 节点的直接父层必须有明确层叠基准；不能在 slot 内再加 fixed。
const WRAPPER_STYLE = { position: 'relative', 'z-index': '0' } as const
const safeBottom = ref(0)
const viewportWidth = ref(375)
const viewportHeight = ref(812)

/** 全量定位键防止 position/customStyle 变动后留下旧的边、宽高和 padding。 */
const POPUP_STYLE = defineStyleKeys({
  position: 'fixed',
  'box-sizing': 'border-box',
  'z-index': '10',
  'padding-bottom': '0px',
  left: 'auto',
  right: 'auto',
  top: 'auto',
  bottom: 'auto',
  width: '',
  height: '',
  'max-width': '100%',
  'max-height': '100%'
})
const PLACEMENT: Record<PopupType, Record<string, string>> = {
  center: { left: '50%', top: '50%' },
  top: { left: '0px', right: '0px', top: '0px' },
  bottom: { left: '0px', right: '0px', bottom: '0px' },
  left: { left: '0px', top: '0px', bottom: '0px' },
  right: { right: '0px', top: '0px', bottom: '0px' }
}
const resolvePopupStyle = createStyleResolver(POPUP_STYLE)
const style = computed(() => resolvePopupStyle(
  PLACEMENT[props.position],
  {
    'z-index': String(props.zIndex),
    'padding-bottom': `${safeBottom.value}px`,
    'max-width': `${viewportWidth.value}px`,
    'max-height': `${viewportHeight.value}px`
  },
  parseStyle(props.customStyle)
))

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

watch([() => props.modelValue, () => props.safeAreaInsetBottom, () => props.position], () => {
  // 重新打开时重读宿主信息，避免早期缺省值/安全区变动被 setup 快照固化。
  const info = getSystemInfo()
  viewportWidth.value = info.windowWidth
  viewportHeight.value = info.windowHeight
  const bottom = Number(info.safeAreaInsets?.bottom)
  safeBottom.value = props.safeAreaInsetBottom && Number.isFinite(bottom)
    ? Math.min(info.windowHeight, Math.max(0, bottom))
    : 0
}, { immediate: true, flush: 'sync' })

function handleAfterLeave() {
  if (!props.modelValue) inPlace.value = false
  emit('after-leave')
}

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
    <view class="wd-popup-wrapper" :style="WRAPPER_STYLE">
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
        :disable-touch-move="lockScroll"
        @before-enter="emit('before-enter')"
        @enter="emit('enter')"
        @after-enter="emit('after-enter')"
        @before-leave="emit('before-leave')"
        @leave="emit('leave')"
        @after-leave="handleAfterLeave"
      >
        <slot />
        <WdIcon v-if="closable" custom-class="wd-popup__close" name="close" @tap="close" />
      </WdTransition>
    </view>
  </WdRootPortal>

  <!-- 非传送模式 -->
  <view v-else class="wd-popup-wrapper" :style="WRAPPER_STYLE">
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
      :disable-touch-move="lockScroll"
      @before-enter="emit('before-enter')"
      @enter="emit('enter')"
      @after-enter="emit('after-enter')"
      @before-leave="emit('before-leave')"
      @leave="emit('leave')"
      @after-leave="handleAfterLeave"
    >
      <slot />
      <WdIcon v-if="closable" custom-class="wd-popup__close" name="close" @tap="close" />
    </WdTransition>
  </view>
</template>
