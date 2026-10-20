import type { ExtractPropTypes } from 'vue-lynx'
import { baseProps, makeArrayProp, makeBooleanProp, makeNumberProp, makeStringProp } from '../../common/props'

/**
 * 分享选项
 */
export type ShareOption = {
  /**
   * 图标名称（内置图标名或图片 URL）
   */
  icon: string
  /**
   * 显示文本
   */
  name: string
  /**
   * 是否禁用
   * 默认: false
   */
  disabled?: boolean
}

export const shareSheetProps = {
  ...baseProps,
  /**
   * 是否显示分享面板
   * 类型: boolean
   * 默认值: false
   */
  modelValue: makeBooleanProp(false),
  /**
   * 分享选项列表
   * 类型: ShareOption[]
   * 默认值: []
   */
  options: makeArrayProp<ShareOption>(),
  /**
   * 标题
   * 类型: string
   * 默认值: ''
   */
  title: makeStringProp(''),
  /**
   * 取消按钮文案
   * 类型: string
   * 默认值: '取消'
   */
  cancelText: makeStringProp('取消'),
  /**
   * 点击遮罩是否关闭
   * 类型: boolean
   * 默认值: true
   */
  closeOnClickModal: makeBooleanProp(true),
  /**
   * 弹层动画持续时间
   * 类型: number
   * 默认值: 200
   */
  duration: makeNumberProp(200),
  /**
   * 菜单层级
   * 类型: number
   * 默认值: 10
   */
  zIndex: makeNumberProp(10),
  /**
   * 是否设置底部安全距离
   * 类型: boolean
   * 默认值: true
   */
  safeAreaInsetBottom: makeBooleanProp(true)
}

export type ShareSheetProps = ExtractPropTypes<typeof shareSheetProps>
