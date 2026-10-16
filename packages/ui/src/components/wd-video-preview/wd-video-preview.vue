/*
 * wd-video-preview — 视频预览
 *
 * Lynx 实现说明：基于 wd-overlay + 原生 video 元素；
 * 命令式 API 经 useVideoPreview(selector) 驱动（模块级注入单例）。
 */
<script lang="ts" setup>
import './index.css'

import { computed, ref } from 'vue-lynx'
import WdOverlay from '../wd-overlay/wd-overlay.vue'
import WdIcon from '../wd-icon/wd-icon.vue'
import { videoPreviewProps, type VideoPreviewOptions, type VideoPreviewExpose } from './types'
import { getVideoPreviewOptionKey, useVideoPreview } from '.'

const props = defineProps(videoPreviewProps)

const state = ref({
  show: false,
  visible: false
})

const videoId = ref(`wd-video-preview-${Math.random().toString(36).slice(2)}`)

const { previewVideo, currentOptions } = useVideoPreview(props.selector)

const options = computed(() => ({
  zIndex: props.zIndex,
  fullScreen: props.fullScreen,
  closePosition: props.closePosition
}))

const videoClass = computed(() => {
  const classes = ['wd-video-preview__video']
  if (props.fullScreen) classes.push('is-full-screen')
  return classes.join(' ')
})

function close() {
  state.value.show = false
  props.onClose && props.onClose()
}

function handleEnter() {
  state.value.visible = true
  props.onOpen && props.onOpen()
}

function handleAfterLeave() {
  state.value.visible = false
}

function open(video: VideoPreviewOptions) {
  // 先置 show 再写入 options：overlay 的 :show 才会驱动入场过渡，
  // 否则命令式打开时遮罩不显示（与 wd-image-preview 的 open 保持一致）
  state.value.show = true
  previewVideo(video)
}

defineExpose<VideoPreviewExpose>({
  open,
  close
})
</script>

<template>
  <wd-overlay
    :show="state.show"
    :z-index="options.zIndex"
    :lock-scroll="true"
    :custom-class="`wd-video-preview ${customClass}`"
    :custom-style="customStyle"
    @click="close"
    @enter="handleEnter"
    @after-leave="handleAfterLeave"
  >
    <view :class="videoClass" @tap.stop>
      <video
        v-if="state.visible"
        :id="videoId"
        class="wd-video-preview__video-player"
        :controls="true"
        :poster="currentOptions.poster"
        :title="currentOptions.title"
        play-btn-position="center"
        :enableNative="true"
        :src="currentOptions.url"
        :enable-progress-gesture="false"
      />
    </view>
    <view :class="`wd-video-preview__close wd-video-preview__close--${options.closePosition}`" @tap.stop="close">
      <wd-icon name="close" custom-class="wd-video-preview__close-icon" />
    </view>
  </wd-overlay>
</template>
