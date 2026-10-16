/*
 * wd-toast — 轻提示
 *
 * Lynx 实现说明：
 * - 结构：wd-overlay（可选遮罩）+ wd-transition（fade）+ 内容视图；
 * - 定位 position: fixed 全屏 + flex 居中（top/middle/bottom 切换
 *   align-items），由引擎提升至页面根节点；
 * - 命令式 API 经 useToast(selector) 驱动（模块级注入，单例）。
 */
<script lang="ts" setup>
import './index.css'

import { computed, inject, ref, watch } from 'vue-lynx'
import WdIcon from '../wd-icon/wd-icon.vue'
import WdLoading from '../wd-loading/wd-loading.vue'
import WdOverlay from '../wd-overlay/wd-overlay.vue'
import WdTransition from '../wd-transition/wd-transition.vue'
import { defaultOptions, getToastOptionKey, toastIcon } from '.'
import { toastProps, type ToastDirection, type ToastLoadingType, type ToastOptions } from './types'
import { addUnit, isDef, isFunction, filterStyle } from '../../common/util'

const props = defineProps(toastProps)

const iconName = ref<string>('')
const msg = ref<string>('')
const position = ref<string>('middle')
const show = ref<boolean>(false)
const zIndex = ref<number>(100)
const loadingType = ref<ToastLoadingType>('circular')
const loadingColor = ref<string>('#ffffff')
const iconSize = ref<string>()
const iconColor = ref<string>()
const loadingSize = ref<string>()
const cover = ref<boolean>(false)
const classPrefix = ref<string>('wd-icon')
const iconClass = ref<string>('')
const cssIcon = ref<boolean | string>(false)
const direction = ref<ToastDirection>('horizontal')

let opened: (() => void) | null = null
let closed: (() => void) | null = null

const toastOptionKey = getToastOptionKey(props.selector)
const toastOption = inject(toastOptionKey, ref<ToastOptions>(defaultOptions))

watch(
  () => toastOption.value,
  (newVal: ToastOptions) => {
    reset(newVal)
  },
  { deep: true, immediate: true }
)

const transitionStyle = computed(() => {
  const style: Record<string, string> = {
    'z-index': String(zIndex.value),
    position: 'fixed',
    left: '0',
    width: '100%',
    'text-align': 'center',
    'pointer-events': 'none'
  }
  // top / bottom / transform 必须**每个分支都显式写全**：Lynx 的 SetStyle 是逐属性
  // 合并语义，省略的键不会清除元素上已应用的内联属性。wd-transition 默认走 v-show
  // 分支（元素常驻、不卸载），同一实例从 position='top' 切到 'bottom' 时若不重置，
  // 会同时存在 top 与 bottom → 位置错乱；从 'middle' 切到其他位置时
  // translateY(-50%) 同样会残留。（`auto` 用法同 wd-slider 的 `right: auto`。）
  if (position.value === 'top') {
    style.top = '10%'
    style.bottom = 'auto'
    style.transform = 'none'
    style['align-items'] = 'flex-start'
  } else if (position.value === 'bottom') {
    style.top = 'auto'
    style.bottom = '10%'
    style.transform = 'none'
    style['align-items'] = 'flex-end'
  } else if (position.value === 'middle-top') {
    // 偏上居中：贴合顶部但不贴边（wot-ui 语义），水平居中
    style.top = '20%'
    style.bottom = 'auto'
    style.transform = 'none'
    style['align-items'] = 'center'
  } else {
    style.top = '50%'
    style.bottom = 'auto'
    style.transform = 'translateY(-50%)'
    style['align-items'] = 'center'
  }
  return filterStyle(style)
})

const rootClass = computed(() => {
  const classes = ['wd-toast']
  if (direction.value === 'vertical') classes.push('wd-toast--vertical')
  if (props.customClass) classes.push(props.customClass)
  return classes.join(' ')
})

function reset(options: ToastOptions) {
  if (isDef(options.iconName)) iconName.value = options.iconName
  if (isDef(options.msg)) msg.value = options.msg
  if (isDef(options.position)) position.value = options.position
  if (isDef(options.zIndex)) zIndex.value = options.zIndex
  if (isDef(options.loadingType)) loadingType.value = options.loadingType
  if (isDef(options.loadingColor)) loadingColor.value = options.loadingColor
  if (isDef(options.cover)) cover.value = options.cover
  if (isDef(options.classPrefix)) classPrefix.value = options.classPrefix
  if (isDef(options.iconClass)) iconClass.value = options.iconClass
  if (isDef(options.cssIcon)) cssIcon.value = options.cssIcon
  if (isDef(options.direction)) direction.value = options.direction
  if (isDef(options.iconSize)) iconSize.value = addUnit(options.iconSize)
  if (isDef(options.iconColor)) iconColor.value = options.iconColor
  if (isDef(options.loadingSize)) loadingSize.value = addUnit(options.loadingSize)

  opened = isFunction(options.opened) ? options.opened : null
  closed = isFunction(options.closed) ? options.closed : null
  show.value = options.show === true
}

function handleAfterEnter() {
  opened && opened()
}

function handleAfterLeave() {
  closed && closed()
}
</script>

<template>
  <wd-overlay v-if="cover" :z-index="zIndex" lock-scroll :show="show" custom-style="background-color: transparent; pointer-events: auto;" />
  <wd-transition name="fade" :show="show" :custom-style="transitionStyle" @after-enter="handleAfterEnter" @after-leave="handleAfterLeave">
    <view :class="rootClass">
      <wd-loading
        v-if="iconName === 'loading'"
        :type="loadingType"
        :color="loadingColor"
        :size="loadingSize"
        :custom-class="`wd-toast__icon ${direction === 'vertical' ? 'wd-toast__icon--vertical' : ''}`"
      />
      <wd-icon
        v-else-if="iconName === 'success' || iconName === 'warning' || iconName === 'info' || iconName === 'error'"
        :custom-class="`wd-toast__icon ${direction === 'vertical' ? 'wd-toast__icon--vertical' : ''}`"
        :size="iconSize"
        :class-prefix="classPrefix"
        :color="iconColor"
        :name="toastIcon[iconName]"
      />
      <wd-icon
        v-else-if="iconClass || cssIcon"
        :custom-class="`wd-toast__icon ${direction === 'vertical' ? 'wd-toast__icon--vertical' : ''}`"
        :size="iconSize"
        :class-prefix="classPrefix"
        :color="iconColor"
        :name="iconClass"
        :css-icon="cssIcon"
      />
      <view v-if="msg" :class="`wd-toast__msg ${direction === 'vertical' ? 'wd-toast__msg--vertical' : ''}`">
        <text>{{ msg }}</text>
      </view>
    </view>
  </wd-transition>
</template>
