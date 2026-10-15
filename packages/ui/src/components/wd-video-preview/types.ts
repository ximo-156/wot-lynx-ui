import type { ExtractPropTypes, PropType } from 'vue-lynx'
import { baseProps, makeBooleanProp, makeNumberProp, makeStringProp } from '../../common/props'

export type VideoPreviewClosePosition = 'left-top' | 'right-top' | 'left-bottom' | 'right-bottom'

export interface VideoPreviewOptions {
  url: string
  poster?: string
  title?: string
}

export interface VideoPreviewExpose {
  open: (video: VideoPreviewOptions) => void
  close: () => void
}

export const videoPreviewProps = {
  ...baseProps,
  /**
   * 选择器（区分多实例）
   */
  selector: makeStringProp(''),
  /**
   * 层级
   */
  zIndex: makeNumberProp(1000),
  /**
   * 是否全屏
   */
  fullScreen: makeBooleanProp(false),
  /**
   * 关闭按钮位置
   */
  closePosition: makeStringProp<VideoPreviewClosePosition>('left-top'),
  /**
   * 打开回调
   */
  onOpen: Function as PropType<() => void>,
  /**
   * 关闭回调
   */
  onClose: Function as PropType<() => void>
}

export type VideoPreviewProps = ExtractPropTypes<typeof videoPreviewProps>
