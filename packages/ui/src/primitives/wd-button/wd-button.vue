/*
 * wd-button — 按钮
 *
 * Lynx 实现说明（相对 wot-ui 的适配点）：
 * - 根元素为 view（Lynx 无 button 元素），点击经 @tap 捕获后向用户
 *   emit 'click' / 'tap'（CONVENTIONS §6 事件映射、§14 同名事件转发）；
 * - hover 延时由声明式 MTS + 主线程 rAF 实现，style-only 写入，无后台触摸状态；
 *   hoverStopPropagation 无法仅抑制任意祖先 CSS :active，不以停止点击冒泡冒充支持。
 * - disabled / loading 时不响应点击；loading 时内置 wd-loading，
 *   默认继承按钮文字色，显式 loadingProps.color 优先于兼容 loadingColor；
 * - wot-ui 的 ::after 边框技巧（plain/dashed/hairline 描边）在 Lynx 无伪元素，
 *   改为不参与排版的真实绝对定位描边（hairline 为半线宽），见 index.scss；
 * - uni-app 开放能力 props 与回调事件保留；Lynx 无原生小程序授权按钮，
 *   仅当宿主显式 configureUniAdapter({ openType }) 时执行开放能力并回传事件，
 *   未注入时不自动授权或分享（普通 click / tap 仍正常）。
 */
<script lang="ts" setup>
import './index.css'

import { computed, useMainThreadRef, useSlots } from 'vue-lynx'
import WdIcon from '../wd-icon/wd-icon.vue'
import WdLoading from '../wd-loading/wd-loading.vue'
import { buttonProps, type ButtonOpenType } from './types'
import { hasUniAdapter, uni } from '../../common/uni'
import { useAlive } from '../../composables/useAlive'
import { isDef, isUndefined, omitBy, parseStyle } from '../../common/util'
import { useGlobalConfig } from '../../composables/useGlobalConfig'
import type { LoadingProps } from '../wd-loading/types'
import { createStyleResolver } from '../../common/style'

const props = defineProps(buttonProps)
const slots = useSlots()

const globalConfig = useGlobalConfig()

const effectiveSize = computed(() => {
  return props.size || globalConfig.value.button?.size || 'medium'
})

const effectiveVariant = computed(() => {
  return props.variant || globalConfig.value.button?.variant || 'base'
})

const effectiveType = computed(() => {
  return props.type || globalConfig.value.button?.type || 'primary'
})

const effectiveRound = computed(() => {
  if (isUndefined(props.round)) {
    return isUndefined(globalConfig.value.button?.round) ? false : globalConfig.value.button?.round
  }
  return props.round
})

const emit = defineEmits<{
  (e: 'click', event: any): void
  (e: 'tap', event: any): void
  (e: 'getuserinfo' | 'contact' | 'getphonenumber' | 'getrealtimephonenumber' | 'error' | 'launchapp' | 'opensetting' | 'chooseavatar' | 'agreeprivacyauthorization', event: any): void
}>()
const isAlive = useAlive()
type OpenTypeEvent = 'getuserinfo' | 'contact' | 'getphonenumber' | 'getrealtimephonenumber' | 'launchapp' | 'opensetting' | 'chooseavatar' | 'agreeprivacyauthorization'
const OPEN_TYPE_EVENTS: Partial<Record<ButtonOpenType, OpenTypeEvent>> = {
  getUserInfo: 'getuserinfo', contact: 'contact', getPhoneNumber: 'getphonenumber',
  getRealtimePhoneNumber: 'getrealtimephonenumber', launchApp: 'launchapp',
  openSetting: 'opensetting', chooseAvatar: 'chooseavatar', agreePrivacyAuthorization: 'agreeprivacyauthorization'
}

/**
 * 加载图标颜色（真机 2026-10-26 巡检）：原实现只给 wd-loading 传
 * `inheritColor`，而 Lynx 无法在 JS 侧真继承父级 color —— wd-loading 的
 * `resolvedColor` 回落到主题主色，于是紫色按钮上的 loading 也是紫色，
 * 整组不可见（图四「加载中」无转圈缺陷）。
 *
 * 按钮的文字色由类型 × 变体决定（scss 的 $button-types / $button-variants
 * 表），JS 侧按同一张表取令牌值：主题未覆盖时用与设计令牌一致的兜底
 * （实心类型为白字，info 为深字，plain/soft/text 变体为主色字）。
 */
