<template>
  <view :style="{ height: addUnit(height) }">
    <view :class="`wd-navbar ${customClass} ${fixed ? 'is-fixed' : ''} ${bordered ? 'is-border' : ''}`" :style="styleToObject(rootStyle)">
      <view class="wd-navbar__content">
        <view class="wd-navbar__capsule" v-if="$slots.capsule">
          <slot name="capsule" />
        </view>

        <view :class="`wd-navbar__left ${leftDisabled ? 'is-disabled' : ''}`" @tap="handleClickLeft" v-else-if="!$slots.left">
          <!-- Lynx 适配：wd-icon 的 svg content 不继承 CSS currentColor，颜色需显式下发。 -->
          <WdIcon v-if="leftArrow" name="left" custom-class="wd-navbar__arrow" :color="arrowColor" />
          <view v-if="leftText" class="wd-navbar__text"><text>{{ leftText }}</text></view>
        </view>

        <view v-else :class="`wd-navbar__left ${leftDisabled ? 'is-disabled' : ''}`" @tap="handleClickLeft">
          <slot name="left" />
        </view>

        <view class="wd-navbar__title">
          <slot name="title" />
          <template v-if="!$slots.title && title"><text>{{ title }}</text></template>
        </view>
        <view :class="`wd-navbar__right ${rightDisabled ? 'is-disabled' : ''}`" @tap="handleClickRight" v-if="$slots.right || rightText">
          <slot name="right" />

          <view v-if="!$slots.right && rightText" class="wd-navbar__text">
            <text>{{ rightText }}</text>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>
<script setup lang="ts">
import './index.css'
import WdIcon from '../wd-icon/wd-icon.vue'
import {computed, getCurrentInstance, nextTick, onMounted, ref, watch} from 'vue-lynx'
import { styleToObject, type CSSProperties, getRect, addUnit, isDef, objToStyle } from '../../common/util'
import { navbarProps } from './types'
import { useDeviceInfo } from '../../composables/useDeviceInfo'
import { COOLGREY } from '../../common/theme'

const props = defineProps(navbarProps)
const emit = defineEmits(['click-left', 'click-right'])

/**
 * 返回箭头取色
 * Lynx 适配：wd-icon 的 svg content 不继承 CSS currentColor，需显式下发颜色，
 * 取值与主题变量 --wot-text-main 保持一致（见 common/theme.ts）。
 */
const arrowColor = COOLGREY[10]

/**
 * 占位高度
 */
const height = ref<number | ''>('')

const { statusBarHeight, navBarHeight } = useDeviceInfo()

watch(
  [() => props.fixed, () => props.placeholder],
  () => {
    setPlaceholderHeight()
  },
  { deep: true, immediate: false }
)

/**
 * 根节点样式
 */
const rootStyle = computed(() => {
  const style: CSSProperties = {}
  if (props.fixed && isDef(props.zIndex)) {
    style['z-index'] = props.zIndex
  }
  if (props.safeAreaInsetTop) {
    style['padding-top'] = addUnit(statusBarHeight.value || 0)
  }
  if (navBarHeight.value) {
    style['height'] = addUnit(navBarHeight.value)
    style['line-height'] = addUnit(navBarHeight.value)
  }
  return `${objToStyle(style)}${props.customStyle}`
})

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
  if (!props.fixed || !props.placeholder) {
    return
  }

  getRect('.wd-navbar', false, proxy)
    .then((res) => {
      height.value = res.height as number
    })
    .catch((error) => {
      // 节点度量失败（无匹配节点 / 宿主不支持 SelectorQuery）时保留默认占位高度，
      // 避免未处理的 Promise 拒绝被 Sentry 上报为 USER_RUNTIME_ERROR。
    })
}
</script>

