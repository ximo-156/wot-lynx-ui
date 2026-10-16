/*
 * wd-image-preview — 图片预览
 *
 * Lynx 实现说明：基于 wd-overlay + wd-swiper；
 * 命令式 API 经 useImagePreview(selector) 驱动（模块级注入单例）。
 */
<script lang="ts" setup>
import './index.css'

import { computed, ref, watch } from 'vue-lynx'
import WdOverlay from '../wd-overlay/wd-overlay.vue'
import WdIcon from '../wd-icon/wd-icon.vue'
import WdSwiper from '../wd-swiper/wd-swiper.vue'
import { imagePreviewProps, type ImagePreviewExpose, type ImagePreviewOptions } from './types'
import { getImagePreviewOptionKey, useImagePreview } from '.'
import { useAlive } from '../../composables/useAlive'

const props = defineProps(imagePreviewProps)
const isAlive = useAlive()

const state = ref({
  show: false,
  visible: false,
  images: [] as string[],
  currentIndex: 0
})

const { previewImage, options: imagePreviewOption } = useImagePreview(props.selector)

// 消费页面级命令式 API：useImagePreview(selector).previewImage(opts) 写入的是
// 本组件 inject 的共享 option ref。此前只写不读（无 watch），页面级调用静默
// 无效；此处 watch 并合并进 state、打开预览（对齐 wd-notify 的命令式模式）。
watch(
  () => imagePreviewOption.value,
  (newVal) => {
    if (!newVal || typeof newVal === 'symbol' || !isAlive()) return
    const opts = newVal as ImagePreviewOptions
    if (!opts.images || opts.images.length === 0) return
    state.value.images = opts.images
    state.value.currentIndex = opts.startPosition || 0
    state.value.show = true
  },
  { deep: true }
)

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
  // enter 链经 wd-transition 的帧定时器驱动，可能晚于卸载落地
  if (!isAlive()) return
  state.value.visible = true
}

function handleAfterLeave() {
  // leave 链落地时组件可能已卸载：此时置 visible=false 会卸载 swiper
  // 子树，在已销毁树上产生晚到的 remove（真机 9902 家族）
  if (!isAlive()) return
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
      <view v-if="options.closeable" :class="`wd-image-preview__close wd-image-preview__close--${options.closeIconPosition}`" @tap.stop="close">
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
