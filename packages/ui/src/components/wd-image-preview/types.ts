import type { ExtractPropTypes, PropType } from 'vue-lynx'
import { baseProps, makeBooleanProp, makeNumberProp, makeStringProp } from '../../common/props'

export type ImagePreviewCloseIconPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'

export interface ImagePreviewOptions {
  images: string[]
  startPosition?: number
  showIndex?: boolean
  loop?: boolean
  closeable?: boolean
  closeIcon?: string
  closeIconPosition?: ImagePreviewCloseIconPosition
  showMenuByLongpress?: boolean
}

export interface ImagePreviewExpose {
  open: (options: ImagePreviewOptions) => void
  close: () => void
}

export const imagePreviewProps = {
  ...baseProps,
  /**
   * 选择器（区分多实例）
   */
  selector: makeStringProp(''),
  /**
   * 图片列表
   */
  images: {
    type: Array as PropType<string[]>,
    default: () => []
  },
  /**
   * 初始索引
   */
  startPosition: makeNumberProp(0),
  /**
   * 是否显示索引
   */
  showIndex: makeBooleanProp(true),
  /**
   * 是否循环
   */
  loop: makeBooleanProp(true),
  /**
   * 是否可关闭
   */
  closeable: makeBooleanProp(true),
  /**
   * 关闭图标
   */
  closeIcon: makeStringProp('close'),
  /**
   * 关闭图标位置
   */
  closeIconPosition: makeStringProp<ImagePreviewCloseIconPosition>('top-right'),
  /**
   * 长按是否显示菜单
   */
  showMenuByLongpress: makeBooleanProp(false)
}

export type ImagePreviewProps = ExtractPropTypes<typeof imagePreviewProps>
