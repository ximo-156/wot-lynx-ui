import type { ExtractPropTypes, PropType } from 'vue-lynx'
import { baseProps, makeBooleanProp, makeStringProp } from '../../common/props'

export type SwipeActionStatus = 'left' | 'right' | 'close'

export type SwipeActionPosition = 'left' | 'right' | 'close' | 'both'

export type SwipeActionReason = 'click' | 'drag' | 'button'

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
