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

  // 暴露注入的 option ref：组件侧需 watch 它才能消费页面级
  // useImagePreview(selector).previewImage() 命令式调用（对齐 wd-notify）。
  return { previewImage, closeImagePreview, options }
}

export const getImagePreviewOptionKey = (selector: string) => {
  return selector ? `${imagePreviewDefaultOptionKey}${selector}` : imagePreviewDefaultOptionKey
}
