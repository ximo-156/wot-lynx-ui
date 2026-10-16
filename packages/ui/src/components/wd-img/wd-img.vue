/*
 * wd-img — 图片
 *
 * Lynx 实现说明：基于原生 image 元素，加载 / 错误态经插槽定制；
 * 圆形与圆角经 border-radius 实现；enablePreview 时点击经
 * common/uni 兼容层调 uni.previewImage（宿主可注入，未注入时降级
 * warning，不崩溃）。
 */
<script lang="ts" setup>
import './index.css'

import { computed, ref, watch } from 'vue-lynx'
import WdIcon from '../wd-icon/wd-icon.vue'
import { imgProps } from './types'
import { addUnit, isDef, filterStyle, parseStyle } from '../../common/util'
import { uni } from '../../common/uni'

const props = defineProps(imgProps)
const emit = defineEmits(['load', 'error', 'click', 'tap'])

const status = ref<'loading' | 'success' | 'error'>('loading')

// src 变化时复位加载态：否则旧 src 失败后换成有效 URL，image 仍被 v-if
// 藏起，永久停留在错误占位
watch(
  () => props.src,
  () => {
    status.value = 'loading'
  }
)

const rootClass = computed(() => {
  const classes = ['wd-img']
  if (props.round) classes.push('is-round')
  if (props.customClass) classes.push(props.customClass)
  return classes.join(' ')
})

const rootStyle = computed(() => {
  const style: Record<string, string> = {}
  if (isDef(props.width)) style.width = addUnit(props.width)
  if (isDef(props.height)) style.height = addUnit(props.height)
  if (isDef(props.radius)) style['border-radius'] = addUnit(props.radius)
  return { ...filterStyle(style), ...parseStyle(props.customStyle) }
})

function handleLoad(event: any) {
  status.value = 'success'
  emit('load', event)
}

function handleError(event: any) {
  status.value = 'error'
  emit('error', event)
}

function handleClick(event: any) {
  // 预览（与 wot-ui 一致）：加载成功后才允许预览，地址取 previewSrc || src
  if (props.enablePreview && props.src && status.value === 'success') {
    uni.previewImage({ urls: [props.previewSrc || props.src] })
  }
  emit('click', event)
  emit('tap', event)
}
</script>

<template>
  <view :class="rootClass" :style="rootStyle" @tap="handleClick">
    <image
      v-if="status !== 'error'"
      :class="`wd-img__image ${customImage}`"
      :src="src"
      :mode="mode"
      :show-menu-by-longpress="showMenuByLongpress"
      :lazy-load="lazyLoad"
      @load="handleLoad"
      @error="handleError"
    />
    <view v-if="status === 'loading' && showLoading" class="wd-img__loading">
      <slot name="loading">
        <wd-icon name="picture" custom-class="wd-img__loading-icon" />
      </slot>
    </view>
    <view v-if="status === 'error' && showError" class="wd-img__error">
      <slot name="error">
        <wd-icon name="error" custom-class="wd-img__error-icon" />
      </slot>
    </view>
  </view>
</template>
