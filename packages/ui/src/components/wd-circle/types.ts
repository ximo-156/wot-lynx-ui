import type { ExtractPropTypes, PropType } from 'vue-lynx'
import { baseProps, makeBooleanProp, makeNumberProp, makeStringProp } from '../../common/props'
import { ORANGE } from '../../common/theme'

export type CircleColor = string | Record<string, string | number>

export const circleProps = {
  ...baseProps,
  /**
   * 当前值（百分比）
   */
  modelValue: makeNumberProp(0),
  /**
   * 尺寸（px）
   */
  size: makeNumberProp(120),
  /**
   * 进度颜色（对象时为 { 0: color, 100: color } 渐变配置）
   */
  color: {
    type: [String, Object] as PropType<CircleColor>,
    default: ORANGE[6]
  },
  /**
   * 轨道颜色
   */
  layerColor: makeStringProp('#E4E7ED'),
  /**
   * 填充色
   */
  fill: String,
  /**
   * 动画速度（越大越慢）
   */
  speed: makeNumberProp(50),
  /**
   * 文字
   */
  text: String,
  /**
   * 笔画宽度
   */
  strokeWidth: makeNumberProp(18),
  /**
   * 是否为逆时针
   */
  counterClockwise: makeBooleanProp(false)
}

export type CircleProps = ExtractPropTypes<typeof circleProps>
