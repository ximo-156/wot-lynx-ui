import type { ExtractPropTypes, PropType } from 'vue-lynx'
import { baseProps, makeNumberProp, makeStringProp } from '../../common/props'

export type StepStatus = 'finished' | 'process' | 'wait' | 'error'

export const stepProps = {
  ...baseProps,
  /**
   * 标题
   */
  title: String,
  /**
   * 描述
   */
  description: String,
  /**
   * 图标
   */
  icon: String,
  /**
   * 状态
   */
  status: String as PropType<StepStatus>
}

export type StepProps = ExtractPropTypes<typeof stepProps>
