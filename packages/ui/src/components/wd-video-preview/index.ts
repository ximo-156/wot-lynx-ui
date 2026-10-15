import { inject, provide, ref, type Ref } from 'vue-lynx'
import type { VideoPreviewOptions } from './types'

const videoPreviewDefaultOptionKey = '__VIDEO_PREVIEW_OPTION__'
const None = Symbol('None')

const defaultOptions: VideoPreviewOptions = { url: '' }

export function useVideoPreview(selector: string = '') {
  const key = getVideoPreviewOptionKey(selector)
  const options = inject(key, ref<VideoPreviewOptions | typeof None>(None))
  if (options.value === None) {
    options.value = defaultOptions
    provide(key, options)
  }
  const currentOptions = options as Ref<VideoPreviewOptions>

  const previewVideo = (option: VideoPreviewOptions) => {
    currentOptions.value = { ...option }
  }

  const closeVideoPreview = () => {
    currentOptions.value = { url: '' }
  }

  return { previewVideo, closeVideoPreview, currentOptions }
}

export const getVideoPreviewOptionKey = (selector: string) => {
  return selector ? `${videoPreviewDefaultOptionKey}${selector}` : videoPreviewDefaultOptionKey
}
