/*
 * wd-video-preview — 视频预览
 *
 * Lynx 实现说明（相对 wot-ui 2.3.2 的适配点）：
 * - 条件编译：参考源用 #ifdef APP-PLUS / #ifndef APP-PLUS 区分 App 端
 *   （view 直挂 + 系统全屏）与其它端（wd-overlay）两套模板，Lynx 无 App
 *   nvue 语义，统一保留 overlay 分支，条件编译残留已清除（PORTING §3.6）；
 *   App 专有的 createVideoContext / requestFullScreen 调用随之移除。
 * - 事件映射：@click → @tap（CONVENTIONS §6，Lynx view 不派发 click）：
 *   overlay 上的 @click 保留（WdOverlay 把 transition 根 view 的引擎原生 tap
 *   重新 emit 为 click / tap 双轨，click 保持 wot-ui API 对齐）；视频容器
 *   view 的 @click.stop="" 占位改写为 @tap.stop="noop"（阻止冒泡触发关闭）；
 *   closeClass 中的 is-{closePosition} 状态类与参考源一致。
 * - 根链为 wd-overlay（→ wd-transition 根 view），overlay 已声明并转发
 *   tap / click，消费方绑 @tap / @click 不会穿透合并（CONVENTIONS §14）。
 * - video 元素属性 controls / poster / title / play-btn-position /
 *   enableNative / enable-progress-gesture 按参考源逐属性保留，其中
 *   uni-app 专有属性在 Lynx 上不生效（PORTING §2.3）。
 * - 过渡回调（enter / after-leave）加 isAlive 守卫，防止卸载后晚到写入。
 */
<script lang="ts" setup>
import './index.css'

import { computed, inject, reactive, ref, watch } from 'vue-lynx'
import WdIcon from '../wd-icon/wd-icon.vue'
import WdOverlay from '../wd-overlay/wd-overlay.vue'
import { videoPreviewProps, type PreviewVideo, type VideoPreviewExpose, type VideoPreviewOptions } from './types'
import { defaultOptions, getVideoPreviewOptionKey } from './index'
import { isDef, isFunction, uuid } from '../../common/util'
import { useAlive } from '../../composables/useAlive'

const props = defineProps(videoPreviewProps)

const emit = defineEmits<{
  open: []
  close: []
}>()

const state = reactive({
  show: false,
  visible: false
})

const previewVideo = reactive<PreviewVideo>({ url: '', poster: '', title: '' })
const fullScreenValue = ref<boolean | undefined>()
const closePositionValue = ref<VideoPreviewOptions['closePosition']>()

// 视频元素唯一 id（参考源用于 App 端创建 video 上下文，Lynx 保留唯一性）
const videoId = `wd-video-preview-${uuid()}`

// 获取注入的选项
const videoPreviewOptionKey = getVideoPreviewOptionKey(props.selector)
const videoPreviewOption = inject(videoPreviewOptionKey, ref<VideoPreviewOptions>(defaultOptions))

const options = computed(() => ({
  zIndex: isDef(videoPreviewOption.value.zIndex) ? videoPreviewOption.value.zIndex! : props.zIndex,
  onOpen: videoPreviewOption.value.onOpen || props.onOpen || null,
  onClose: videoPreviewOption.value.onClose || props.onClose || null
}))

const isFullScreen = computed(() => {
  const optionFullScreen = videoPreviewOption.value.fullScreen
  if (isDef(optionFullScreen)) return optionFullScreen!
  return isDef(fullScreenValue.value) ? fullScreenValue.value! : props.fullScreen
})

const closePosition = computed(() => {
  const optionClosePosition = videoPreviewOption.value.closePosition
  if (isDef(optionClosePosition)) return optionClosePosition!
  return isDef(closePositionValue.value) ? closePositionValue.value! : props.closePosition
})

const videoClass = computed(() => ['wd-video-preview__video', isFullScreen.value ? 'is-fullscreen' : ''])
const closeClass = computed(() => ['wd-video-preview__close', `is-${closePosition.value}`])

const isAlive = useAlive()

// 监听选项变化
watch(
  () => videoPreviewOption.value,
  (newVal: VideoPreviewOptions) => {
    if (!isAlive()) return
    reset(newVal)
  },
  { deep: true, immediate: true }
)

// 监听 show 变化，触发事件
watch(
  () => state.show,
  (newVal, oldVal) => {
    if (newVal && !oldVal) {
      emit('open')
      if (isFunction(options.value.onOpen)) {
        options.value.onOpen()
      }
    } else if (!newVal && oldVal) {
      emit('close')
      if (isFunction(options.value.onClose)) {
        options.value.onClose()
      }
    }
  }
)

function reset(option: VideoPreviewOptions) {
  state.show = isDef(option.show) ? option.show! : false
  if (state.show) {
    previewVideo.url = option.url
    previewVideo.poster = option.poster
    previewVideo.title = option.title
    fullScreenValue.value = option.fullScreen
    closePositionValue.value = option.closePosition
  }
}

function handleEnter() {
  // enter 链经 wd-transition 的帧定时器驱动，可能晚于卸载落地
  if (!isAlive()) return
  state.visible = true
}

function handleAfterLeave() {
  // leave 链落地时组件可能已卸载：晚到写入会触发真机 9902 家族问题
  if (!isAlive()) return
  state.visible = false
  previewVideo.url = ''
  previewVideo.poster = ''
  previewVideo.title = ''
}

// 监听原生全屏状态变化，全屏预览模式下退出全屏时关闭预览
function handleFullscreenChange(event: any) {
  if (isFullScreen.value && event && event.detail && !event.detail.fullScreen) {
    close()
  }
}

function close() {
  state.show = false
}

function open(video: VideoPreviewOptions) {
  previewVideo.url = video.url
  previewVideo.poster = video.poster
  previewVideo.title = video.title
  fullScreenValue.value = video.fullScreen
  closePositionValue.value = video.closePosition
  state.show = true
}

/** 视频容器 view 的 @tap.stop 占位（阻止冒泡触发 overlay 关闭） */
function noop() {}

defineExpose<VideoPreviewExpose>({
  open,
  close
})
</script>

<template>
  <WdOverlay
    :show="state.show"
    :z-index="options.zIndex"
    :lock-scroll="true"
    :custom-class="`wd-video-preview ${customClass}`"
    :custom-style="customStyle"
    @click="close"
    @enter="handleEnter"
    @after-leave="handleAfterLeave"
  >
    <view :class="videoClass" @tap.stop="noop">
      <video
        :id="videoId"
        class="wd-video-preview__video-player"
        v-if="state.visible && previewVideo.url"
        :controls="true"
        :poster="previewVideo.poster"
        :title="previewVideo.title"
        play-btn-position="center"
        :enableNative="true"
        :src="previewVideo.url"
        :enable-progress-gesture="false"
        @fullscreenchange="handleFullscreenChange"
      ></video>
    </view>
    <view :class="closeClass" @tap.stop="close">
      <WdIcon name="close" custom-class="wd-video-preview__close-icon" />
    </view>
  </WdOverlay>
</template>
