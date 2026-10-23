/*
 * wd-video-preview — 视频预览
 *
 * Lynx 实现说明：
 * - 统一 WdOverlay 弹层模式，ref.open 与 useVideoPreview 共用单次选项通道。
 * - video 播放与系统全屏能力依赖宿主；这里保留原生媒体属性与退出全屏关闭。
 * - tap 防冒泡；进入后挂载 video，离场完成且未重新打开才清除媒体资源。
 */
<script lang="ts" setup>
import './index.css'

import { computed, getCurrentInstance, inject, nextTick, reactive, ref, watch } from 'vue-lynx'
import WdIcon from '../../primitives/wd-icon/wd-icon.vue'
import WdOverlay from '../../primitives/wd-overlay/wd-overlay.vue'
import { videoPreviewProps, type PreviewVideo, type VideoPreviewExpose, type VideoPreviewOptions } from './types'
import { getVideoPreviewOptionKey } from './index'
import { isDef, isFunction, uuid } from '../../common/util'
import { uni } from '../../common/uni'
import { getPlatform } from '../../common/platform'
import { useAlive } from '../../composables/useAlive'

const props = defineProps(videoPreviewProps)
const emit = defineEmits<{ open: []; close: []; tap: [event: any] }>()
const isAlive = useAlive()
const instance = getCurrentInstance()!
let videoRequest = 0
const state = reactive({ show: false, visible: false })
const previewVideo = reactive<PreviewVideo>({ url: '', poster: '', title: '' })
const requestOptions = ref<Partial<VideoPreviewOptions>>({})
const videoId = `wd-video-preview-${uuid()}`
const videoPreviewOption = inject(getVideoPreviewOptionKey(props.selector), ref<Partial<VideoPreviewOptions>>({}))
const options = computed(() => {
  const overrides = Object.fromEntries(Object.entries(requestOptions.value).filter(([, value]) => isDef(value)))
  return { ...props, ...overrides } as typeof props & Partial<VideoPreviewOptions>
})
const videoClass = computed(() => ['wd-video-preview__video', options.value.fullScreen ? 'is-fullscreen' : ''])
const closeClass = computed(() => ['wd-video-preview__close', `is-${options.value.closePosition}`])

function reset(option: Partial<VideoPreviewOptions>) {
  if (!isAlive()) return
  if (!option.show) {
    close()
    return
  }
  const alreadyOpen = state.show
  ++videoRequest
  requestOptions.value = { ...option }
  previewVideo.url = option.url || ''
  previewVideo.poster = option.poster || ''
  previewVideo.title = option.title || ''
  state.show = true
  if (alreadyOpen && state.visible) enterFullScreen()
}

watch(() => state.show, (show, previous) => {
  if (!isAlive() || show === previous) return
  if (show) emit('open')
  else emit('close')
  const raw = instance.vnode.props || {}
  const name = show ? 'onOpen' : 'onClose'
  const callback = requestOptions.value[name] || raw[show ? 'on-open' : 'on-close']
  if (isFunction(callback) && callback !== raw[name]) callback()
})
watch(() => videoPreviewOption.value, reset, { deep: true, immediate: true })

function handleEnter() {
  if (!isAlive() || !state.show) return
  state.visible = true
  enterFullScreen()
}
function enterFullScreen() {
  if (!options.value.fullScreen || !getPlatform().capabilities.videoContext) return
  const request = videoRequest
  nextTick(() => {
    if (!isAlive() || !state.show || !options.value.fullScreen || request !== videoRequest) return
    const context = uni.createVideoContext(videoId, instance.proxy)
    context?.requestFullScreen?.({ direction: 0 })
  })
}

function handleAfterLeave() {
  if (!isAlive() || state.show) return
  state.visible = false
  previewVideo.url = ''
  previewVideo.poster = ''
  previewVideo.title = ''
}

function handleFullscreenChange(event: any) {
  if (options.value.fullScreen && event?.detail?.fullScreen === false) close()
}

function close() {
  if (!isAlive()) return
  ++videoRequest
  state.show = false
}

function open(video: VideoPreviewOptions) {
  reset({ ...video, show: true })
}

function noop() {}

defineExpose<VideoPreviewExpose>({ open, close })
</script>

<template>
  <WdOverlay
    :show="state.show"
    :z-index="options.zIndex"
    :lock-scroll="true"
    :custom-class="`wd-video-preview ${customClass}`"
    :custom-style="customStyle"
    @click="close"
    @tap="emit('tap', $event)"
    @enter="handleEnter"
    @after-leave="handleAfterLeave"
  >
    <view :class="videoClass" @tap.stop="noop">
      <video
        v-if="state.visible && previewVideo.url"
        :id="videoId"
        class="wd-video-preview__video-player"
        :controls="true"
        :poster="previewVideo.poster"
        :title="previewVideo.title"
        play-btn-position="center"
        :enableNative="true"
        :src="previewVideo.url"
        :enable-progress-gesture="false"
        @fullscreenchange="handleFullscreenChange"
      />
    </view>
    <view :class="closeClass" @tap.stop="close">
      <WdIcon name="close" custom-class="wd-video-preview__close-icon" />
    </view>
  </WdOverlay>
</template>
