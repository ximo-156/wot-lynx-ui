/*
 * wd-image-preview — 命令式图片预览（useImagePreview）的选项注入与 Hook。
 *
 * 相对 wot-ui 2.3.2 的适配点：
 * - import 来源 'vue' → 'vue-lynx'；
 * - 参考源从 '../wd-swiper/types' 导入 SwiperItem，本地 wd-swiper/types 未
 *   导出该类型（共享层缺口，见交付报告），getImageUrl 的参数类型按语义等价
 *   的 `string | Record<string, any>` 声明；
 * - deepMerge / isArray / isString 复用本地 common/util（与参考源一致）。
 */
import { inject, provide, ref } from 'vue-lynx'
import type { ImagePreview, ImagePreviewOptions } from './types'
import { deepMerge, isArray, isString } from '../../common/util'

/**
 * useImagePreview 用到的 key
 */
const imagePreviewDefaultOptionKey = '__IMAGE_PREVIEW_OPTION__'

/**
 * 默认选项
 */
export const defaultOptions: ImagePreviewOptions = {
  images: [],
  startPosition: 0,
  showIndex: true,
  loop: true,
  closeable: true,
  closeIcon: 'close',
  closeIconPosition: 'top-right',
  closeOnClick: true,
  showMenuByLongpress: true,
  show: false,
  zIndex: 1000
}

const None = Symbol('None')

/**
 * 图片预览 Hook
 * @param selector 选择器，用于区分多个实例
 */
export function useImagePreview(selector: string = ''): ImagePreview {
  const imagePreviewOptionKey = getImagePreviewOptionKey(selector)
  const imagePreviewOption = inject(imagePreviewOptionKey, ref<ImagePreviewOptions | typeof None>(None))

  if (imagePreviewOption.value === None) {
    imagePreviewOption.value = defaultOptions
    provide(imagePreviewOptionKey, imagePreviewOption)
  }

  /**
   * 打开图片预览
   * @param options 预览选项或图片数组
   */
  const open = (options: ImagePreviewOptions | string[]) => {
    let mergedOptions: ImagePreviewOptions

    if (isArray(options)) {
      mergedOptions = deepMerge(defaultOptions, { images: options }) as ImagePreviewOptions
    } else {
      mergedOptions = deepMerge(defaultOptions, options) as ImagePreviewOptions
    }

    imagePreviewOption.value = deepMerge(mergedOptions, { show: true }) as ImagePreviewOptions
  }

  /**
   * 关闭图片预览
   */
  const close = () => {
    imagePreviewOption.value = { show: false }
  }

  return {
    previewImage: open,
    closeImagePreview: close
  }
}

/**
 * 获取图片预览选项的 key
 * @param selector 选择器
 */
export const getImagePreviewOptionKey = (selector: string) => {
  return selector ? `${imagePreviewDefaultOptionKey}${selector}` : imagePreviewDefaultOptionKey
}

/**
 * 获取图片 url
 * @param image 图片（url 字符串或轮播项对象）
 */
export function getImageUrl(image: string | Record<string, any>) {
  return isString(image) ? image : image.url
}
