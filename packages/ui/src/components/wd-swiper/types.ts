import type { ExtractPropTypes, PropType } from 'vue-lynx'
import { baseProps, makeBooleanProp, makeNumberProp, makeNumericProp, makeStringProp } from '../../common/props'

export type DirectionType = 'horizontal' | 'vertical'

export type EasingType = 'default' | 'linear' | 'easeInCubic' | 'easeOutCubic' | 'easeInOutCubic'

export interface SwiperExpose {
  next: () => void
  prev: () => void
}

export const swiperProps = {
  ...baseProps,
  /**
   * 是否自动播放
   */
  autoplay: makeBooleanProp(true),
  /**
   * 当前索引
   */
  current: makeNumberProp(0),
  /**
   * 方向
   */
  direction: makeStringProp<DirectionType>('horizontal'),
  /**
   * 每屏显示数量
   */
  displayMultipleItems: makeNumberProp(1),
  /**
   * 滑动动画时长（ms）
   */
  duration: makeNumberProp(300),
  /**
   * 缓动函数
   */
  easingFunction: makeStringProp<EasingType>('default'),
  /**
   * 高度
   */
  height: makeNumericProp('192'),
  /**
   * 自动播放间隔（ms）
   */
  interval: makeNumberProp(5000),
  /**
   * 是否循环
   */
  circular: makeBooleanProp(true),
  /**
   * 是否显示指示点
   */
  indicatorDots: makeBooleanProp(false),
  /**
   * 指示点颜色
   */
  indicatorColor: String,
  /**
   * 指示点激活颜色
   */
  indicatorActiveColor: String,
  /**
   * 是否显示指示点（兼容别名）
   */
  showIndicator: makeBooleanProp(true),
  /**
   * 数据源（便捷模式）
   */
  list: {
    type: Array as PropType<Record<string, any>[]>,
    default: () => []
  }
}

export type SwiperProps = ExtractPropTypes<typeof swiperProps>
