import { inject, provide, ref } from 'vue-lynx'
import type { ImagePreviewOptions } from './types'

const imagePreviewDefaultOptionKey = '__IMAGE_PREVIEW_OPTION__'
const None = Symbol('None')

const defaultOptions: ImagePreviewOptions = { images: [] }

export function useImagePreview(selector: string = '') {
  const key = getImagePreviewOptionKey(selector)
  const options = inject(key, ref<ImagePreviewOptions | typeof None>(None))
  if (options.value === None) {
    options.value = defaultOptions
    provide(key, options)
  }

  const previewImage = (option: ImagePreviewOptions) => {
    if (options.value !== None) {
      options.value = { ...option }
    }
  }

  const closeImagePreview = () => {
    if (options.value !== None) {
      options.value = { images: [] }
    }
  }

  return { previewImage, closeImagePreview }
}

export const getImagePreviewOptionKey = (selector: string) => {
  return selector ? `${imagePreviewDefaultOptionKey}${selector}` : imagePreviewDefaultOptionKey
}
