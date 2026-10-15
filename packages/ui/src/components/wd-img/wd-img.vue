/*
 * wd-img — 图片
 *
 * Lynx 实现说明：基于原生 image 元素，加载 / 错误态经插槽定制；
 * 圆形与圆角经 border-radius 实现。
 */
<script lang="ts" setup>
import './index.css'

import { computed, ref } from 'vue-lynx'
import WdIcon from '../wd-icon/wd-icon.vue'
import { imgProps } from './types'
import { addUnit, isDef } from '../../common/util'

const props = defineProps(imgProps)
const emit = defineEmits(['load', 'error', 'click', 'tap'])

const status = ref<'loading' | 'success' | 'error'>('loading')

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
  return Object.entries(style).map(([k, v]) => `${k}: ${v}`).join('; ') + (props.customStyle ? `; ${props.customStyle}` : '')
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
        <wd-icon name="image" custom-class="wd-img__loading-icon" />
      </slot>
    </view>
    <view v-if="status === 'error' && showError" class="wd-img__error">
      <slot name="error">
        <wd-icon name="image-failloading" custom-class="wd-img__error-icon" />
      </slot>
    </view>
  </view>
</template>
