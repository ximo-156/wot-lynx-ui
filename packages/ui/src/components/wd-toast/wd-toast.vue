<template>
  <WdOverlay v-if="cover" :z-index="zIndex" lock-scroll :show="show" custom-style="background-color: transparent;pointer-events: auto;"></WdOverlay>
  <WdTransition name="fade" :show="show" :custom-style="transitionStyle" @after-enter="handleAfterEnter" @after-leave="handleAfterLeave">
    <view :class="rootClass">
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
      <view v-if="msg" :class="`wd-toast__msg ${direction === 'vertical' ? 'is-vertical' : ''}`"><text>{{ msg }}</text></view>
    </view>
  </WdTransition>
</template>

<script setup lang="ts">
import './index.css'
import WdIcon from '../wd-icon/wd-icon.vue'
import WdLoading from '../wd-loading/wd-loading.vue'
import WdOverlay from '../wd-overlay/wd-overlay.vue'
import WdTransition from '../wd-transition/wd-transition.vue'

import {computed, inject, ref, watch} from 'vue-lynx'
import { defaultOptions, getToastOptionKey, toastIcon } from '.'
import { toastProps, type ToastDirection, type ToastLoadingType, type ToastOptions, type ToastProps } from './types'
import { type CSSProperties, addUnit, isDef, isFunction, objToStyle } from '../../common/util'
import { WHITE } from '../../common/theme'

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
 * 动画自定义样式
 */
const transitionStyle = computed(() => {
  const style: CSSProperties = {
    'z-index': zIndex.value,
    position: 'fixed',
    top: '50%',
    left: 0,
    width: '100%',
    // transform: 'translate(0, -50%)',
    'text-align': 'center',
    'pointer-events': 'none'
  }
  return objToStyle(style)
})

const rootClass = computed(() => {
  return `wd-toast ${props.customClass} wd-toast--${position.value} ${
    (iconName.value !== 'loading' || msg.value) && (iconName.value || iconClass.value || cssIcon.value) ? 'wd-toast--with-icon' : ''
  } ${iconName.value === 'loading' && !msg.value ? 'wd-toast--loading' : ''} ${direction.value === 'vertical' ? 'is-vertical' : ''}`
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
  iconSize.value = isDef(option.iconSize) ? addUnit(option.iconSize) : isDef(props.iconSize) ? addUnit(props.iconSize) : '36px'
  iconColor.value = isDef(option.iconColor!) ? option.iconColor! : props.iconColor || WHITE
  loadingSize.value = isDef(option.loadingSize) ? addUnit(option.loadingSize) : isDef(props.loadingSize) ? addUnit(props.loadingSize) : undefined
  cover.value = isDef(option.cover!) ? option.cover! : props.cover
  classPrefix.value = isDef(option.classPrefix) ? option.classPrefix : props.classPrefix
  direction.value = isDef(option.direction) ? option.direction : props.direction
  closed = isFunction(option.closed) ? option.closed : isFunction(props.closed) ? props.closed : null
  opened = isFunction(option.opened) ? option.opened : isFunction(props.opened) ? props.opened : null
}
</script>
