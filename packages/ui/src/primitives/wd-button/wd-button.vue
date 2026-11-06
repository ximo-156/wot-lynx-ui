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
import { WdTextSlot } from '../../common/textSlot'
import { GREEN, ORANGE, PRIMARY_COLOR, RED, SECONDARY_COLOR, THEME_TEXT_COLOR } from '../../common/theme'

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
 * SVG/icon/loading cannot resolve an ancestor's currentColor. Match the SCSS
 * palette rather than treating every non-solid type as primary, or using the
 * plain-text token for a solid button (which makes its foreground equal its bg).
 * Arbitrary stylesheet overrides still need a concrete color via themeVars.
 *
 * 实心按钮前景恒为白字：暗色主色阶梯是提亮取向（-5 档），白字压浅色底约
 * 2.8:1——2026-11-06 用户确认的「彩色底 + 白字」统一观感，有意接受该对比度
 * （dark.scss 同处有说明，勿再翻成深色墨）。loading 圆环与图标走这条计算值。
 */
const buttonTextColor = computed(() => {
  const themeVars = globalConfig.value.themeVars as Record<string, string>
  const customColor = parseStyle(props.customStyle).color
  if (customColor) return customColor
  const type = effectiveType.value
  const dark = globalConfig.value.theme === 'dark'
  if (effectiveVariant.value === 'base' && type !== 'info') {
    return themeVars.buttonMainColor || themeVars.textWhite || '#ffffff'
  }
  const colors: Record<string, string> = {
    primary: themeVars.buttonPrimaryColor || themeVars.primary6 || (dark ? SECONDARY_COLOR : PRIMARY_COLOR),
    success: themeVars.buttonSuccessColor || themeVars.successMain || GREEN[dark ? 5 : 6],
    warning: themeVars.buttonWarningColor || themeVars.warningMain || ORANGE[dark ? 5 : 6],
    danger: themeVars.buttonDangerColor || themeVars.dangerMain || RED[dark ? 5 : 6],
    info: themeVars.buttonInfoColor || themeVars.textMain || THEME_TEXT_COLOR[dark ? 'dark' : 'light']
  }
  return colors[type] || colors.primary
})

// Pass a size to WdIcon itself: its SVG/image branches cannot infer the button's
// font-size. The CSS token stays overridable (Fab sets these on its trigger).
const ICON_SIZES = { mini: 14, small: 16, medium: 20, large: 22 }
const iconSize = computed(() => {
  const size = effectiveSize.value
  const fallback = ICON_SIZES[size]
  return `var(--wot-button-size-icon-${size}, var(--wot-n-${fallback}, ${fallback}px))`
})

/** 加载配置：默认跟随与图标相同的按钮前景色。 */
const customLoadingProps = computed(() => {
  const loading: Partial<LoadingProps> = isDef(props.loadingProps) ? omitBy(props.loadingProps!, isUndefined) : {}
  loading.customSpinnerClass = `${isDef(loading.customSpinnerClass) ? loading.customSpinnerClass : ''} wd-button__loading`
  // 官方 loadingColor 声明但未消费：兼容修正为低优先级别名，不覆盖 loadingProps.color。
  if (!isDef(loading.color) && isDef(props.loadingColor)) loading.color = props.loadingColor
  // 无显式色时下发按钮前景色，不依赖跨组件的 currentColor 继承。
  if (!isDef(loading.color)) loading.color = buttonTextColor.value
  if (!isDef(loading.size)) loading.size = 'var(--wot-button-loading-size, var(--wot-n-20, 20px))'
  // 有了具体色后不再走 inheritColor 的近似回落。
  loading.inheritColor = isDef(loading.inheritColor) ? loading.inheritColor : false
  return loading
})

/** 是否仅展示图标 */
const isIcon = computed(() => {
  return !slots.default && !props.text && !!(props.icon || props.cssIcon || props.loading)
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
  effectiveType.value, effectiveVariant.value, props.customStyle, buttonTextColor.value
]))
const labelStyle = computed(() => { hoverVersion.value; return { color: '' } })
const iconStyle = computed(() => { hoverVersion.value; return { color: buttonTextColor.value } })
const resolveRootStyle = createStyleResolver({ 'background-color': '', color: '' })
const resolveTextStyle = createStyleResolver({ color: '', 'font-size': '', 'line-height': '', 'font-weight': '' })
const textStyle = computed(() => {
  const custom = parseStyle(props.customStyle)
  return resolveTextStyle({
    color: custom.color,
    'font-size': custom['font-size'] ?? custom.fontSize,
    'line-height': custom['line-height'] ?? custom.lineHeight,
    'font-weight': custom['font-weight'] ?? custom.fontWeight
  })
})
const rootStyle = computed(() => {
  // Typography belongs to the text, not another native view line box. Preserve
  // customStyle's public effect while keeping the measured container geometric.
  hoverVersion.value
  const custom = { ...parseStyle(props.customStyle) }
  for (const key of ['font-size', 'fontSize', 'line-height', 'lineHeight', 'font-weight', 'fontWeight']) delete custom[key]
  return resolveRootStyle(custom)
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
const labelRef = useMainThreadRef<HoverElement | null>(null)
const iconRef = useMainThreadRef<HoverElement | null>(null)
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
      if (labelRef.current) labelRef.current.setStyleProperty('color', '')
      if (iconRef.current) iconRef.current.setStyleProperty('color', current.getAttribute('hover-foreground') || '')
      if (borderRef.current) borderRef.current.setStyleProperty('border-color', '')
      return
    }
    const now = Date.now()
    if (press.released === null) {
      const delay = Math.max(0, Number(current.getAttribute('hover-start-time')) || 0)
      if (!press.active && now - press.started >= delay) {
        press.active = true
        if (current.getAttribute('hover-custom-background') !== 'true') current.setStyleProperty('background-color', 'var(--wot-button-current-bg-active)')
        if (current.getAttribute('hover-custom-color') !== 'true') {
          current.setStyleProperty('color', 'var(--wot-button-current-text-active)')
          if (labelRef.current) labelRef.current.setStyleProperty('color', 'var(--wot-button-current-text-active)')
          if (iconRef.current) iconRef.current.setStyleProperty('color', 'var(--wot-button-current-text-active)')
        }
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
    if (labelRef.current) labelRef.current.setStyleProperty('color', '')
    if (iconRef.current) iconRef.current.setStyleProperty('color', current.getAttribute('hover-foreground') || '')
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
  if (labelRef.current) labelRef.current.setStyleProperty('color', '')
  if (iconRef.current) iconRef.current.setStyleProperty('color', element.getAttribute('hover-foreground') || '')
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
    :hover-foreground="buttonTextColor"
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
        :color="buttonTextColor"
        :size="iconSize"
        :custom-style="iconStyle"
        :main-thread-ref="iconRef"
      />
      <view v-if="$slots.default || text" class="wd-button__text" :style="labelStyle" :main-thread-ref="labelRef">
        <WdTextSlot text-class="wd-button__text-content" :text-style="textStyle" :text-maxline="1">
          <slot><text class="wd-button__text-content" :style="textStyle" text-maxline="1">{{ text }}</text></slot>
        </WdTextSlot>
      </view>
    </view>
    <view v-if="outlined" class="wd-button__border" :style="borderStyle" :main-thread-ref="borderRef" />
  </view>
</template>
