/*
 * wd-navbar — 导航栏
 *
 * Lynx 实现说明（相对 wot-ui 2.3.2 的适配点）：
 * - 参考源外层占位 view 的 :style="{ height: addUnit(height) }" 在未度量时
 *   产出非法值 "px"（浏览器忽略）；Lynx 的字符串 style 会被静默丢弃
 *   （CONVENTIONS §19），故改为对象语法 + Style Funnel（§20）：height 未
 *   度量时显式下发中性值 auto（视觉等同不设置），度量后下发实测高度，
 *   避免条件写样式导致上一帧高度残留；display / flex-direction 为常量键
 *   （根节点三件套，NATIVE-REWRITE §3.1），随每帧完整下发；
 * - rootStyle 的 z-index / padding-top / height / line-height 同样经
 *   resolveStyle 输出完整键集（§20）；customStyle 经 parseStyle 归一；
 * - 安全区适配：参考源取 useDeviceInfo 的 statusBarHeight（Lynx 不提供
 *   安全区数据，宿主未注入时为 0，即不额外 padding）；
 * - 占位高度经 getRect('.wd-navbar') 实测（参考源行为），回调经 useAlive
 *   守卫（真机 9902 防护）；
 * - 参考源右侧文案的 hover-class="wd-navbar__text--hover"（uni-app 专有
 *   按压态属性，参考源 SCSS 亦无对应规则）删除，按压反馈由 :active 承担；
 * - 左侧箭头图标：参考源传 name="left"，本地内置图标集无该字形，映射到
 *   arrow-left-bold（CONVENTIONS §8）；
 * - 文本节点：参考源用 block 元素承载标题/两侧文案，Lynx 无 block，
 *   统一改为 text 元素。
 */
<script lang="ts" setup>
import './index.css'

import { computed, getCurrentInstance, nextTick, onMounted, ref, watch } from 'vue-lynx'
import WdIcon from '../wd-icon/wd-icon.vue'
import { navbarProps } from './types'
import { addUnit, getRect, isDef, parseStyle, uuid } from '../../common/util'
import { useDeviceInfo } from '../../composables/useDeviceInfo'
import { useAlive } from '../../composables/useAlive'
import { defineStyleKeys, resolveStyle } from '../../common/style'

const props = defineProps(navbarProps)
const emit = defineEmits(['click-left', 'click-right'])

/** 组件存活守卫：getRect 回调晚于卸载落地时丢弃（真机 9902 防护） */
const isAlive = useAlive()
const navbarId = `wd-navbar-${uuid()}`
let heightRequest = 0

/**
 * 占位高度
 */
const height = ref<number | ''>('')

const { statusBarHeight, navBarHeight } = useDeviceInfo()

watch(
  [() => props.fixed, () => props.placeholder, () => props.safeAreaInsetTop, () => props.bordered, () => props.customStyle, () => props.customClass, statusBarHeight, navBarHeight],
  () => {
    ++heightRequest
    nextTick(() => { if (isAlive()) setPlaceholderHeight() })
  },
  { deep: true, immediate: false }
)

/**
 * 根节点样式（对象语法 + Style Funnel：键集完整，条件翻转不残留旧值）
 */
const ROOT_STYLE = defineStyleKeys({
  'z-index': 'auto',
  'padding-top': '0px',
  height: '',
  'line-height': ''
})

const rootStyle = computed(() =>
  resolveStyle(
    ROOT_STYLE,
    {
      'z-index': props.fixed && isDef(props.zIndex) ? String(props.zIndex) : undefined,
      'padding-top': props.safeAreaInsetTop ? addUnit(statusBarHeight.value || 0) : undefined,
      height: navBarHeight.value ? addUnit(navBarHeight.value) : undefined,
      'line-height': navBarHeight.value ? addUnit(navBarHeight.value) : undefined
    },
    parseStyle(props.customStyle)
  )
)

/** 外层占位 view 样式：display / flex-direction 为常量键（根节点三件套，
    NATIVE-REWRITE §3.1）；height 未度量时为 auto（等同不设置） */
const PLACEHOLDER_STYLE = defineStyleKeys({
  display: 'flex',
  'flex-direction': 'column',
  height: 'auto'
})

const placeholderStyle = computed(() =>
  resolveStyle(PLACEHOLDER_STYLE, {
    height: height.value !== '' ? addUnit(height.value) : undefined
  })
)

onMounted(() => {
  if (props.fixed && props.placeholder) {
    nextTick(() => {
      setPlaceholderHeight()
    })
  }
})

/**
 * 处理左侧点击事件
 */
function handleClickLeft() {
  if (!props.leftDisabled) {
    emit('click-left')
  }
}

/**
 * 处理右侧点击事件
 */
function handleClickRight() {
  if (!props.rightDisabled) {
    emit('click-right')
  }
}

/**
 * 获取当前实例的代理对象
 */
const { proxy } = getCurrentInstance() as any

/**
 * 设置占位高度
 */
function setPlaceholderHeight() {
  const request = ++heightRequest
  if (!props.fixed || !props.placeholder) {
    height.value = ''
    return
  }

  getRect(`#${navbarId}`, false, proxy).then((res) => {
    if (!isAlive() || request !== heightRequest || !props.fixed || !props.placeholder) return
    height.value = res.height as number
  })
}
</script>

<template>
  <view :style="placeholderStyle">
    <view :id="navbarId" :class="`wd-navbar ${customClass} ${fixed ? 'is-fixed' : ''} ${bordered ? 'is-border' : ''}`" :style="rootStyle">
      <view class="wd-navbar__content">
        <view class="wd-navbar__capsule" v-if="$slots.capsule">
          <slot name="capsule" />
        </view>

        <view :class="`wd-navbar__left ${leftDisabled ? 'is-disabled' : ''}`" @tap="handleClickLeft" v-else-if="!$slots.left">
          <WdIcon v-if="leftArrow" name="left" custom-class="wd-navbar__arrow" />
          <text v-if="leftText" class="wd-navbar__text">{{ leftText }}</text>
        </view>

        <view v-else :class="`wd-navbar__left ${leftDisabled ? 'is-disabled' : ''}`" @tap="handleClickLeft">
          <slot name="left" />
        </view>

        <view class="wd-navbar__title">
          <slot name="title" />
          <text v-if="!$slots.title && title">{{ title }}</text>
        </view>

        <view :class="`wd-navbar__right ${rightDisabled ? 'is-disabled' : ''}`" @tap="handleClickRight" v-if="$slots.right || rightText">
          <slot name="right" />
          <text v-if="!$slots.right && rightText" class="wd-navbar__text">{{ rightText }}</text>
        </view>
      </view>
      <view v-if="bordered" class="wd-navbar__border" />
    </view>
  </view>
</template>
