/*
 * wd-transition — 过渡动画
 *
 * Lynx 实现说明：
 * - 自实现的 CSS 过渡状态机（before-enter → enter → enter-to →
 *   before-leave → leave → leave-to），用 AbortablePromise 保证
 *   show 频繁切换时旧动画可被中止，不残留类名；
 * - 帧间隔经 common/util 的 pause()（约 33ms 一帧）驱动，
 *   离开动画落地经 duration 定时器兜底（transitionend 在部分
 *   Lynx 版本不可靠，双通道取先到者）；
 * - disableTouchMove 时根视图绑定 @touchmove.stop.prevent 锁滚
 *   （CONVENTIONS §14：禁止在包裹层上再补裸 noop 监听）。
 */
<script lang="ts" setup>
import './index.css'

import { computed, onBeforeMount, onBeforeUnmount, ref, watch } from 'vue-lynx'
import { isObj, isPromise, parseStyle, pause } from '../../common/util'
import { transitionProps, type TransitionName } from './types'
import { AbortablePromise } from '../../common/AbortablePromise'

const props = defineProps(transitionProps)
const emit = defineEmits([
  'click',
  'transitionend',
  'touchmove',
  'before-enter',
  'enter',
  'before-leave',
  'leave',
  'after-leave',
  'after-enter'
])

/** 预设动画名 → 各阶段类名 */
function getClassNames(name?: TransitionName | TransitionName[]) {
  const transitionClass = (transitionName: string, phase: string) =>
    `wd-transition--${transitionName}-${phase}`

  let enter = `${props.enterClass} ${props.enterActiveClass}`
  let enterTo = `${props.enterToClass} ${props.enterActiveClass}`
  let leave = `${props.leaveClass} ${props.leaveActiveClass}`
  let leaveTo = `${props.leaveToClass} ${props.leaveActiveClass}`

  const names = Array.isArray(name) ? name : name ? [name] : []
  for (const item of names) {
    enter = `${transitionClass(item, 'enter')} ${transitionClass(item, 'enter-active')} ${enter}`
    enterTo = `${transitionClass(item, 'enter-to')} ${transitionClass(item, 'enter-active')} ${enterTo}`
    leave = `${transitionClass(item, 'leave')} ${transitionClass(item, 'leave-active')} ${leave}`
    leaveTo = `${transitionClass(item, 'leave-to')} ${transitionClass(item, 'leave-active')} ${leaveTo}`
  }

  return { enter, 'enter-to': enterTo, leave, 'leave-to': leaveTo }
}

/** 初始化是否完成（懒渲染） */
const inited = ref<boolean>(false)
/** 是否占据布局 */
const display = ref<boolean>(false)
/** 当前动画状态：enter / leave */
const status = ref<string>('')
/** 动画是否已结束（transitionend 幂等） */
const transitionEnded = ref<boolean>(false)
/** 动画持续时间 ms */
const currentDuration = ref<number>(300)
/** 当前过渡类名 */
const classes = ref<string>('')
/** enter 主 promise（leave 需等其完成，保证顺序执行） */
const enterPromise = ref<AbortablePromise<void> | null>(null)
/** enter 阶段调度 promise */
const enterSchedule = ref<AbortablePromise<unknown> | null>(null)
/** leave 阶段调度 promise */
const leaveSchedule = ref<AbortablePromise<unknown> | null>(null)

/** 根节点样式（对象语法：字符串 :style 会被 vue-lynx 静默丢弃，CONVENTIONS §19） */
const style = computed<Record<string, string>>(() => {
  const result: Record<string, string> = { 'transition-duration': `${currentDuration.value}ms` }
  if (!display.value && props.destroy) result.display = 'none'
  return { ...result, ...parseStyle(props.customStyle) }
})

const rootClass = computed(() => {
  return `wd-transition ${props.customClass} ${classes.value}`
})

const isShow = computed(() => {
  return !props.lazyRender || inited.value
})

onBeforeMount(() => {
  if (props.show) {
    enter()
  }
})

