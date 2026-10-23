/*
 * wd-img — 图片
 * 保留官方 image/image-failloading 图标与 loading/error 插槽；tap 映射 click。
 * 预览通过宿主适配器下发。图片填充和小程序长按菜单仍依赖 Lynx 宿主能力。
 * src 变化重置加载态；圆角与尺寸用完整样式键避免动态更新残留。
 */
<script lang="ts" setup>
import './index.css'

import { computed, ref, watch } from 'vue-lynx'
import WdIcon from '../wd-icon/wd-icon.vue'
import { imgProps } from './types'
import { addUnit, isDef, parseStyle } from '../../common/util'
import { defineStyleKeys, resolveStyle } from '../../common/style'
import { uni } from '../../common/uni'

const props = defineProps(imgProps)
const emit = defineEmits(['load', 'error', 'click', 'tap'])
const status = ref<'loading' | 'success' | 'error'>('loading')
watch(() => props.src, () => { status.value = 'loading' })

const rootClass = computed(() => ['wd-img', { 'is-round': props.round }, props.customClass])
const IMG_STYLE = defineStyleKeys({ height: '', width: '', 'border-radius': '', overflow: '' })
const rootStyle = computed(() => resolveStyle(IMG_STYLE, {
  height: isDef(props.height) ? addUnit(props.height) : '',
  width: isDef(props.width) ? addUnit(props.width) : '',
  'border-radius': isDef(props.radius) ? addUnit(props.radius) : '',
  overflow: isDef(props.radius) || props.round ? 'hidden' : ''
}, parseStyle(props.customStyle)))

function handleLoad(event: any) {
  status.value = 'success'
  emit('load', event)
}
function handleError(event: any) {
  status.value = 'error'
  emit('error', event)
}
function handleClick(event: any) {
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
        <WdIcon name="image" custom-class="wd-img__loading-icon" />
      </slot>
    </view>
    <view v-if="status === 'error' && showError" class="wd-img__error">
      <slot name="error">
        <WdIcon name="image-failloading" custom-class="wd-img__error-icon" />
      </slot>
    </view>
  </view>
</template>
