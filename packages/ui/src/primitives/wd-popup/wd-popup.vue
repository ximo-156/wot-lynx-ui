/*
 * wd-popup — 弹出层
 *
 * Lynx 实现说明（相对 wot-ui 2.3.2 的适配点）：
 * - 结构：wd-root-portal（可选）> view.wd-popup-wrapper
 *   > [wd-overlay + view.wd-popup-harness > wd-transition(.wd-popup)]；
 *   Lynx 中 position: fixed 节点由引擎提升至页面根节点，无需 teleport，
 *   root-portal prop 仅决定是否套 wd-root-portal 主题镜像容器；
 * - Popup 自己持有 useLockScroll lease（不依赖兄弟 Overlay 能收到 panel 手势）；
 *   Popup/自身 Overlay 共享 owner 去重，初始显示立即锁，leave 完成/卸载释放。
 *   disable-touch-move 仅建立冒泡 catch 边界，原生默认滚动经宿主 scroll-enable 锁；
 *   禁止再给包裹组件补同名 touch 监听（CONVENTIONS §14）。
 * - 遮罩点击：wd-overlay 把 transition 根 view 的引擎原生 tap 重新 emit 为
 *   click 与 tap（Lynx view 不派发 click，只派发 tap，CONVENTIONS §14），
 *   此处绑 @click 与 wot-ui API 对齐；
 * - safeAreaInsetBottom：优先使用宿主 safeAreaInsets.bottom；只有 safeArea
 *   矩形时按当前窗口底边与安全区底边计算，避免视口已避让时重复加高。
 *   无有效安全区数据回落 0，不把零占位矩形当作整屏安全距离。
 * - 定位拆两层（真机 2026-11-05 修复，详见 HARNESS_STYLE 注释）：
 *   harness 负责「摆到视口的哪一侧」，面板负责「长什么样 + 播过渡动画」。
 *   内联样式为对象，createStyleResolver 每帧补全定位/宽高/安全区及曾使用的
 *   customStyle 键；移除定制或切换位置不会留下旧边/尺寸。max-width/max-height
 *   按宿主 windowWidth/windowHeight 限界，border-box 使底部 inset 包含在限界内；
 *   wrapper 明确 position:relative 并跟随弹窗 z-index（fixed 在 harness 上）。
 * - 根节点三件套（NATIVE-REWRITE §3.1）：.wd-popup 显式 display: flex +
 *   flex-direction: column——Lynx 3.x 默认 linear 布局下 flex-direction
 *   会被静默丢弃；面板内容纵向排布，位置由 harness 的 flex 对齐决定；
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
import { useIsWideViewport, useViewportSize } from '../../composables/useWideViewport'

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
  if (resolvedPosition.value === 'center') {
    return ['zoom-in', 'fade']
  }
  if (resolvedPosition.value === 'left') {
    return 'slide-left'
  }
  if (resolvedPosition.value === 'right') {
    return 'slide-right'
  }
  if (resolvedPosition.value === 'bottom') {
    return 'slide-up'
  }
  if (resolvedPosition.value === 'top') {
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

// 父层必须与弹窗同层；固定为 0 会把整个 fixed 面板压在背景滚轮的 z-index 下。
const wrapperStyle = computed(() => ({ position: 'relative' as const, 'z-index': String(props.zIndex) }))
const safeBottom = ref(0)
/**
 * 视口尺寸：浏览器端随窗口 `resize` 实时更新（Web 端拖动窗口时，Sheet 的
 * 宽度与遮罩尺寸要跟着变，否则会停在打开那一刻的版式），原生端为宿主尺寸。
 */
const { width: viewportWidth, height: viewportHeight, refresh: refreshViewport } = useViewportSize()
const isWide = useIsWideViewport(viewportWidth)
const responsiveSheet = computed(() => props.responsive && isWide.value && props.position === 'bottom')
const resolvedPosition = computed<PopupType>(() => responsiveSheet.value ? 'center' : props.position)
// Limit sheets on wide screens without expanding controls to display width.
const MAX_SHEET_WIDTH = 480

