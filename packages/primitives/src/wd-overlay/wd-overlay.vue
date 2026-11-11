/*
 * wd-overlay — 遮罩层
 *
 * Lynx 实现说明：
 * - 基于 WdTransition 的 fade 过渡；disable-touch-move 只建立冒泡 catch 边界，
 *   原生默认滚动由 useLockScroll + 宿主 scroll-enable 通道关闭。
 *   不在包裹组件上重复绑定原生 touchmove（CONVENTIONS §14）。
 * - Popup 与其遮罩共享 owner，独立遮罩自己持有 lease；leave 完成/卸载才释放。
 * - fixed 全屏定位；customStyle 的字符串和对象均经 parseStyle 归一。
 * - 引擎 tap 双轨转发为 click / tap，保留官方 API 并防止监听透传合并。
 * - **宽高按窗口像素显式下发**（真机 2026-11-05 修复）：`.wd-overlay` 是
 *   `position: fixed` + `display: flex` 的节点，真机上按**内容尺寸**收缩、
 *   四边 0 撑不开（CONVENTIONS §19 差异 #10——wd-toast 2026-11-01、
 *   wd-popup 2026-11-05 同款缺陷）。2026-11-02 给遮罩补 `display: flex`
 *   （让消费方插槽里的 `flex: 1` 内容能撑满居中）时把这条触发了：遮罩塌成
 *   0×0 贴在屏幕左上角，于是「弹层没有全屏遮罩」「点遮罩关不掉」——键盘
 *   （默认无关闭按钮，只靠遮罩关闭）会被卡在关不掉。修法与 toast/popup
 *   相同：四边 0 保留在 CSS 类里，宽高经 Style Funnel 每帧显式下发。
 */
<script lang="ts" setup>
import './index.css'

import { computed, inject, ref, watch } from 'vue-lynx'
import WdTransition from '../wd-transition/wd-transition.vue'
import { overlayProps } from './types'
import { parseStyle } from '@wot-lynx/core/common/util'
import { useViewportSize } from '@wot-lynx/core/composables/useWideViewport'
import { createStyleResolver, defineStyleKeys } from '@wot-lynx/core/common/style'
import { SCROLL_LOCK_OWNER_KEY, useLockScroll } from '@wot-lynx/core/composables/useLockScroll'

const props = defineProps(overlayProps)
const emit = defineEmits([
  'click',
  'tap',
  'before-enter',
  'enter',
  'after-enter',
  'before-leave',
  'leave',
  'after-leave'
])

// show=false 只是开始 leave；仍在场时继续占用 lease，最后一层离场后才解锁。
const inPlace = ref(props.show)
watch(() => props.show, (show) => { if (show) inPlace.value = true }, { flush: 'sync' })
useLockScroll(() => props.lockScroll && inPlace.value, inject(SCROLL_LOCK_OWNER_KEY, undefined))

/**
 * 窗口尺寸（真机 2026-11-05 修复的下半场）。
 *
 * `position: fixed` + `display: flex` 的节点在真机上按内容尺寸收缩，四边 0
 * 撑不开（CONVENTIONS §19 差异 #10）：wd-toast（2026-11-01）与 wd-popup
 * （2026-11-05）都因此整片塌到屏幕左上角，修法都是「宽高按窗口尺寸显式
 * 下发」。遮罩 2026-11-02 为插槽内容补 `display: flex` 后落入同一条差异，
 * 却漏了这层修复：空插槽的遮罩塌成 0×0，带插槽的（image-preview /
 * video-preview 的全屏底板）塌成内容尺寸——表现分别是「弹层没有全屏
 * 遮罩、点遮罩关不掉」与「预览内容挤在左上角」。
 *
 * 重新展示时重读宿主信息，避免早期缺省值被 setup 快照固化（同 wd-popup）。
 */
const { width: viewportWidth, height: viewportHeight, refresh: refreshViewport } = useViewportSize()
watch(() => props.show, refreshViewport, { immediate: true, flush: 'sync' })

const resolveTransitionStyle = createStyleResolver({
  'z-index': '1',
  // 中性值只在「某帧未下发」时兜底；正常每帧都写显式窗口像素（见上方注释）
  width: '100%',
  height: '100%'
})
const transitionStyle = computed(() => resolveTransitionStyle(
  {
    'z-index': String(props.zIndex),
    width: `${viewportWidth.value}px`,
    height: `${viewportHeight.value}px`
  },
  parseStyle(props.customStyle)
))

function handleAfterLeave() {
  // 重开会取消 leave；即使宿主晚到一条旧回调，也不能释放新一轮展示的锁。
  if (!props.show) inPlace.value = false
  emit('after-leave')
}

function handleClick(event?: any) {
  // click 与 tap 同源同载荷：wot-ui 的 @click 消费方常读事件对象，
  // 丢载荷会让两条轨行为不对称。
  emit('click', event)
  emit('tap', event)
}
</script>

<template>
  <WdTransition
    :show="show"
    name="fade"
    :custom-class="`wd-overlay ${customClass}`"
    :duration="duration"
    :custom-style="transitionStyle"
    :disable-touch-move="lockScroll"
    @before-enter="emit('before-enter')"
    @enter="emit('enter')"
    @after-enter="emit('after-enter')"
    @before-leave="emit('before-leave')"
    @leave="emit('leave')"
    @after-leave="handleAfterLeave"
    @tap="handleClick"
  >
    <slot />
  </WdTransition>
</template>
