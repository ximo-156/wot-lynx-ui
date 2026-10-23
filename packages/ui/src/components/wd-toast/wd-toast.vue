/*
 * wd-toast — 轻提示
 *
 * Lynx 实现说明（相对 wot-ui 2.3.2 的适配点）：
 * - 结构：wd-overlay（可选遮罩）+ wd-transition（fade）+ 内容视图，与 wot-ui 一致；
 * - 定位：过渡根视图按 NATIVE-REWRITE §3.2 / CONVENTIONS §9 用「四边 0 +
 *   flex 成对居中」撑满视口——该节点自身透明（pointer-events: none）、
 *   不承载背景，不存在把遮罩涂满的问题，故禁用 left/top 50% + translate；
 *   水平居中由 align-items 承担，垂直居中由 justify-content 承担。
 *   position 变体的上下偏移由 .wd-toast--top / --middle-top / --bottom 的
 *   transform 在居中基准上施加（沿用 wot-ui 同值：top/middle-top/bottom
 *   相对居中线的 -40vh / -18.8vh / +40vh 换算为 SystemInfo 窗口 px，
 *   非 middle 变体补半个内容高度，恢复参考源 top:50% 的顶部基准）；middle 变体
 *   取中性值 none；
 * - wot-ui 靠 text-align: center + display: inline-block 让 toast 水平居中，
 *   Lynx 无行内流式布局（CONVENTIONS §15：inline-block/inline-flex → flex），
 *   故过渡根视图补 flex-direction: column + align-items: center 承担水平居中；
 * - 参考源的 objToStyle 字符串样式改为对象语法（字符串 :style 会被 vue-lynx
 *   静默丢弃，CONVENTIONS §19）；根视图样式经 Style Funnel 输出完整键集，
 *   不随 position 变化、也不出现条件写样式（CONVENTIONS §20）；
 * - 图标使用官方 wot 字体与原始名称。
 * - 命令式 API 经 useToast(selector) 驱动（模块级注入单例），本地增加
 *   useAlive 守卫与页面卸载时的定时器清理（晚到写入已销毁树会触发真机 9902）。
 */
<script lang="ts" setup>
import './index.css'

import { computed, inject, ref, watch } from 'vue-lynx'
import WdIcon from '../../primitives/wd-icon/wd-icon.vue'
import WdLoading from '../../primitives/wd-loading/wd-loading.vue'
import WdOverlay from '../../primitives/wd-overlay/wd-overlay.vue'
import WdTransition from '../../primitives/wd-transition/wd-transition.vue'
import { defaultOptions, getToastOptionKey, toastIcon } from '.'
import { toastProps, type ToastDirection, type ToastLoadingType, type ToastOptions, type ToastProps } from './types'
import { addUnit, getSystemInfo, isDef, isFunction } from '../../common/util'
import { defineStyleKeys, resolveStyle } from '../../common/style'

const props = defineProps(toastProps)

const iconName = ref<string>('') // 图标类型
const msg = ref<string>('') // 消息内容
const position = ref<string>('middle')
const show = ref<boolean>(false)
const zIndex = ref<number>(100)
const loadingType = ref<ToastLoadingType>('circular')
const loadingColor = ref<string>('#fff')
const iconSize = ref<string>() // 图标大小
const iconColor = ref<string>() // 图标颜色
const loadingSize = ref<string>() // loading大小
const cover = ref<boolean>(false) // 是否存在遮罩层
const classPrefix = ref<string>('wd-icon') // 图标前缀
const iconClass = ref<string>('') // 图标类名
const cssIcon = ref<boolean | string>(false) // CSS 图标
const direction = ref<ToastDirection>('horizontal') // toast布局方向

let opened: (() => void) | null = null

let closed: (() => void) | null = null

const toastOptionKey = getToastOptionKey(props.selector)
const toastOption = inject(toastOptionKey, ref<ToastOptions>(defaultOptions)) // toast选项

// 监听options变化展示
watch(
  () => toastOption.value,
  (newVal: ToastOptions) => {
    reset(newVal)
  },
  {
    deep: true,
    immediate: true
  }
)

/**
 * 过渡根视图样式（对象语法；Style Funnel 完整键集，不随 position 变化）。
 *
 * 四边 0 + flex 成对居中：该 fixed 节点透明、仅作定位harness（承载背景的
 * 是 .wd-toast 自身），按 NATIVE-REWRITE §3.2 / CONVENTIONS §9 撑满视口
 * 并用 flex 居中，禁 left/top 50% + translate；z-index 随选项变化，
 * 与其余键一起每帧写全（CONVENTIONS §20）。
 */
const TOAST_ROOT_STYLE = defineStyleKeys({
  position: 'fixed',
  left: '0px',
  right: '0px',
  top: '0px',
  bottom: '0px',
  display: 'flex',
  'flex-direction': 'column',
  'align-items': 'center',
  'justify-content': 'center',
  'text-align': 'center',
  'pointer-events': 'none',
  'z-index': '100'
})

