import type { ExtractPropTypes, PropType } from 'vue-lynx'
import { baseProps } from '../../common/props'
import type { LoadingProps } from '../wd-loading/types'

export type LoadMoreState = 'loading' | 'error' | 'finished'

export const loadmoreProps = {
  ...baseProps,
  /**
   * 状态（无默认值：不传时不渲染任何状态内容，与 wot-ui 一致）
   */
  state: String as PropType<LoadMoreState>,
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
