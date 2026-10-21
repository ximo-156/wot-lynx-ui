/*
 * wd-img — 图片
 *
 * Lynx 实现说明（相对 wot-ui 的适配点）：
 * - 结构对齐参考源：image（v-if 非错误态）+ loading / error 占位插槽；
 * - @click → @tap 且 emits 声明转发 'tap'（CONVENTIONS §6/§14）；
 * - enablePreview 的 uni.previewImage 经 common/uni 兼容层下发（宿主可注入，
 *   未注入时降级 warning 不崩溃）；
 * - rootStyle 对象语法（CONVENTIONS §19），radius 时按参考源补 overflow:hidden；
 * - 图标兜底：内置集无 'image' / 'image-failloading' 字形，分别回退
 *   'picture' / 'error'（同语义）；cssIcon / 图片链接模式不回退；
 * - src 变化时复位加载态（本地修复：旧 src 失败后换有效 URL 不再卡在错误占位）。
 */
<script lang="ts" setup>
import './index.css'

import { computed, ref, watch } from 'vue-lynx'
import WdIcon from '../wd-icon/wd-icon.vue'
import { imgProps } from './types'
import { addUnit, isDef, parseStyle } from '../../common/util'
import { defineStyleKeys, resolveStyle } from '../../common/style'
import { uni } from '../../common/uni'
import { resolveIcon } from '../../icons/registry'

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

/** 图标名兜底：注册表解析不到时回退同语义字形 */
function resolveIconName(name: string): string {
  if (!name || name.includes('/')) return name
  return resolveIcon(name) ? name : name === 'image-failloading' ? 'error' : 'picture'
}

const rootClass = computed(() => {
  const classes = ['wd-img']
  if (props.round) classes.push('is-round')
  if (props.customClass) classes.push(props.customClass)
  return classes.join(' ')
})

const IMG_STYLE = defineStyleKeys({ height: '', width: '', borderRadius: '', overflow: '' })
const rootStyle = computed(() => resolveStyle(IMG_STYLE, {
  height: isDef(props.height) ? addUnit(props.height) : '',
  width: isDef(props.width) ? addUnit(props.width) : '',
  borderRadius: isDef(props.radius) ? addUnit(props.radius) : '',
  overflow: isDef(props.radius) ? 'hidden' : ''
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
        <WdIcon :name="resolveIconName('image')" custom-class="wd-img__loading-icon" />
      </slot>
    </view>
    <view v-if="status === 'error' && showError" class="wd-img__error">
      <slot name="error">
        <WdIcon :name="resolveIconName('image-failloading')" custom-class="wd-img__error-icon" />
      </slot>
    </view>
  </view>
</template>
