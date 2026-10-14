<template>
  <view v-if="show" :class="`wd-notice-bar ${customClass} ${noticeBarClass}`" :style="styleToObject(rootStyle)">
    <!-- Lynx 适配：wd-icon 的 svg content 不继承 CSS currentColor，颜色需显式下发。 -->
    <WdIcon v-if="prefix" custom-class="wd-notice-bar__prefix" :name="prefix" :color="iconColor"></WdIcon>
    <slot v-else name="prefix"></slot>
    <view class="wd-notice-bar__wrap">
      <view class="wd-notice-bar__content" :style="styleToObject(animation)" @transitionend="animationEnd" @tap="handleClick">
        <template v-if="isVertical">
          <view v-for="item in textArray" :key="item"><text>{{ item }}</text></view>
          <view v-if="textArray.length > 1"><text>{{ textArray[0] }}</text></view>
        </template>
        <slot v-else><text>{{ currentText }}</text></slot>
      </view>
    </view>
    <slot name="suffix">
      <WdIcon v-if="closable" custom-class="wd-notice-bar__suffix" name="close" :color="iconColor" @click="handleClose"></WdIcon>
    </slot>
  </view>
</template>
<script setup lang="ts">
import './index.css'
import WdIcon from '../wd-icon/wd-icon.vue'
import {ref, watch, nextTick, computed, getCurrentInstance, onMounted, onActivated, onDeactivated, reactive} from 'vue-lynx'
import { styleToObject, type CSSProperties, getRect, isArray, isDef, objToStyle } from '../../common/util'
import { type NoticeBarExpose, noticeBarProps } from './types'
import { onHide, onShow } from './notice-bar-shim'
import { BLUE, ORANGE, RED } from '../../common/theme'
const $wrap = '.wd-notice-bar__wrap'
const $content = '.wd-notice-bar__content'

const props = defineProps(noticeBarProps)
const emit = defineEmits(['close', 'next', 'click'])

/**
 * 前缀/后缀图标取色
 * Lynx 适配：wd-icon 的 svg content 不继承 CSS currentColor，需按 type 显式下发颜色，
 * 取值与 styles/theme/base/color.scss 中的语义色保持一致（见 common/theme.ts）。
 */
const iconColor = computed(() => {
  if (isDef(props.color)) return props.color
  switch (props.type) {
    case 'warning':
      return ORANGE[6]
    case 'danger':
      return RED[6]
    default:
      return BLUE[6]
  }
})

const wrapWidth = ref<number>(0)
const show = ref<boolean>(true)
const currentIndex = ref<number>(0)
const textArray = computed(() => (Array.isArray(props.text) ? props.text : [props.text]))
const currentText = computed(() => textArray.value[currentIndex.value])
const verticalIndex = ref<number>(0)
const wrapRect = ref<UniApp.NodeInfo | null>(null) // 外层容器节点信息
const contentRect = ref<UniApp.NodeInfo | null>(null) // 内容节点信息
const isHorizontal = computed(() => props.direction === 'horizontal')
const isVertical = computed(() => props.direction === 'vertical')

const transitionState = reactive<CSSProperties>({
  transitionProperty: 'unset',
  transitionDelay: 'unset',
  transitionDuration: 'unset',
  transform: 'none',
  transitionTimingFunction: 'linear'
})

const animation = computed(() => {
  return objToStyle(transitionState)
})

const rootStyle = computed(() => {
  const style: CSSProperties = {}
  if (isDef(props.color)) {
    style.color = props.color
  }

  if (isDef(props.backgroundColor)) {
    style.background = props.backgroundColor
  }

  return `${objToStyle(style)}${props.customStyle}`
})
const noticeBarClass = computed(() => {
  const { type, wrapable, scrollable } = props

  let noticeBarClasses: string[] = []
  type && noticeBarClasses.push(`is-${type}`)

  if (isHorizontal.value) {
    !wrapable && !scrollable && noticeBarClasses.push('wd-notice-bar--ellipse')
  } else {
    noticeBarClasses.push('wd-notice-bar--ellipse')
  }

  wrapable && !scrollable && noticeBarClasses.push('wd-notice-bar--wrap')
  return noticeBarClasses.join(' ')
})

const { proxy } = getCurrentInstance() as any

