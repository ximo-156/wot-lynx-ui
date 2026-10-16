import type { ExtractPropTypes, PropType } from 'vue-lynx'
import { baseProps, makeStringProp } from '../../common/props'

export type SwiperNavType = 'image' | 'icon'

/**
 * 注意：本组件与 wot-ui 的 wd-swiper-nav **API 完全不同**。
 *
 * wot-ui 的 swiper-nav 是**轮播指示器**（dots / dots-bar / fraction，配合
 * wd-swiper 使用，props 为 current / total / type / indicatorPosition …）；
 * 本库的 wd-swiper-nav 是**图标 / 图片横向导航**（scroll-view 承载一排
 * 导航项，点击某一项联动外部轮播），props 为 items / type，事件为
 * click（{ index, item }）。二者仅组件名相同，请勿按 wot-ui 的 API 使用。
 *
 * 另：wot-ui swiper-nav 的 navigation / change 等成员在本组件中不存在
 * （本组件为图标横向导航，无轮播指示器语义），已从定义中删除。
 */
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
   * 类型
   */
  type: makeStringProp<SwiperNavType>('image')
}

export type SwiperNavProps = ExtractPropTypes<typeof swiperNavProps>
