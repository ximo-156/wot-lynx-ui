<template>
  <view
    :id="buttonId"
    :style="styleToObject(customStyle)"
    :class="[
      'wd-button',
      'is-' + effectiveType,
      'is-' + effectiveSize,
      isIcon ? 'is-icon' : '',
      effectiveRound ? 'is-round' : '',
      hairline ? 'is-hairline' : '',
      effectiveVariant !== 'base' ? 'is-' + effectiveVariant : '',
      disabled ? 'is-disabled' : '',
      block ? 'is-block' : '',
      loading ? 'is-loading' : '',
      customClass
    ]"
    @tap="handleClick"
  >
    <view class="wd-button__content">
      <WdLoading v-if="loading" v-bind="customLoadingProps"></WdLoading>
      <WdIcon
        v-else-if="icon || cssIcon"
        custom-class="wd-button__icon"
        :name="icon"
        :class-prefix="classPrefix"
        :css-icon="cssIcon"
        :size="iconSize"
        :color="textColor"
      ></WdIcon>
      <view :class="`wd-button__text${icon || cssIcon ? ' is-after-icon' : ''}`" v-if="$slots.default || text">
        <slot><text>{{ text }}</text></slot>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import './index.css'
import WdIcon from '../wd-icon/wd-icon.vue'
import WdLoading from '../wd-loading/wd-loading.vue'
import { computed, useSlots } from 'vue-lynx'
import { buttonProps } from './types'
import { styleToObject, isDef, omitBy, isUndefined } from '../../common/util'
import { BLUE, GREEN, RED, ORANGE, WHITE, COOLGREY } from '../../common/theme'
import { type LoadingProps } from '../wd-loading/types'
import { useGlobalConfig } from '../../composables/useGlobalConfig'

const slots = useSlots()

const props = defineProps(buttonProps)
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
  (e: 'getuserinfo', event: any): void
  (e: 'contact', event: any): void
  (e: 'getphonenumber', event: any): void
  (e: 'getrealtimephonenumber', event: any): void
  (e: 'error', event: any): void
  (e: 'launchapp', event: any): void
  (e: 'opensetting', event: any): void
  (e: 'chooseavatar', event: any): void
  (e: 'agreeprivacyauthorization', event: any): void
}>()

/**
 * 加载配置项
 *
 * Lynx 适配：内嵌 loading 的 circular 类型由原生 svg 绘制，svg content 不继承
 * CSS currentColor，因此除用户显式传入的 loadingColor 外，还需要按按钮类型
 * 算出文字色并显式下发（与 index.scss 中各类型的文字色保持一致）。
 */
const customLoadingProps = computed(() => {
  const loadingProps: Partial<LoadingProps> = isDef(props.loadingProps) ? omitBy(props.loadingProps, isUndefined) : {}
  loadingProps.customSpinnerClass = `${isDef(loadingProps.customSpinnerClass) ? loadingProps.customSpinnerClass : ''} wd-button__loading`
  loadingProps.inheritColor = isDef(loadingProps.inheritColor) ? loadingProps.inheritColor : true
  if (!isDef(loadingProps.color) && isDef(props.loadingColor)) {
    loadingProps.color = props.loadingColor
  } else if (!isDef(loadingProps.color)) {
    loadingProps.color = loadingTextColor.value
  }
  return loadingProps
})

/**
 * 按钮文字色 / 图标色。
 * Lynx 适配：wd-icon 的内置 SVG 图标 fill 写死在 props.color 上，不继承 CSS color，
 * 因此按类型与变体显式解析（与 index.scss 中各类型的文字色保持一致）。
 */
const textColor = computed(() => {
  const type = effectiveType.value
  if (effectiveVariant.value === 'base') {
    return type === 'info' ? COOLGREY[10] : WHITE
  }
  switch (type) {
    case 'success':
      return GREEN[6]
    case 'danger':
      return RED[6]
    case 'warning':
      return ORANGE[6]
    case 'info':
      return COOLGREY[10]
    default:
      return BLUE[6]
  }
})

/** 按钮图标尺寸（px），与 index.scss 的 $button-size-icon-* 一致 */
const ICON_SIZE_MAP: Record<string, number> = {
  mini: 14,
  small: 16,
  medium: 20,
  large: 22
}

const iconSize = computed(() => ICON_SIZE_MAP[effectiveSize.value] || 20)

/** 供 customLoadingProps 取色（同上） */
const loadingTextColor = textColor

/**
 * 开放能力类型
 */
const openTypeValue = computed(() => {
  return props.disabled || props.loading ? undefined : props.openType
})

/**
 * 是否仅展示图标
 */
const isIcon = computed(() => {
  return !slots.default && !props.text && !!(props.icon || props.cssIcon)
})

/**
 * 处理点击事件
 * @param event
 */
function handleClick(event: any) {
  if (!props.disabled && !props.loading) {
    emit('click', event)
  }
}

/**
 * 支付宝小程序授权
 * @param event
 */
function handleGetAuthorize(event: any) {
  if (props.scope === 'phoneNumber') {
    handleGetPhoneNumber(event)
  } else if (props.scope === 'userInfo') {
    handleGetUserInfo(event)
  }
}

/**
 * 获取用户信息回调
 * @param event
 */
function handleGetUserInfo(event: any) {
  emit('getuserinfo', event)
}

/**
 * 客服会话回调
 * @param event
 */
function handleContact(event: any) {
  emit('contact', event)
}

/**
 * 获取手机号回调
 * @param event
 */
function handleGetPhoneNumber(event: any) {
  emit('getphonenumber', event)
}

/**
 * 获取实时手机号回调
 * @param event
 */
function handleGetRealtimePhoneNumber(event: any) {
  emit('getrealtimephonenumber', event)
}

/**
 * 当使用开放能力发生错误时回调
 * @param event
 */
function handleError(event: any) {
  emit('error', event)
}

/**
 * 打开 APP 成功的回调
 * @param event
 */
function handleLaunchApp(event: any) {
  emit('launchapp', event)
}

/**
 * 在打开授权设置页后回调
 * @param event
 */
function handleOpenSetting(event: any) {
  emit('opensetting', event)
}

/**
 * 获取头像回调
 * @param event
 */
function handleChooseAvatar(event: any) {
  emit('chooseavatar', event)
}

/**
 * 隐私协议授权回调
 * @param event
 */
function handleAgreePrivacyAuthorization(event: any) {
  emit('agreeprivacyauthorization', event)
}
</script>