const SOLID_TEXT_FALLBACK: Record<string, string> = {
  primary: '#ffffff', success: '#ffffff', danger: '#ffffff', warning: '#ffffff', info: '#1a1a1a'
}
const TEXT_COLOR_TOKEN: Record<string, string> = {
  primary: 'buttonPrimaryColor', success: 'buttonSuccessColor', danger: 'buttonDangerColor',
  warning: 'buttonWarningColor', info: 'buttonInfoColor'
}
const loadingTextColor = computed(() => {
  const themeVars = (globalConfig.value.themeVars || {}) as Record<string, string>
  const type = effectiveType.value
  const token = TEXT_COLOR_TOKEN[type]
  const themed = token ? themeVars[token] : undefined
  if (effectiveVariant.value === 'base') {
    return themed || SOLID_TEXT_FALLBACK[type] || themeVars.buttonMainColor || '#ffffff'
  }
  // 非实心变体的文字是主色系（plain / soft / subtle / dashed / text）
  return themeVars.buttonPrimaryColor || '#755ffe'
})

/** 加载配置：默认继承按钮文字色 */
const customLoadingProps = computed(() => {
  const loading: Partial<LoadingProps> = isDef(props.loadingProps) ? omitBy(props.loadingProps!, isUndefined) : {}
  loading.customSpinnerClass = `${isDef(loading.customSpinnerClass) ? loading.customSpinnerClass : ''} wd-button__loading`
  // 官方 loadingColor 声明但未消费：兼容修正为低优先级别名，不覆盖 loadingProps.color。
  if (!isDef(loading.color) && isDef(props.loadingColor)) loading.color = props.loadingColor
  // 无显式色时下发按钮自身的文字色（JS 解析成具体值，currentColor 在真机
  // 不生效，见 loadingTextColor 注释）。
  if (!isDef(loading.color)) loading.color = loadingTextColor.value
  // 有了具体色后不再走 inheritColor 的近似回落。
  loading.inheritColor = isDef(loading.inheritColor) ? loading.inheritColor : false
  return loading
})

/** 是否仅展示图标 */
const isIcon = computed(() => {
  return !slots.default && !props.text && !!(props.icon || props.cssIcon)
})

const rootClass = computed(() => {
  const classes: string[] = ['wd-button', `is-${effectiveType.value}`, `is-${effectiveSize.value}`]
  if (isIcon.value) classes.push('is-icon')
  if (effectiveRound.value) classes.push('is-round')
  if (props.hairline) classes.push('is-hairline')
  if (effectiveVariant.value !== 'base') classes.push(`is-${effectiveVariant.value}`)
  if (props.disabled) classes.push('is-disabled')
  if (props.block) classes.push('is-block')
  if (props.loading) classes.push('is-loading')
  if (props.customClass) classes.push(props.customClass)
  return classes.join(' ')
})

const outlined = computed(() => ['plain', 'dashed', 'subtle'].includes(effectiveVariant.value))
const hoverVersion = computed(() => JSON.stringify([
  props.disabled, props.loading, props.hoverStartTime, props.hoverStayTime,
  effectiveType.value, effectiveVariant.value, props.customStyle
]))
const resolveRootStyle = createStyleResolver({ 'background-color': '', color: '' })
const rootStyle = computed(() => {
  // props 改变即回写中性值，清除主线程按压在树上留下的临时覆盖。
  hoverVersion.value
  return resolveRootStyle(parseStyle(props.customStyle))
})
const resolveBorderStyle = createStyleResolver({ 'border-color': '' })
const borderStyle = computed(() => { hoverVersion.value; return resolveBorderStyle() })
const customHoverBackground = computed(() => {
  const style = parseStyle(props.customStyle)
  return !!(style.background || style.backgroundColor || style['background-color'])
})
const customHoverColor = computed(() => !!parseStyle(props.customStyle).color)

interface HoverElement {
  setStyleProperty(name: string, value: string): void
  getAttribute(name: string): string | null
}
interface HoverPress {
  element: HoverElement
  border: HoverElement | null
  version: string
  started: number
  released: number | null
  active: boolean
  /** 主线程推进（起笔 worklet 内定义，避免 worklet 交叉引用） */
  step: () => void
}
const buttonRef = useMainThreadRef<HoverElement | null>(null)
const borderRef = useMainThreadRef<HoverElement | null>(null)
const pressRef = useMainThreadRef<HoverPress | null>(null)

/**
 * 声明式 MTS（主线程）：按压态 step 直接挂在 press 对象上。
 *
 * Lynx 的 worklet 编译产物里，worklet 之间互相引用会出现「Cannot access X
 * before initialization」（注册顺序早于 const 初始化），因此这里不使用
 * 模块级 worklet 辅助函数，而是把推进逻辑定义在起笔 worklet 内部，
 * 由 rAF 回调与收笔 worklet 通过 press.step 调用。
 */
