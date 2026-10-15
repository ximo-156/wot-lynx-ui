/*
 * wd-image-preview — 图片预览
 *
 * Lynx 实现说明：基于 wd-overlay + wd-swiper；
 * 命令式 API 经 useImagePreview(selector) 驱动（模块级注入单例）。
 */
<script lang="ts" setup>
import './index.css'

import { computed, ref } from 'vue-lynx'
import WdOverlay from '../wd-overlay/wd-overlay.vue'
import WdIcon from '../wd-icon/wd-icon.vue'
import WdSwiper from '../wd-swiper/wd-swiper.vue'
import { imagePreviewProps, type ImagePreviewExpose, type ImagePreviewOptions } from './types'
import { getImagePreviewOptionKey, useImagePreview } from '.'

const props = defineProps(imagePreviewProps)

const state = ref({
  show: false,
  visible: false,
  images: [] as string[],
  currentIndex: 0
})

const { previewImage } = useImagePreview(props.selector)

const options = computed(() => ({
  images: state.value.images,
  startPosition: props.startPosition,
  showIndex: props.showIndex,
  loop: props.loop,
  closeable: props.closeable,
  closeIcon: props.closeIcon,
  closeIconPosition: props.closeIconPosition,
  showMenuByLongpress: props.showMenuByLongpress
}))

function open(opts: ImagePreviewOptions) {
  state.value.images = opts.images
  state.value.currentIndex = opts.startPosition || 0
  state.value.show = true
  previewImage(opts)
}

function close() {
  state.value.show = false
}

function handleEnter() {
  state.value.visible = true
}

function handleAfterLeave() {
  state.value.visible = false
}

function handleSwiperChange(e: any) {
  // swiper 的 change 载荷为 { current }（兼容 detail.current 形式）
  const next = e?.current ?? e?.detail?.current ?? 0
  state.value.currentIndex = Number(next) || 0
}

function handleImageClick() {
  close()
}

defineExpose<ImagePreviewExpose>({
  open,
  close
})
</script>

<template>
  <wd-overlay
    :show="state.show"
    :z-index="1000"
    :lock-scroll="true"
    :custom-class="`wd-image-preview ${customClass}`"
    :custom-style="customStyle"
    @enter="handleEnter"
    @after-leave="handleAfterLeave"
  >
    <slot name="close" :close="close">
      <view v-if="options.closeable" :class="`wd-image-preview__close wd-image-preview__close--${options.closeIconPosition}`" @click.stop="close">
        <wd-icon custom-class="wd-image-preview__close-icon" :name="options.closeIcon" />
      </view>
    </slot>

    <wd-swiper
      v-if="state.visible"
      custom-class="wd-image-preview__swiper"
      :list="state.images.map((url) => ({ url }))"
      :current="state.currentIndex"
      :autoplay="false"
      :loop="options.loop"
      height="100%"
      @click="handleImageClick"
      @change="handleSwiperChange"
    />

    <view v-if="options.showIndex && state.images.length > 1" class="wd-image-preview__index">
      <text>{{ state.currentIndex + 1 }} / {{ state.images.length }}</text>
    </view>
  </wd-overlay>
</template>