/**
 * 卸载时中止全部动画调度（CONVENTIONS §16 / 真机 9902 崩溃防护）。
 *
 * enter()/leave() 的链式 await 由 pause()/delay() 的 setTimeout 驱动，
 * abort() 只 reject 不清定时器；若不在此中止，父组件（popup / dialog /
 * toast / overlay 等整条弹层链）在 leave 动画飞行中同步卸载时，
 * 挂起的帧定时器到期后仍会在已销毁实例上写 classes/display/transitionEnded
 * 并 emit('after-leave') —— vue-lynx 在已销毁树上继续 patch，产生晚到的
 * remove/insert 配对，真机表现为
 * java.lang.RuntimeException: Trying to remove unknown ui signature（9902）。
 */
onBeforeUnmount(() => {
  abortSchedules()
})

watch(
  () => props.show,
  (newVal) => {
    if (newVal) {
      abortSchedules()
      enter()
    } else {
      leave()
    }
  }
)

function abortSchedules() {
  isPromise(enterPromise.value) && enterPromise.value.abort()
  isPromise(enterSchedule.value) && enterSchedule.value.abort()
  isPromise(leaveSchedule.value) && leaveSchedule.value.abort()
  enterPromise.value = null
  enterSchedule.value = null
  leaveSchedule.value = null
}

function enter() {
  enterPromise.value = new AbortablePromise<void>(async (resolve) => {
    const classNames = getClassNames(props.name)
    const duration = isObj(props.duration) ? (props.duration as Record<string, number>).enter : (props.duration as number)
    status.value = 'enter'
    emit('before-enter')
    enterSchedule.value = pause()
    await enterSchedule.value
    emit('enter')
    classes.value = classNames.enter
    currentDuration.value = duration
    enterSchedule.value = pause()
    await enterSchedule.value
    inited.value = true
    display.value = true
    enterSchedule.value = pause()
    await enterSchedule.value
    enterSchedule.value = null
    transitionEnded.value = false
    classes.value = classNames['enter-to']
    resolve()
  })
}

async function leave() {
  // enter 尚未完成时，直接按当前帧结束，避免类名残留
  if (!enterPromise.value) {
    transitionEnded.value = false
    return onTransitionEnd()
  }
  try {
    await enterPromise.value
    if (!display.value) return
    const classNames = getClassNames(props.name)
    const duration = isObj(props.duration) ? (props.duration as Record<string, number>).leave : (props.duration as number)
    status.value = 'leave'
    emit('before-leave')
    currentDuration.value = duration
    leaveSchedule.value = pause()
    await leaveSchedule.value
    emit('leave')
    classes.value = classNames.leave
    leaveSchedule.value = pause()
    await leaveSchedule.value
    transitionEnded.value = false
    classes.value = classNames['leave-to']
    leaveSchedule.value = delay(currentDuration.value)
    await leaveSchedule.value
    leaveSchedule.value = null
    onTransitionEnd()
    enterPromise.value = null
  } catch (error) {
    // 被中止（show 再次切换）时静默退出
  }
}

/** duration 定时器 promise 化（transitionend 兜底） */
function delay(duration: number) {
  return new AbortablePromise<void>((resolve) => {
    const timer = setTimeout(() => {
      clearTimeout(timer)
      resolve()
    }, duration)
  })
}

function onTransitionEnd(e?: any) {
  emit('transitionend', e)
  if (transitionEnded.value) return

  transitionEnded.value = true
  if (status.value === 'leave') {
    emit('after-leave')
  } else if (status.value === 'enter') {
    emit('after-enter')
  }

  if (!props.show && display.value) {
    display.value = false
  }
}

function handleClick() {
  emit('click')
}

function onTouchMove(e?: any) {
  // 锁滚由模板修饰符承担，此处仅转发原生事件（CONVENTIONS §14）
  emit('touchmove', e)
}
</script>

<template>
  <view
    v-if="isShow && disableTouchMove"
    :class="rootClass"
    :style="style"
    @transitionend="onTransitionEnd"
    @click="handleClick"
    @touchmove.stop.prevent="onTouchMove"
  >
    <slot />
  </view>
  <view
    v-else-if="isShow"
    :class="rootClass"
    :style="style"
    @transitionend="onTransitionEnd"
    @click="handleClick"
  >
    <slot />
  </view>
</template>