const handleHoverStart = () => {
  'main thread'
  const element = buttonRef.current
  if (!element || element.getAttribute('hover-disabled') === 'true') return
  const previous = pressRef.current
  const press: HoverPress = {
    element, border: borderRef.current, version: element.getAttribute('hover-version') || '',
    started: Date.now(), released: null as number | null,
    active: !!previous && previous.element === element && previous.version === element.getAttribute('hover-version') && previous.active,
    step: () => {}
  }
  const step = () => {
    if (pressRef.current !== press) return
    const current = buttonRef.current
    if (!current || current !== press.element) { pressRef.current = null; return }
    if (current.getAttribute('hover-version') !== press.version || current.getAttribute('hover-disabled') === 'true') {
      pressRef.current = null
      if (current.getAttribute('hover-custom-background') !== 'true') current.setStyleProperty('background-color', '')
      if (current.getAttribute('hover-custom-color') !== 'true') current.setStyleProperty('color', '')
      if (borderRef.current) borderRef.current.setStyleProperty('border-color', '')
      return
    }
    const now = Date.now()
    if (press.released === null) {
      const delay = Math.max(0, Number(current.getAttribute('hover-start-time')) || 0)
      if (!press.active && now - press.started >= delay) {
        press.active = true
        if (current.getAttribute('hover-custom-background') !== 'true') current.setStyleProperty('background-color', 'var(--wot-button-current-bg-active)')
        if (current.getAttribute('hover-custom-color') !== 'true') current.setStyleProperty('color', 'var(--wot-button-current-text-active)')
        if (press.border && borderRef.current === press.border) press.border.setStyleProperty('border-color', 'var(--wot-button-plain-border-active)')
      }
      if (!press.active) requestAnimationFrame(() => step())
      return
    }
    const delay = Math.max(0, Number(current.getAttribute('hover-stay-time')) || 0)
    if (now - press.released < delay) {
      requestAnimationFrame(() => step())
      return
    }
    if (current.getAttribute('hover-custom-background') !== 'true') current.setStyleProperty('background-color', '')
    if (current.getAttribute('hover-custom-color') !== 'true') current.setStyleProperty('color', '')
    if (press.border && borderRef.current === press.border) press.border.setStyleProperty('border-color', '')
    pressRef.current = null
  }
  press.step = step
  pressRef.current = press
  step()
}
const handleHoverEnd = () => {
  'main thread'
  const press = pressRef.current
  if (!press) return
  if (!press.active) { pressRef.current = null; return }
  press.released = Date.now()
  press.step()
}
const handleHoverCancel = () => {
  'main thread'
  const element = buttonRef.current
  if (!element) return
  pressRef.current = null
  if (element.getAttribute('hover-custom-background') !== 'true') element.setStyleProperty('background-color', '')
  if (element.getAttribute('hover-custom-color') !== 'true') element.setStyleProperty('color', '')
  if (borderRef.current) borderRef.current.setStyleProperty('border-color', '')
}

function handleClick(event: any) {
  if (!isAlive() || props.disabled || props.loading) return
  emit('click', event)
  if (!isAlive()) return
  emit('tap', event)
  if (!isAlive() || !props.openType || !hasUniAdapter('openType')) return
  const eventName = props.openType === 'getAuthorize'
    ? props.scope === 'phoneNumber' ? 'getphonenumber' : props.scope === 'userInfo' ? 'getuserinfo' : undefined
    : OPEN_TYPE_EVENTS[props.openType]
  let settled = false
  uni.openType({
    openType: props.openType, scope: props.scope, lang: props.lang, buttonId: props.buttonId,
    sessionFrom: props.sessionFrom, sendMessageTitle: props.sendMessageTitle,
    sendMessagePath: props.sendMessagePath, sendMessageImg: props.sendMessageImg,
    appParameter: props.appParameter, showMessageCard: props.showMessageCard,
    event,
    success(result: any) {
      if (settled || !isAlive()) return
      settled = true
      if (eventName) emit(eventName, result)
    },
    fail(error: any) {
      if (settled || !isAlive()) return
      settled = true
      emit('error', error)
    }
  })
}
</script>

<template>
  <view
    :id="buttonId" :class="rootClass" :style="rootStyle"
    :main-thread-ref="buttonRef"
    :hover-version="hoverVersion" :hover-disabled="disabled || loading"
    :hover-start-time="hoverStartTime" :hover-stay-time="hoverStayTime"
    :hover-custom-background="customHoverBackground" :hover-custom-color="customHoverColor"
    :main-thread-bindtouchstart="handleHoverStart"
    :main-thread-bindtouchend="handleHoverEnd"
    :main-thread-bindtouchcancel="handleHoverCancel"
    @tap="handleClick"
  >
    <view class="wd-button__content">
      <WdLoading v-if="loading" v-bind="customLoadingProps" />
      <WdIcon
        v-else-if="icon || cssIcon"
        custom-class="wd-button__icon"
        :name="icon"
        :class-prefix="classPrefix"
        :css-icon="cssIcon"
      />
      <view v-if="$slots.default || text" class="wd-button__text">
        <slot><text class="wd-button__text-content">{{ text }}</text></slot>
      </view>
    </view>
    <view v-if="outlined" class="wd-button__border" :style="borderStyle" :main-thread-ref="borderRef" />
  </view>
</template>
