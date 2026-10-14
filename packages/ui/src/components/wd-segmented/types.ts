import type { ComponentPublicInstance, ExtractPropTypes, PropType } from 'vue-lynx'
import { baseProps, makeBooleanProp, makeRequiredProp, makeStringProp } from '../../common/props'

export type SegmentedTheme = 'card' | 'outline'

export interface SegmentedOption {
  /** 选项值 */
  value: string | number
  /** 是否禁用该选项 */
  disabled?: boolean
  /** 自定义数据，可用于插槽渲染 */
  payload?: any
}

export const segmentedProps = {
  ...baseProps,
  /**
   * 当前选中的值
   * 类型: string | number
   * 必需: 是
   */
  value: makeRequiredProp([String, Number]),
  /**
   * 是否禁用分段器
   * 类型: boolean
   * 默认值: false
   */
  disabled: makeBooleanProp(false),
  /**
   * 数据集合
   * 类型: string[] | number[] | SegmentedOption[]
   * 必需: 是
   * 默认值: []
   */
  options: {
    type: Array as PropType<string[] | number[] | SegmentedOption[]>,
    required: true,
    default: () => []
  },
  /**
   * 分段器主题样式
   * 类型: string
   * 可选值: 'card' | 'outline'
   * 默认值: 'card'
   */
  theme: makeStringProp<SegmentedTheme>('card'),
  /**
   * 切换选项时是否触发振动反馈
   * 类型: boolean
   * 默认值: false
   */
  vibrateShort: makeBooleanProp(false)
}

export type SegmentedExpose = {
  /**
   * 更新滑块偏移量和样式
   * @param animation 是否启用过渡动画，默认为 true
   */
  updateActiveStyle: (animation?: boolean) => void
}

export type SegmentedProps = ExtractPropTypes<typeof segmentedProps>

export type SegmentedInstance = ComponentPublicInstance<SegmentedProps, SegmentedExpose>
