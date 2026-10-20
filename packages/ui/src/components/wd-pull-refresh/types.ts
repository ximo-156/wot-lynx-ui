import type { ExtractPropTypes } from 'vue-lynx'
import { baseProps, makeBooleanProp, makeNumberProp, makeStringProp } from '../../common/props'

export const pullRefreshProps = {
  ...baseProps,
  /**
   * 是否显示下拉刷新
   * 类型: boolean
   * 默认值: true
   */
  modelValue: makeBooleanProp(false),
  /**
   * 刷新文案
   * 类型: string
   * 默认值: '下拉刷新'
   */
  pullingText: makeStringProp('下拉刷新'),
  /**
   * 松手刷新文案
   * 类型: string
   * 默认值: '释放更新'
   */
  loosingText: makeStringProp('释放更新'),
  /**
   * 加载中文案
   * 类型: string
   * 默认值: '正在刷新...'
   */
  loadingText: makeStringProp('正在刷新...'),
  /**
   * 刷新成功文案
   * 类型: string
   * 默认值: '刷新成功'
   */
  successText: makeStringProp('刷新成功'),
  /**
   * 下拉刷新成功显示时长
   * 类型: number
   * 默认值: 500
   */
  successDuration: makeNumberProp(500),
  /**
   * 动画时长
   * 类型: number
   * 默认值: 300
   */
  animationDuration: makeNumberProp(300),
  /**
   * 触发刷新的下拉距离阈值
   * 类型: number
   * 默认值: 50
   */
  headHeight: makeNumberProp(50),
  /**
   * 是否禁用下拉刷新
   * 类型: boolean
   * 默认值: false
   */
  disabled: makeBooleanProp(false)
}

export type PullRefreshProps = ExtractPropTypes<typeof pullRefreshProps>
