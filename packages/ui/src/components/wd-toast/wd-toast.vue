/*
 * wd-toast — 轻提示
 *
 * Lynx 实现说明（相对 wot-ui 2.3.2 的适配点）：
 * - 结构：wd-overlay（可选遮罩）+ wd-transition（fade）+ 内容视图，与 wot-ui 一致；
 * - 定位：过渡根视图内联样式与 wot-ui 相同（position: fixed + top: 50% + left: 0 +
 *   width: 100% + text-align: center + pointer-events: none），上下偏移由
 *   .wd-toast--top / --middle-top / --middle / --bottom 的 transform 承担
 *   （wot-ui 用 40vh / 18.8vh 视口单位，Lynx 对视口单位支持不确定——同
 *   wd-img-cropper 的历史结论，保留 wot-ui 取值以保证 Web 预览与样式对齐，
 *   Lynx 端视口单位失效时退化为不偏移，toast 仍可见、仍居中）；
 * - wot-ui 靠 text-align: center + display: inline-block 让 toast 水平居中，
 *   Lynx 无行内流式布局（CONVENTIONS §15：inline-block/inline-flex → flex），
 *   故过渡根视图补 flex-direction: column + align-items: center 承担水平居中；
 * - 参考源的 objToStyle 字符串样式改为对象语法（字符串 :style 会被 vue-lynx
 *   静默丢弃，CONVENTIONS §19）；根视图样式不再随 position 变化，无条件写全
 *   键集（CONVENTIONS §20）；
 * - 图标名：wot-ui 用 check-circle / exclamation-circle / info-circle /
 *   close-circle，本地内置图标集（iconfont）无同名字形，映射为
 *   success / warning / prompt / error（CONVENTIONS §8）；
 * - 命令式 API 经 useToast(selector) 驱动（模块级注入单例），本地增加
 *   useAlive 守卫与页面卸载时的定时器清理（晚到写入已销毁树会触发真机 9902）。
 */
<script lang="ts" setup>
import './index.css'

import { computed, inject, ref, watch } from 'vue-lynx'
import WdIcon from '../wd-icon/wd-icon.vue'
import WdLoading from '../wd-loading/wd-loading.vue'
import WdOverlay from '../wd-overlay/wd-overlay.vue'
import WdTransition from '../wd-transition/wd-transition.vue'
import { defaultOptions, getToastOptionKey, toastIcon } from '.'
import { toastProps, type ToastDirection, type ToastLoadingType, type ToastOptions, type ToastProps } from './types'
import { addUnit, isDef, isFunction } from '../../common/util'

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
 * 动画自定义样式（对象语法；键集固定，不随 position 变化）
 */
const transitionStyle = computed<Record<string, string>>(() => {
  return {
    'z-index': String(zIndex.value),
    position: 'fixed',
    top: '50%',
    left: '0',
    width: '100%',
    'text-align': 'center',
    'pointer-events': 'none',
    // Lynx 适配：承担 wot-ui 由 text-align + inline-block 实现的水平居中
    'flex-direction': 'column',
    'align-items': 'center'
  }
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
  <!-- 遮罩样式为字符串：wd-overlay 内部以 `z-index: ${zIndex}; ${customStyle}` 字符串拼接
       下发（跨组件契约），传对象会被序列化为 [object Object] 而丢失 -->
  <WdOverlay v-if="cover" :z-index="zIndex" lock-scroll :show="show" custom-style="background-color: transparent;pointer-events: auto;" />
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
      <text v-if="msg" :class="`wd-toast__msg ${direction === 'vertical' ? 'is-vertical' : ''}`">{{ msg }}</text>
    </view>
  </WdTransition>
</template>