watch(
  () => props.text,
  () => {
    reset()
  },
  { deep: true }
)

onMounted(() => {
  startTransition()
  // Lynx 适配：uni-app 的 getCurrentPages().$getAppWebview() 为 App 端专有 API，
  // Lynx 不存在该能力，页面显示/隐藏的暂停恢复由 notice-bar-shim 的 onShow/onHide 处理。
})

onShow(() => {
  startTransition()
})

onHide(() => {
  stopTransition()
})

function reset() {
  stopTransition()
  startTransition()
}

function startTransition() {
  nextTick(() => scroll())
}

function stopTransition() {
  transitionState.transitionProperty = 'unset'
  transitionState.transitionDelay = 'unset'
  transitionState.transitionDuration = 'unset'
  transitionState.transform = 'none'
  transitionState.transitionTimingFunction = 'linear'
  currentIndex.value = 0
  verticalIndex.value = 0
}

function handleClose() {
  show.value = false
  emit('close')
}

function setTransition({ duration, delay, translate }: { duration: number; delay: number; translate: number }) {
  transitionState.transitionProperty = 'all'
  transitionState.transitionDelay = `${delay}s`
  transitionState.transitionDuration = `${duration}s`
  transitionState.transform = `${props.direction === 'vertical' ? 'translateY' : 'translateX'}(${translate}px)`
  transitionState.transitionTimingFunction = 'linear'
}

function queryRect() {
  return Promise.all([getRect($wrap, false, proxy), getRect($content, false, proxy)])
}

async function verticalAnimate(height: number) {
  const translate = -(height / (textArray.value.length + 1)) * (currentIndex.value + 1)
  setTransition({
    duration: height / (textArray.value.length + 1) / props.speed,
    delay: props.delay,
    translate
  })
}

async function scroll() {
  try {
    const [wRect, cRect] = await queryRect()
    if (!wRect.width || !cRect.width || !cRect.height) return
    wrapRect.value = wRect
    contentRect.value = cRect
    wrapWidth.value = wRect.width

    if (isHorizontal.value) {
      if (props.scrollable) {
        setTransition({
          duration: cRect.width / props.speed,
          delay: props.delay,
          translate: -cRect.width
        })
      }
    } else {
      if (textArray.value.length > 1) {
        verticalAnimate(cRect.height)
      }
    }
  } catch (error) {
    // 节点度量失败（无匹配节点 / 宿主不支持 SelectorQuery）时跳过滚动动画，
    // 与 animationEnd 中的处理一致：避免未处理的 Promise 拒绝被 Sentry
    // 上报为 USER_RUNTIME_ERROR（scroll -> queryRect -> getRect）。
  }
}

function next() {
  if (currentIndex.value >= textArray.value.length - 1) {
    currentIndex.value = 0
  } else {
    currentIndex.value++
  }
  emit('next', currentIndex.value)
}

function animationEnd() {
  if (isHorizontal.value) {
    setTransition({
      duration: 0,
      delay: 0,
      translate: wrapWidth.value + 1
    })
  } else {
    if (++verticalIndex.value >= textArray.value.length) {
      verticalIndex.value = 0
      setTransition({
        duration: 0,
        delay: 0,
        translate: 0
      })
    }
  }

  const timer = setTimeout(() => {
    next() // 更换下一条文本

    nextTick(async () => {
      try {
        const [wRect, cRect] = await queryRect()
        wrapRect.value = wRect
        contentRect.value = cRect
        wrapWidth.value = wRect.width || 0
      } catch (error) {
        // console.error(error)
      }

      if (!contentRect.value || !contentRect.value.width || !contentRect.value.height) return

      if (isHorizontal.value) {
        setTransition({
          duration: (wrapWidth.value + contentRect.value.width) / props.speed,
          delay: props.delay,
          translate: -contentRect.value.width
        })
      } else {
        verticalAnimate(contentRect.value.height)
      }
    })

    clearTimeout(timer)
  }, 20)
}

function handleClick() {
  const result = isArray(props.text)
    ? {
        index: currentIndex.value,
        text: props.text[currentIndex.value]
      }
    : {
        index: 0,
        text: props.text
      }
  emit('click', result)
}

defineExpose<NoticeBarExpose>({ reset })
</script>

