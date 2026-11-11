/*
 * wd-video-preview — 视频预览
 *
 * Lynx 原生实现说明（ADR-022）：
 * - 原生 video 从 Lynx 4.1 才支持，低版本/未注册宿主不创建节点。
 * - 播放走 SelectorQuery UIMethod，界面状态以原生事件为准，不伪造成功。
 * - 封面在首帧事件后撤掉；调用失败与媒体错误提供可重试的可见反馈。
 * - 每次打开独立媒体代次，关闭/换片/卸载停止旧播放器并失效迟到回调。
 * - fullScreen 仅铺满预览层（并自动播放），不模拟宿主横屏/系统全屏 API。
 */
<script lang="ts" setup>
import './index.css'

import { computed, getCurrentInstance, inject, nextTick, onBeforeUnmount, reactive, ref, watch } from 'vue-lynx'
import WdIcon from '@wot-lynx/primitives/wd-icon'
import WdOverlay from '@wot-lynx/primitives/wd-overlay'
import { videoPreviewProps, type PreviewVideo, type VideoPreviewExpose, type VideoPreviewOptions } from './types'
import { getVideoPreviewOptionKey } from './api'
import { isDef, isFunction, uuid } from '@wot-lynx/core/common/util'
import { invokeNative } from '@wot-lynx/core/common/native'
import { getPlatform } from '@wot-lynx/core/common/platform'
import { useAlive } from '@wot-lynx/core/composables/useAlive'

const props = defineProps(videoPreviewProps)
const emit = defineEmits<{ open: []; close: []; tap: [event: any] }>()
const isAlive = useAlive()
const instance = getCurrentInstance()!
let disposed = false
let videoRequest = 0
let commandRequest = 0
let mountedVideoId = ''
const state = reactive({ show: false, visible: false, playing: false, hasFrame: false, error: '' })
const pendingPlay = ref<boolean | null>(null)
const previewVideo = reactive<PreviewVideo>({ url: '', poster: '', title: '' })
const requestOptions = ref<Partial<VideoPreviewOptions>>({})
const mediaGeneration = ref(0)
const videoIdPrefix = `wd-video-preview-${uuid()}`
const videoId = computed(() => `${videoIdPrefix}-${mediaGeneration.value}`)
const videoPreviewOption = inject(getVideoPreviewOptionKey(props.selector), ref<Partial<VideoPreviewOptions>>({}))
const options = computed(() => {
  const overrides = Object.fromEntries(Object.entries(requestOptions.value).filter(([, value]) => isDef(value)))
  return { ...props, ...overrides } as typeof props & Partial<VideoPreviewOptions>
})
// 能力 getter 不是响应式依赖，不能包进无依赖的 computed 永久缓存。
// 每次渲染/打开/操作重新读，后注册或撤销的宿主能力才能生效。
function canPlayVideo() {
  return getPlatform().capabilities.videoElement
}
const videoClass = computed(() => ['wd-video-preview__video', options.value.fullScreen ? 'is-fullscreen' : ''])
const closeClass = computed(() => ['wd-video-preview__close', `is-${options.value.closePosition}`])

function isLive() {
  return !disposed && isAlive()
}

function stopPlayer() {
  const id = mountedVideoId
  mountedVideoId = ''
  if (id && canPlayVideo()) invokeNative(`#${id}`, 'stop')
}

function reset(option: Partial<VideoPreviewOptions>) {
  if (!isLive()) return
  if (!option.show) {
    close()
    return
  }
  ++videoRequest
  ++commandRequest
  stopPlayer()
  ++mediaGeneration.value
  state.playing = false
  state.hasFrame = false
  state.error = ''
  pendingPlay.value = null
  requestOptions.value = { ...option }
  previewVideo.url = option.url || ''
  previewVideo.poster = option.poster || ''
  previewVideo.title = option.title || ''
  state.show = true
  // 正在展示或退场中重开时，没有必要等下一次 enter；preparePlayer 会去重。
  if (state.visible) preparePlayer()
}

watch(() => state.show, (show, previous) => {
  if (!isLive() || show === previous) return
  if (show) emit('open')
  else emit('close')
  const raw = instance.vnode.props || {}
  const name = show ? 'onOpen' : 'onClose'
  const callback = requestOptions.value[name] || raw[show ? 'on-open' : 'on-close']
  if (isFunction(callback) && callback !== raw[name]) callback()
})
watch(() => videoPreviewOption.value, reset, { deep: true, immediate: true })

function handleEnter() {
  if (!isLive() || !state.show) return
  state.visible = true
  preparePlayer()
}
function preparePlayer() {
  const request = videoRequest
  nextTick(() => {
    if (!isLive() || !state.show || !state.visible || !previewVideo.url || request !== videoRequest || !canPlayVideo()) return
    if (mountedVideoId === videoId.value) return
    mountedVideoId = videoId.value
    if (options.value.fullScreen) requestPlayback(true)
  })
}

