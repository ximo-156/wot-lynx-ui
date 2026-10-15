import type { ExtractPropTypes } from 'vue-lynx'
import { baseProps, makeBooleanProp, makeNumberProp, makeRequiredProp, makeStringProp } from '../../common/props'

export const countDownProps = {
  ...baseProps,
  /**
   * 倒计时时长（ms）
   */
  time: makeRequiredProp(Number),
  /**
   * 是否显示毫秒
   */
  millisecond: makeBooleanProp(false),
  /**
   * 时间格式
   */
  format: makeStringProp('HH:mm:ss'),
  /**
   * 是否自动开始
   */
  autoStart: makeBooleanProp(true)
}

export type CountDownProps = ExtractPropTypes<typeof countDownProps>

export type CountDownExpose = {
  start: () => void
  pause: () => void
  reset: () => void
}
