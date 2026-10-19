/*
 * wd-video-preview — 命令式视频预览（useVideoPreview）的选项注入与 Hook。
 *
 * 相对 wot-ui 2.3.2 的适配点：
 * - import 来源 'vue' → 'vue-lynx'；
 * - deepMerge 复用本地 common/util（与参考源一致）。
 */
import { inject, provide, ref } from 'vue-lynx'
import type { VideoPreview, VideoPreviewOptions, PreviewVideo } from './types'
import { deepMerge } from '../../common/util'

/**
 * useVideoPreview 用到的 key
 */
const videoPreviewDefaultOptionKey = '__VIDEO_PREVIEW_OPTION__'

/**
 * 默认选项
 */
export const defaultOptions: VideoPreviewOptions = {
  url: '',
  poster: '',
  title: '',
  show: false,
  zIndex: 1000
}

const None = Symbol('None')

/**
 * 视频预览 Hook
 * @param selector 选择器，用于区分多个实例
 */
export function useVideoPreview(selector: string = ''): VideoPreview {
  const videoPreviewOptionKey = getVideoPreviewOptionKey(selector)
  const videoPreviewOption = inject(videoPreviewOptionKey, ref<VideoPreviewOptions | typeof None>(None))

  if (videoPreviewOption.value === None) {
    videoPreviewOption.value = defaultOptions
    provide(videoPreviewOptionKey, videoPreviewOption)
  }

  /**
   * 打开视频预览
   * @param options 预览选项
   */
  const open = (options: VideoPreviewOptions | PreviewVideo) => {
    const mergedOptions = deepMerge(defaultOptions, options) as VideoPreviewOptions
    videoPreviewOption.value = deepMerge(mergedOptions, { show: true }) as VideoPreviewOptions
  }

  /**
   * 关闭视频预览
   */
  const close = () => {
    videoPreviewOption.value = { show: false } as VideoPreviewOptions
  }

  return {
    previewVideo: open,
    closeVideoPreview: close
  }
}

/**
 * 获取视频预览选项的 key
 * @param selector 选择器
 */
export const getVideoPreviewOptionKey = (selector: string) => {
  return selector ? `${videoPreviewDefaultOptionKey}${selector}` : videoPreviewDefaultOptionKey
}
