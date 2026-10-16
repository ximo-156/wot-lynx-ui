import type { ExtractPropTypes, PropType } from 'vue-lynx'
import { baseProps, makeBooleanProp, makeStringProp } from '../../common/props'

export type SwipeActionStatus = 'left' | 'right' | 'close'

/** 滑动/点击位置类型（'inside' 表示点击内容区域） */
export type SwipeActionPosition = SwipeActionStatus | 'inside'

/** 关闭原因：click=点击关闭 / swipe=滑动关闭 / value=外部改值关闭 */
export type SwipeActionReason = 'click' | 'swipe' | 'value'

export type SwipeActionBeforeClose = (reason: SwipeActionReason, position?: SwipeActionPosition) => boolean | Promise<boolean>

export const swipeActionProps = {
  ...baseProps,
  /**
   * 当前状态（left / right / close）
   */
  modelValue: makeStringProp<SwipeActionStatus>('close'),
  /**
   * 是否禁用
   */
  disabled: makeBooleanProp(false),
  /**
   * 关闭前拦截
   */
  beforeClose: Function as PropType<SwipeActionBeforeClose>
}

export type SwipeActionProps = ExtractPropTypes<typeof swipeActionProps>
