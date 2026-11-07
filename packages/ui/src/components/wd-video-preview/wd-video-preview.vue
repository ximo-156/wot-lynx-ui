/*
 * wd-video-preview — 视频预览
 *
 * Lynx 原生实现说明（ADR-022）：
 * - 统一 WdOverlay 弹层模式，ref.open 与 useVideoPreview 共用单次选项通道。
 * - 播放走引擎原生 UIMethod（SelectorQuery.invoke('play' / 'pause')），
 *   不再需要宿主注入 createVideoContext；
 * - video 元素 为 Lynx 4.1+ 内置 XElement：宿主未注册（capabilities.videoElement
 *   为 false）时降级为封面 + 播放图标占位，避免创建节点抛引擎级 990200 / 60301；
 * - Lynx 的 video 没有 poster / autoplay / controls 属性：封面用 image> 叠加，
 *   播放按钮由组件自己渲染并调用原生 play；
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
import { invokeNative } from '../../common/native'
import { getPlatform } from '../../common/platform'
import { useAlive } from '../../composables/useAlive'

const props = defineProps(videoPreviewProps)
const emit = defineEmits<{ open: []; close: []; tap: [event: any] }>()
const isAlive = useAlive()
const instance = getCurrentInstance()!
let videoRequest = 0
const state = reactive({ show: false, visible: false, playing: false })
const previewVideo = reactive<PreviewVideo>({ url: '', poster: '', title: '' })
const requestOptions = ref<Partial<VideoPreviewOptions>>({})
const videoId = `wd-video-preview-${uuid()}`
const videoPreviewOption = inject(getVideoPreviewOptionKey(props.selector), ref<Partial<VideoPreviewOptions>>({}))
const options = computed(() => {
  const overrides = Object.fromEntries(Object.entries(requestOptions.value).filter(([, value]) => isDef(value)))
  return { ...props, ...overrides } as typeof props & Partial<VideoPreviewOptions>
})
/**
 * video 元素 是 Lynx 的 XElement：宿主引擎未注册 video 原生组件时创建节点直接抛
 * 990200「No BehaviorController defined for class video」，后续属性更新再抛
 * 60301「Can't find ui tag」（真机 2026-10-25）。能力判定改为原生版本探测
 * （SystemInfo.engineVersion ≥ 4.1），宿主可显式覆盖。
 */
const canPlayVideo = computed(() => getPlatform().capabilities.videoElement)
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
  // Lynx 的 video 元素没有 requestFullScreen UIMethod：全屏由宿主能力提供，
  // 宿主未提供时保持原尺寸（不伪造全屏）。
  if (!options.value.fullScreen || !canPlayVideo.value) return
  const request = videoRequest
  nextTick(() => {
    if (!isAlive() || !state.show || !options.value.fullScreen || request !== videoRequest) return
    invokeNative(`#${videoId}`, 'play')
  })
}

/** 播放 / 暂停：原生 UIMethod 直接命令引擎里的 video 节点。 */
function togglePlay() {
  if (!isAlive() || !state.visible || !canPlayVideo.value) return
  if (state.playing) {
    invokeNative(`#${videoId}`, 'pause')
    state.playing = false
  } else {
    invokeNative(`#${videoId}`, 'play')
    state.playing = true
  }
}

function handleAfterLeave() {
  if (isAlive() && state.show) return
  state.visible = false
  state.playing = false
  previewVideo.url = ''
  previewVideo.poster = ''
  previewVideo.title = ''
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
      <!-- 封面：Lynx 的 video 没有 poster 属性，封面由 <image> 叠加承载 -->
      <image v-if="previewVideo.poster" class="wd-video-preview__poster" :src="previewVideo.poster" />
      <video
        v-if="state.visible && previewVideo.url && canPlayVideo"
        :id="videoId"
        class="wd-video-preview__video-player"
        :src="previewVideo.url"
        object-fit="contain"
        @playing="state.playing = true"
        @paused="state.playing = false"
        @ended="state.playing = false"
      />
      <view
        v-if="state.visible && previewVideo.url && canPlayVideo"
        class="wd-video-preview__control"
        @tap.stop="togglePlay"
      >
        <WdIcon :name="state.playing ? 'pause' : 'play'" custom-class="wd-video-preview__control-icon" />
      </view>
      <!-- 引擎没有 video 元素时的降级占位：封面铺满 + 播放图标，不再创建 video 元素 节点 -->
      <view v-if="state.visible && previewVideo.url && !canPlayVideo" class="wd-video-preview__fallback">
        <image v-if="previewVideo.poster" class="wd-video-preview__fallback-poster" :src="previewVideo.poster" />
        <view class="wd-video-preview__fallback-hint">
          <WdIcon name="play" custom-class="wd-video-preview__fallback-icon" />
        </view>
      </view>
      <text v-if="previewVideo.title" class="wd-video-preview__title">{{ previewVideo.title }}</text>
    </view>
    <view :class="closeClass" @tap.stop="close">
      <WdIcon name="close" custom-class="wd-video-preview__close-icon" />
    </view>
  </WdOverlay>
</template>