function reportFailure(result: any, play = true) {
  pendingPlay.value = null
  const detail = result?.detail || result
  const reason = detail?.errorMsg || detail?.msg || detail?.data
  state.error = `${play ? '视频播放' : '暂停'}失败，请点击重试${typeof reason === 'string' && reason ? `：${reason}` : ''}`
}

function requestPlayback(play: boolean) {
  if (!isLive() || !state.show || !state.visible || !mountedVideoId || !canPlayVideo()) return
  const request = videoRequest
  const command = ++commandRequest
  const isCurrent = () => isLive() && state.show && request === videoRequest && command === commandRequest
  state.error = ''
  pendingPlay.value = play
  const fail = (result?: any) => {
    if (isCurrent()) reportFailure(result, play)
  }
  const invoked = invokeNative(`#${mountedVideoId}`, play ? 'play' : 'pause', undefined, {
    // 原生某些平台通过 success 回传 { success: false }，同样是失败。
    success: (result) => { if (result?.success === false) fail(result) },
    fail
  })
  if (!invoked) fail()
}

function togglePlay() {
  requestPlayback(!(pendingPlay.value ?? state.playing))
}

// 事件闭包绑定媒体代次，而非复用读取“当前 src”的函数，防止旧媒体事件污染新片。
const videoEvents = computed(() => {
  const generation = mediaGeneration.value
  const isCurrent = () => isLive() && state.show && generation === mediaGeneration.value
  const paused = () => {
    if (!isCurrent()) return
    state.playing = false
    pendingPlay.value = null
  }
  return {
    firstframe: () => {
      if (isCurrent()) state.hasFrame = true
    },
    playing: () => {
      if (!isCurrent()) return
      state.playing = true
      pendingPlay.value = null
      state.error = ''
    },
    paused,
    ended: paused,
    stopped: paused,
    error: (event: any) => {
      if (!isCurrent()) return
      ++commandRequest
      state.playing = false
      state.hasFrame = false
      reportFailure(event)
    }
  }
})

function handleAfterLeave() {
  if (!isLive() || state.show) return
  state.visible = false
  state.playing = false
  state.hasFrame = false
  state.error = ''
  previewVideo.url = ''
  previewVideo.poster = ''
  previewVideo.title = ''
}

function close() {
  if (!isLive()) return
  ++videoRequest
  ++commandRequest
  stopPlayer()
  pendingPlay.value = null
  state.playing = false
  state.show = false
}

function open(video: VideoPreviewOptions) {
  reset({ ...video, show: true })
}

onBeforeUnmount(() => {
  disposed = true
  ++videoRequest
  ++commandRequest
  stopPlayer()
})

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
        v-if="state.visible && previewVideo.url && canPlayVideo()"
        :key="videoId"
        :id="videoId"
        class="wd-video-preview__video-player"
        :src="previewVideo.url"
        object-fit="contain"
        mode="latest"
        @firstframe="videoEvents.firstframe"
        @playing="videoEvents.playing"
        @paused="videoEvents.paused"
        @ended="videoEvents.ended"
        @stopped="videoEvents.stopped"
        @error="videoEvents.error"
      />
      <!-- video 没有 poster 属性；首帧抵达后撤封面，不能一直遮着视频。 -->
      <image v-if="previewVideo.poster && !state.hasFrame && canPlayVideo()" class="wd-video-preview__poster" :src="previewVideo.poster" />
      <view
        v-if="state.visible && previewVideo.url && canPlayVideo()"
        :class="['wd-video-preview__control', { 'is-playing': state.playing }]"
        :accessibility-label="state.playing ? '暂停视频' : '播放视频'"
        @tap.stop="togglePlay"
      >
        <WdIcon :name="state.playing ? 'pause' : 'play'" custom-class="wd-video-preview__control-icon" />
      </view>
      <view v-if="state.visible && (!previewVideo.url || !canPlayVideo())" class="wd-video-preview__fallback">
        <image v-if="previewVideo.poster" class="wd-video-preview__fallback-poster" :src="previewVideo.poster" />
        <view class="wd-video-preview__fallback-hint">
          <text class="wd-video-preview__fallback-text">{{ previewVideo.url ? '当前宿主不支持视频播放，请使用支持 video 的 Lynx 4.1+ 宿主或接入兼容的原生播放器' : '未提供视频地址' }}</text>
        </view>
      </view>
      <text v-if="state.error" class="wd-video-preview__error" :user-interaction-enabled="false">{{ state.error }}</text>
      <text v-if="previewVideo.title" class="wd-video-preview__title" :user-interaction-enabled="false">{{ previewVideo.title }}</text>
    </view>
    <view :class="closeClass" @tap.stop="close">
      <WdIcon name="close" custom-class="wd-video-preview__close-icon" />
    </view>
  </WdOverlay>
</template>