/**
 * 全屏定位 harness（真机 2026-11-05 修复；结构照 wd-toast 的真机验收版）。
 *
 * 真机缺陷：`position: fixed` + `display: flex` 的节点在真机上按**内容尺寸**
 * 收缩，四边 0 / left+right 撑不开它（wd-toast 2026-11-01 记录过同一缺陷，
 * 症状就是「整片内容贴到屏幕左上角」）。wd-popup 的过渡根恰好是 fixed +
 * flex，于是时间选择器、dialog 等弹层整片塌到屏幕左上角；再叠加本组件每帧
 * 下发的 `left/right/top/bottom: auto`（真机把 auto 边按 0 锚定，见
 * CONVENTIONS §19 差异 2），贴边弹层进一步被拉到顶部；center 的
 * `left/top: 50% + translate3d(-50%,-50%,0)` 同样不是真机可靠写法
 * （CONVENTIONS §19 / NATIVE-REWRITE §3.2 明确禁用）。
 *
 * 修法与 wd-toast 同构，把「定位」和「外观」拆成两层：
 * - harness（本层）：fixed + 四边 0 + **显式窗口像素宽高** + flex 对齐，
 *   透明且 pointer-events: none——只负责把内层面板摆到视口的上/下/左/右/
 *   正中，自身不响应触摸，遮罩（兄弟节点）照旧接收关闭点击；
 * - 面板（过渡根 .wd-popup）：由 harness 的 justify-content / align-items
 *   定位，只承载背景、圆角与过渡 transform，不再自带 fixed 边值。
 *
 * 两层都只写合法定值：既不再出现 `auto` 边，也不再需要 percent + translate。
 *
 * 注：过渡帧（slide-up / zoom-in 等）的 transform 必须留在面板上——若挂到
 * 全屏 harness，整屏都会跟着位移/缩放，动画语义就变了。
 *
 * 主轴摆位用「flex-grow 占位」而非 justify-content 边值（真机 2026-11-05
 * 复测，用户截图反馈「适配太差」）：center 弹层（Dialog / Toast）经
 * justify-content: center 正常居中，但 flex-start / flex-end 在真机上被
 * 按 center 处理——贴边弹层（底部 Popup / Picker / 时间选择器 / 侧边抽屉）
 * 整片贴在屏幕正中而非贴边。改为主轴放一个 `flex-grow: 1` 的空占位 view
 * 吸收剩余空间，把面板挤到目标边；flex-grow 本身在真机可用（同页
 * wd-cell 的 __left / __right flex: 1 两端对齐即证据），且不依赖
 * 「单边 edge 定位」——真机对缺边按 0 锚定（CONVENTIONS §19 差异 #2），
 * `bottom: 0` 单独使用会被缺省 top 的 0 值顶掉（pre-R8 贴左上角同源）。
 * 占位在面板前 = 挤向主轴末端（bottom / right），在面板后 = 挤向主轴
 * 起点（top / left）；center 两侧都不放，沿用已验证的 flex 居中。
 */
const HARNESS_STYLE = defineStyleKeys({
  position: 'fixed',
  left: '0px',
  right: '0px',
  top: '0px',
  bottom: '0px',
  width: '100%',
  height: '100%',
  'box-sizing': 'border-box',
  display: 'flex',
  'flex-direction': 'column',
  // 交叉轴恒为居中：贴边弹层的面板宽度/高度按窗口像素显式下发（下方
  // panelSize），与 harness 等宽等高时居中即“贴满”；消费方改小尺寸
  // （如 notify 悬浮态的左右 12px 内缩）也自然居中而不是偏到一侧。
  'align-items': 'center',
  'justify-content': 'flex-start',
  'pointer-events': 'none',
  'z-index': '10'
})

/**
 * 每个弹出位置的 harness 主轴对齐（键集恒定，只换值，Style Funnel §20）。
 *
 * 注：主轴**摆位**已改由 flex-grow 占位 view 承担（真机 2026-11-05 复测：
 * justify-content 只有 center 生效，flex-start / flex-end 被按 center
 * 处理，贴边弹层会贴在屏幕正中）。这里的边值保留为兜底——占位正常工作时
 * 主轴已无剩余空间可分配，边值不起作用；占位万一失效时仍尽量靠边。
 * 侧边抽屉把主轴换成横向：贴左/贴右由 justify-content 决定，高度由交叉轴
 * （align-items: center + 面板定高）铺满。
 */
