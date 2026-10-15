import type { ExtractPropTypes, PropType } from 'vue-lynx'
import { baseProps, makeBooleanProp, makeNumberProp, makeStringProp } from '../../common/props'

export type SwiperNavType = 'image' | 'icon'

export const swiperNavProps = {
  ...baseProps,
  /**
   * 导航项（图片或图标配置）
   */
  items: {
    type: Array as PropType<Record<string, any>[]>,
    default: () => []
  },
  /**
   * 是否滑动
   */
  navigation: makeBooleanProp(true),
  /**
   * 类型
   */
  type: makeStringProp<SwiperNavType>('image')
}

export type SwiperNavProps = ExtractPropTypes<typeof swiperNavProps>