const transitionStyle = computed<Record<string, string>>(() => resolveStyle(TOAST_ROOT_STYLE, { 'z-index': String(zIndex.value) }))

const contentStyle = computed(() => {
  const offsets: Record<string, number> = { top: -0.4, 'middle-top': -0.188, bottom: 0.4 }
  const ratio = offsets[position.value]
  return { transform: isDef(ratio) ? `translate3d(0, ${getSystemInfo().windowHeight * ratio}px, 0) translateY(50%)` : 'none' }
})

const rootClass = computed(() => {
  const classes = [
    'wd-toast',
    props.customClass,
    `wd-toast--${position.value}`,
    (iconName.value !== 'loading' || msg.value) && (iconName.value || iconClass.value || cssIcon.value) ? 'wd-toast--with-icon' : '',
    iconName.value === 'loading' && !msg.value ? 'wd-toast--loading' : '',
    direction.value === 'vertical' ? 'is-vertical' : ''
  ]
  return classes.filter(Boolean).join(' ')
})

function handleAfterEnter() {
  if (isFunction(opened)) {
    opened()
  }
}

function handleAfterLeave() {
  if (isFunction(closed)) {
    closed()
  }
}

/**
 * 重置toast选项值
 * @param option toast选项值
 */
function reset(option: ToastOptions) {
  show.value = isDef(option.show) ? option.show : false

  if (show.value) {
    mergeOptionsWithProps(option, props)
  }
}

function mergeOptionsWithProps(option: ToastOptions, props: ToastProps) {
  iconName.value = isDef(option.iconName!) ? option.iconName! : props.iconName
  iconClass.value = isDef(option.iconClass!) ? option.iconClass! : props.iconClass
  cssIcon.value = isDef(option.cssIcon!) ? option.cssIcon! : props.cssIcon
  msg.value = isDef(option.msg!) ? option.msg! : props.msg
  position.value = isDef(option.position!) ? option.position! : props.position
  zIndex.value = isDef(option.zIndex!) ? option.zIndex! : props.zIndex
  loadingType.value = isDef(option.loadingType!) ? option.loadingType! : props.loadingType
  loadingColor.value = isDef(option.loadingColor!) ? option.loadingColor! : props.loadingColor
  iconSize.value = isDef(option.iconSize) ? addUnit(option.iconSize) : isDef(props.iconSize) ? addUnit(props.iconSize) : undefined
  iconColor.value = isDef(option.iconColor!) ? option.iconColor! : props.iconColor
  loadingSize.value = isDef(option.loadingSize) ? addUnit(option.loadingSize) : isDef(props.loadingSize) ? addUnit(props.loadingSize) : undefined
  cover.value = isDef(option.cover!) ? option.cover! : props.cover
  classPrefix.value = isDef(option.classPrefix) ? option.classPrefix : props.classPrefix
  direction.value = isDef(option.direction) ? option.direction : props.direction
  closed = isFunction(option.closed) ? option.closed : isFunction(props.closed) ? props.closed : null
  opened = isFunction(option.opened) ? option.opened : isFunction(props.opened) ? props.opened : null
}
</script>

<template>
  <!-- WdOverlay 统一解析字符串和对象样式。 -->
  <WdOverlay v-if="cover" :z-index="zIndex" lock-scroll :show="show" custom-style="background-color: transparent;pointer-events: auto;" />
  <WdTransition name="fade" :show="show" :custom-style="transitionStyle" @after-enter="handleAfterEnter" @after-leave="handleAfterLeave">
    <view :class="rootClass" :style="contentStyle">
      <!--iconName优先级更高-->
      <WdLoading
        v-if="iconName === 'loading'"
        :type="loadingType"
        :color="loadingColor"
        :size="loadingSize"
        :custom-class="`wd-toast__icon ${direction === 'vertical' ? 'is-vertical' : ''}`"
      />

      <WdIcon
        v-else-if="iconName === 'success' || iconName === 'warning' || iconName === 'info' || iconName === 'error'"
        :custom-class="`wd-toast__icon ${direction === 'vertical' ? 'is-vertical' : ''}`"
        :size="iconSize"
        :class-prefix="classPrefix"
        :color="iconColor"
        :name="toastIcon[iconName]"
      ></WdIcon>
      <WdIcon
        v-else-if="iconClass || cssIcon"
        :custom-class="`wd-toast__icon ${direction === 'vertical' ? 'is-vertical' : ''}`"
        :size="iconSize"
        :class-prefix="classPrefix"
        :color="iconColor"
        :name="iconClass"
        :css-icon="cssIcon"
      ></WdIcon>
      <!--文本-->
      <text v-if="msg" :class="`wd-toast__msg ${direction === 'vertical' ? 'is-vertical' : ''}`">{{ msg }}</text>
    </view>
  </WdTransition>
</template>