const HARNESS_ALIGNMENT: Record<PopupType, Record<string, string>> = {
  center: { 'justify-content': 'center' },
  top: { 'justify-content': 'flex-start' },
  bottom: { 'justify-content': 'flex-end' },
  // 侧边抽屉把主轴换成横向：贴左/贴右由 justify-content 决定，高度由交叉轴
  // （align-items: center + 面板定高）铺满
  left: { 'flex-direction': 'row', 'justify-content': 'flex-start' },
  right: { 'flex-direction': 'row', 'justify-content': 'flex-end' }
}
const resolveHarnessStyle = createStyleResolver(HARNESS_STYLE)
const harnessStyle = computed(() => resolveHarnessStyle(
  HARNESS_ALIGNMENT[resolvedPosition.value],
  {
    'z-index': String(props.zIndex),
    // 真机不认「四边 0 + flex」的尺寸推导，宽高按窗口尺寸显式下发
    width: `${viewportWidth.value}px`,
    height: `${viewportHeight.value}px`
  }
))

/**
 * 主轴占位 view 的摆位（详见文件头「主轴摆位用 flex-grow 占位」注释）。
 * bottom / right：占位在面板**前**，吸收主轴前段空间，把面板挤到末端；
 * top / left：占位在面板**后**，吸收主轴后段空间，把面板顶到起点；
 * center：不放占位，面板是 harness 唯一流式子项，由 justify-content:
 * center 居中（真机已验证）。
 */
const spacerBefore = computed(() => resolvedPosition.value === 'bottom' || resolvedPosition.value === 'right')
const spacerAfter = computed(() => resolvedPosition.value === 'top' || resolvedPosition.value === 'left')

/**
 * 内层面板（过渡根）样式：全量键集防止 position/customStyle 变动后留下旧边、
 * 宽高和 padding。
 * - 四边恒为 0px：面板已是 harness 的 flex 子项，边值只为「清掉消费方曾用过
 *   的边」而存在，恒定额 0px 在 relative 下等于不偏移；不再写 `auto`
 *   （真机把 auto 边按 0 锚定，正是贴左上角的直接原因）；
 * - 贴边弹层用显式窗口像素给宽/高，不依赖引擎对 flex 拉伸的推导；
 *   center 与侧边抽屉的交叉轴取 auto，由内容收缩包裹；
 * - **不写 position**：面板默认定位由 `.wd-popup` 的 `position: relative`
 *   类承担，而 wd-drop-menu-item 等消费方会用 `.wd-xxx__popup` 覆盖成
 *   `position: absolute`（各自已在自己的全屏包裹层里算好边值）。内联
 *   position 的优先级高于类，一旦写死就会把这些覆盖全部压掉——这里的
 *   position 永不切换，因此不属于 Style Funnel 需要登记的键。
 *   绝对定位消费方的包含块是 harness（全屏 fixed），与它们此前
 *   `position: fixed` 的视口锚定一致，落点不变。
 */
const POPUP_STYLE = defineStyleKeys({
  'box-sizing': 'border-box',
  'z-index': '10',
  'padding-bottom': '0px',
  left: '0px',
  right: '0px',
  top: '0px',
  bottom: '0px',
  width: 'auto',
  height: 'auto',
  'max-width': '100%',
  'max-height': '100%',
  // 继承自 harness 的 none 必须显式放开，否则面板内所有交互失效
  // （wd-drop-menu-item 的全屏包裹层同用法）
  'pointer-events': 'auto',
  // 面板高度由内容决定：Harness 主轴方向不允许被压缩，否则内容会被裁掉
  // 而 overflow-y 滚不动（CONVENTIONS §19「flex 子项默认 flex-shrink: 1」）
  'flex-shrink': '0'
})
const resolvePopupStyle = createStyleResolver(POPUP_STYLE)

