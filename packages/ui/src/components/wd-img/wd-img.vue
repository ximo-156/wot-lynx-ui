<template>
  <view :class="rootClass" @tap="handleClick" :style="styleToObject(rootStyle)">
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
        <!-- Lynx 适配：wd-icon 的 svg content 不继承 CSS currentColor，颜色需显式下发。 -->
        <WdIcon name="image" custom-class="wd-img__loading-icon" :color="stateIconColor" />
      </slot>
    </view>
    <view v-if="status === 'error' && showError" class="wd-img__error">
      <slot name="error">
        <WdIcon name="image-failloading" custom-class="wd-img__error-icon" :color="stateIconColor" />
      </slot>
    </view>
  </view>
</template>
<script setup lang="ts">
import './index.css'
import { uni } from '../../common/uni'
import WdIcon from '../wd-icon/wd-icon.vue'
import { computed, ref, watch } from 'vue-lynx'
import { styleToObject, addUnit, isDef, objToStyle } from '../../common/util'
import { imgProps } from './types'
import { COOLGREY } from '../../common/theme'

const props = defineProps(imgProps)
const emit = defineEmits<{
  (e: 'error', event: Event): void
  (e: 'click', event: MouseEvent): void
  (e: 'load', event: Event): void
}>()

/**
 * 加载/失败态图标取色
 * Lynx 适配：wd-icon 的 svg content 不继承 CSS currentColor，需显式下发颜色，
 * 取值与主题变量 --wot-icon-auxiliary 保持一致（见 common/theme.ts）。
 */
const stateIconColor = COOLGREY[6]

const rootStyle = computed(() => {
  const style: Record<string, string | number> = {}
  if (isDef(props.height)) {
    style['height'] = addUnit(props.height)
  }
  if (isDef(props.width)) {
    style['width'] = addUnit(props.width)
  }
  if (isDef(props.radius)) {
    style['border-radius'] = addUnit(props.radius)
    style['overflow'] = 'hidden'
  }
  return `${objToStyle(style)}${props.customStyle}`
})

const rootClass = computed(() => {
  return `wd-img  ${props.round ? 'is-round' : ''} ${props.customClass}`
})

const status = ref<'loading' | 'error' | 'success'>('loading')

// 失败时 image 会被卸载；src 变化后必须回到 loading，新地址才能重新挂载并触发 load/error
watch(
  () => props.src,
  () => {
    status.value = 'loading'
  }
)

function handleError(event: any) {
  status.value = 'error'
  emit('error', event)
}
function handleClick(event: MouseEvent) {
  if (props.enablePreview && props.src && status.value == 'success') {
    uni.previewImage({
      urls: [props.previewSrc || props.src]
    })
  }
  emit('click', event)
}
function handleLoad(event: any) {
  status.value = 'success'
  emit('load', event)
}
</script>

