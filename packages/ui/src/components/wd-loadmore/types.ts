import type { ExtractPropTypes, PropType } from 'vue-lynx'
import { baseProps, makeStringProp } from '../../common/props'
import type { LoadingProps } from '../wd-loading/types'

export type LoadMoreState = 'loading' | 'error' | 'finished' | 'loading'

export const loadmoreProps = {
  ...baseProps,
  /**
   * 状态
   */
  state: makeStringProp<LoadMoreState>('loading'),
  /**
   * 加载中文字
   */
  loadingText: String,
  /**
   * 加载完成文字
   */
  finishedText: String,
  /**
   * 加载失败文字
   */
  errorText: String,
  /**
   * 加载配置
   */
  loadingProps: Object as PropType<Partial<LoadingProps>>
}

export type LoadmoreProps = ExtractPropTypes<typeof loadmoreProps>
