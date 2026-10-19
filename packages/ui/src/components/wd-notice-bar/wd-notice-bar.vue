/*
 * wd-notice-bar — 通知栏
 *
 * Lynx 实现说明（相对 wot-ui 2.3.2 的适配点）：
 * - 参考源内容区 / 关闭图标绑 @click，Lynx view 不存在 click 事件（只派发
 *   tap，CONVENTIONS §14 订正），均改绑 @tap；
 * - 参考源 rootStyle / animation 以 objToStyle 拼字符串后下发，Lynx 的
 *   patchProp 对 :style 只认对象（CONVENTIONS §19），改为对象语法：
 *   根样式经 defineStyleKeys + resolveStyle 每帧输出完整键集（Style
 *   Funnel §20 迁移），再与 parseStyle(customStyle) 合并；content 的过渡
 *   样式由 transitionState（reactive，五键全集）经 computed 快照下发，
 *   不存在条件缺键；
 * - 参考源 stopTransition 以 CSS 宽关键字 unset 取消过渡（Lynx 支持不确定，
 *   参照 wd-curtain 的处理先例），改为语义等价的中性值：transition-property
 *   none + 0s 时长（视觉上等同于不设置）；
 * - 参考源经 getRect(selector, false, proxy) 按组件实例作用域度量 wrap /
 *   content；本地 getRect 的 scope 参数在 Lynx 下忽略（全局查询），多实例
 *   会串台，故按实例唯一 id 选择器度量（模板 wrap / content 挂
 *   ${instanceId}-wrap / ${instanceId}-content），度量仍只在挂载与文本变化
 *   时进行（CONVENTIONS §16 热路径约束）；
 * - 参考源的 uni-app onShow / onHide（页面显隐停表）与 APP-PLUS
 *   getCurrentPages 条件编译块在 Lynx 无等价能力，已移除；异步回调
 *   （getRect.then / animationEnd 的 setTimeout 续段）统一经 useAlive 守卫，
 *   防止卸载后晚到 patch（真机 9902 removeNode 家族问题）；
 * - 参考源纵向滚动以 view 承载裸文本、默认插槽回落亦为裸文本，Lynx 要求
 *   文本包 text 元素（CONVENTIONS §4），均已包裹；
 * - 参考源 options 块的 virtualHost / addGlobalClass / styleIsolation 为
 *   uni-app 小程序专有能力，Lynx 无需声明，已移除；
 * - 原生优先重写（NATIVE-REWRITE §3）：本组件无跟手交互（横向/纵向滚动均由
 *   CSS transition 在 UI 线程原生执行，不涉及 MTS），根 view 经 SCSS 显式
 *   补全 flex-direction: row——「前缀图标 + 内容区 + 后缀图标」横向行，
 *   align-items: center 成对居中；纵向模式的文本项堆叠沿用 Lynx linear
 *   布局的默认纵向流向（与 wot-ui DOM 一致，不引入额外类名）；
 * - 根内联样式（color / background）已随上述 Style Funnel 迁移输出完整
 *   键集（中性值 '' 由 is-{type} 状态类兜底配色）。
 */
<script lang="ts" setup>
import './index.css'

import { ref, watch, nextTick, computed, reactive, onMounted } from 'vue-lynx'
import WdIcon from '../wd-icon/wd-icon.vue'
import { getRect, isArray, isDef, parseStyle, uuid, type CSSProperties } from '../../common/util'
import { defineStyleKeys, resolveStyle } from '../../common/style'
import { type NoticeBarExpose, noticeBarProps } from './types'
import { useAlive } from '../../composables/useAlive'

// 实例唯一 id 前缀：getRect 按 id 度量，同页多实例避免选择器串台
const instanceId = `wd-notice-bar-${uuid()}`

const props = defineProps(noticeBarProps)
const emit = defineEmits(['close', 'next', 'click'])
const isAlive = useAlive()

const wrapWidth = ref<number>(0)
const show = ref<boolean>(true)
const currentIndex = ref<number>(0)
const textArray = computed(() => (Array.isArray(props.text) ? props.text : [props.text]))
const currentText = computed(() => textArray.value[currentIndex.value])
const verticalIndex = ref<number>(0)
const wrapRect = ref<any | null>(null) // 外层容器节点信息
const contentRect = ref<any | null>(null) // 内容节点信息
const isHorizontal = computed(() => props.direction === 'horizontal')
const isVertical = computed(() => props.direction === 'vertical')

const transitionState = reactive<CSSProperties>({
  transitionProperty: 'none',
  transitionDelay: '0s',
  transitionDuration: '0s',
  transform: 'none',
  transitionTimingFunction: 'linear'
})

const animation = computed(() => {
  return { ...transitionState }
})

/**
 * 根节点可切换样式键 + 中性值（CONVENTIONS §20：每帧输出完整键集）。
 * 中性值取 ''（未设置）——不传 color / background-color 时由 is-{type}
 * 状态类承担配色（与 wd-text 的迁移范式一致）。
 */
const NOTICE_BAR_STYLE = defineStyleKeys({
  color: '',
  background: ''
})

const rootStyle = computed(() => {
  return {
    ...resolveStyle(NOTICE_BAR_STYLE, {
      color: isDef(props.color) ? props.color : '',
      background: isDef(props.backgroundColor) ? props.backgroundColor : ''
    }),
    ...parseStyle(props.customStyle)
  }
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

watch(
  () => props.text,
  () => {
    reset()
  },
  { deep: true }
)

onMounted(() => {
  startTransition()
})

function reset() {
  stopTransition()
  startTransition()
}

function startTransition() {
  nextTick(() => scroll())
}

function stopTransition() {
  transitionState.transitionProperty = 'none'
  transitionState.transitionDelay = '0s'
  transitionState.transitionDuration = '0s'
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
  return Promise.all([getRect(`#${instanceId}-wrap`), getRect(`#${instanceId}-content`)])
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
  const [wRect, cRect] = await queryRect()
  if (!isAlive()) return
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
    // Lynx 适配：卸载后不再写响应式状态 / 重新挂动画（晚到 patch 防护）
    if (!isAlive()) return
    next() // 更换下一条文本

    nextTick(async () => {
      try {
        const [wRect, cRect] = await queryRect()
        if (!isAlive()) return
        wrapRect.value = wRect
        contentRect.value = cRect
        wrapWidth.value = wRect.width || 0
      } catch (error) {
        // console.error(error)
      }

      if (!isAlive()) return
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

<template>
  <view v-if="show" :class="`wd-notice-bar ${customClass} ${noticeBarClass}`" :style="rootStyle">
    <wd-icon v-if="prefix" custom-class="wd-notice-bar__prefix" :name="prefix"></wd-icon>
    <slot v-else name="prefix"></slot>
    <view class="wd-notice-bar__wrap" :id="`${instanceId}-wrap`">
      <view class="wd-notice-bar__content" :id="`${instanceId}-content`" :style="animation" @transitionend="animationEnd" @tap="handleClick">
        <template v-if="isVertical">
          <view v-for="item in textArray" :key="item"><text>{{ item }}</text></view>
          <view v-if="textArray.length > 1"><text>{{ textArray[0] }}</text></view>
        </template>
        <slot v-else><text>{{ currentText }}</text></slot>
      </view>
    </view>
    <slot name="suffix">
      <wd-icon v-if="closable" custom-class="wd-notice-bar__suffix" name="close" @tap="handleClose"></wd-icon>
    </slot>
  </view>
</template>
