import type { ExtractPropTypes, PropType } from 'vue-lynx'
import { baseProps, makeBooleanProp, makeStringProp } from '../../common/props'

export type TransitionName =
  | 'fade'
  | 'fade-down'
  | 'fade-left'
  | 'fade-right'
  | 'fade-up'
  | 'slide-down'
  | 'slide-left'
  | 'slide-right'
  | 'slide-up'
  | 'zoom-in'
  | 'zoom-out'

export const transitionProps = {
  ...baseProps,
  /**
   * 是否展示组件
   * 类型: boolean
   * 默认值: false
   */
  show: makeBooleanProp(false),
  /**
   * 动画执行时间，单位毫秒
   * 类型: Record<string, number> | number | boolean
   * 默认值: 300
   */
  duration: {
    type: [Object, Number, Boolean] as PropType<Record<string, number> | number | boolean>,
    default: 300
  },
  /**
   * 弹层内容懒渲染，触发展示时才渲染内容
   * 类型: boolean
   * 默认值: false
   *
   * destroy=true 时随 show 以 v-if 挂载，懒渲染天然成立；
   * destroy=false 时根视图常驻，内容在首次展示后才渲染（slot 门控）。
   */
  lazyRender: makeBooleanProp(false),
  /**
   * 动画类型
   * 类型: TransitionName | TransitionName[]
   * 可选值: 'fade' | 'fade-up' | 'fade-down' | 'fade-left' | 'fade-right' | 'slide-up' | 'slide-down' | 'slide-left' | 'slide-right' | 'zoom-in' | 'zoom-out'
   * 默认值: 'fade'
   *
   * 数组形式仅取首个元素（底层框架 Transition 仅支持单 name）。
   */
  name: [String, Array] as PropType<TransitionName | TransitionName[]>,
  /**
   * 是否在动画结束时销毁子节点
   * 类型: boolean
   * 默认值: true
   *
   * true：leave 落地后子视图卸载（v-if 语义）；
   * false：子视图常驻，leave 落地后经 v-show 置 display:none。
   */
  destroy: makeBooleanProp(true),
  /**
   * 进入过渡的开始状态
   * 类型: string
   * 默认值: ''
   */
  enterClass: makeStringProp(''),
  /**
   * 进入过渡的激活状态
   * 类型: string
   * 默认值: ''
   */
  enterActiveClass: makeStringProp(''),
  /**
   * 进入过渡的结束状态
   * 类型: string
   * 默认值: ''
   */
  enterToClass: makeStringProp(''),
  /**
   * 离开过渡的开始状态
   * 类型: string
   * 默认值: ''
   */
  leaveClass: makeStringProp(''),
  /**
   * 离开过渡的激活状态
   * 类型: string
   * 默认值: ''
   */
  leaveActiveClass: makeStringProp(''),
  /**
   * 离开过渡的结束状态
   * 类型: string
   * 默认值: ''
   */
  leaveToClass: makeStringProp(''),
  /**
   * 是否阻止触摸滚动
   * 类型: boolean
   * 默认值: false
   */
  disableTouchMove: makeBooleanProp(false)
}

export type TransitionProps = ExtractPropTypes<typeof transitionProps>