/**
 * 贴边 Sheet 的面板宽度：手机端等于视口宽，宽屏端封顶 `MAX_SHEET_WIDTH`
 * 并由 harness 的 `align-items: center` 居中（两侧自然留白）。
 *
 * 只作用于 `position` 为 top/bottom 的 Sheet——侧边抽屉（left/right）本来就
 * 不占满宽度，居中弹层（center）宽度由内容 / customStyle 决定。
 */
const sheetWidth = computed(() => props.responsive && isWide.value
  ? Math.min(MAX_SHEET_WIDTH, Math.max(1, viewportWidth.value - 48))
  : viewportWidth.value)

const style = computed(() => {
  const size: Record<string, string> = responsiveSheet.value
    ? { width: `${sheetWidth.value}px`, height: 'auto' }
    : resolvedPosition.value === 'top' || resolvedPosition.value === 'bottom'
      ? { width: `${sheetWidth.value}px`, height: 'auto' }
      : resolvedPosition.value === 'left' || resolvedPosition.value === 'right'
        ? { width: 'auto', height: `${viewportHeight.value}px` }
        : { width: 'auto', height: 'auto' }
  const margin = props.responsive && isWide.value && resolvedPosition.value === 'center' ? 48 : 0
  return resolvePopupStyle(
    size,
    {
      'z-index': String(props.zIndex),
      'padding-bottom': `${safeBottom.value}px`,
      'max-width': `${Math.max(1, viewportWidth.value - margin)}px`,
      'max-height': `${Math.max(1, viewportHeight.value - margin)}px`
    },
    parseStyle(props.customStyle)
  )
})

const rootClass = computed(() => {
  const classes = [
    'wd-popup',
    `wd-popup--${resolvedPosition.value}`,
    // 未显式指定 transition 的居中弹出使用更深的缩放（is-deep）
    !props.transition && resolvedPosition.value === 'center' ? 'is-deep' : '',
    props.round ? 'is-round' : '',
    props.responsive && isWide.value ? 'is-wide' : '',
    props.customClass || ''
  ]
  return classes.filter(Boolean).join(' ')
})

watch(() => props.modelValue, refreshViewport, { flush: 'sync' })
watch([() => props.modelValue, () => props.safeAreaInsetBottom, () => resolvedPosition.value, viewportHeight], () => {
  const info = getSystemInfo()
  const inset = info.safeAreaInsets?.bottom
  const areaBottom = Number(info.safeArea?.bottom)
  const viewportBottom = info.windowTop + info.windowHeight
  const bottom = inset != null && Number.isFinite(Number(inset))
    ? Number(inset)
    : Number.isFinite(areaBottom) && areaBottom > 0 ? viewportBottom - areaBottom : 0
  safeBottom.value = props.safeAreaInsetBottom && !responsiveSheet.value
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
    <view class="wd-popup-wrapper" :style="wrapperStyle">
      <WdOverlay
        v-if="modal"
        :show="modelValue"
        :z-index="zIndex"
        :lock-scroll="lockScroll"
        :duration="duration"
        :custom-style="modalStyle"
        @click="handleClickModal"
      />
      <view class="wd-popup-harness" :style="harnessStyle">
        <!-- 主轴占位：贴边弹层把面板挤到目标边（flex-grow，真机可用）；
             center 不渲染，面板经 justify-content: center 居中 -->
        <view v-if="spacerBefore" class="wd-popup-spacer" />
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
        <view v-if="spacerAfter" class="wd-popup-spacer" />
      </view>
    </view>
  </WdRootPortal>

  <!-- 非传送模式 -->
  <view v-else class="wd-popup-wrapper" :style="wrapperStyle">
    <WdOverlay
      v-if="modal"
      :show="modelValue"
      :z-index="zIndex"
      :lock-scroll="lockScroll"
      :duration="duration"
      :custom-style="modalStyle"
      @click="handleClickModal"
    />
    <view class="wd-popup-harness" :style="harnessStyle">
      <!-- 主轴占位：贴边弹层把面板挤到目标边（flex-grow，真机可用）；
           center 不渲染，面板经 justify-content: center 居中 -->
      <view v-if="spacerBefore" class="wd-popup-spacer" />
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
      <view v-if="spacerAfter" class="wd-popup-spacer" />
    </view>
  </view>
</template>
