import type { ExtractPropTypes } from 'vue-lynx'
import { baseProps, makeArrayProp, makeBooleanProp, makeNumberProp, makeStringProp } from '../../common/props'

export interface Action {
  name: string
  color?: string
  disabled?: boolean
  loading?: boolean
  description?: string
}

export interface Panel {
  icon: string
  title: string
  color?: string
  disabled?: boolean
}

export const actionSheetProps = {
  ...baseProps,
  /**
   * 菜单项
   */
  actions: makeArrayProp<Action>(),
  /**
   * 面板菜单（支持分组）
   */
  panels: makeArrayProp<Panel | Panel[]>(),
  /**
   * 标题
   */
  title: String,
  /**
   * 标题自定义类名
   */
  customTitleClass: makeStringProp(''),
  /**
   * 取消按钮文字
   */
  cancelText: String,
  /**
   * 点击菜单项后是否关闭
   */
  closeOnClickAction: makeBooleanProp(true),
  /**
   * 点击遮罩是否关闭
   */
  closeOnClickModal: makeBooleanProp(true),
  /**
   * 动画时长（ms）
   */
  duration: makeNumberProp(200),
  /**
   * 层级
   */
  zIndex: makeNumberProp(10),
  /**
   * 内容懒渲染
   */
  lazyRender: makeBooleanProp(true),
  /**
   * 底部安全区适配
   */
  safeAreaInsetBottom: makeBooleanProp(true),
  /**
   * 是否挂载到根节点
   */
  rootPortal: makeBooleanProp(false),
  /**
   * 是否显示
   */
  modelValue: makeBooleanProp(false)
}

export type ActionSheetProps = ExtractPropTypes<typeof actionSheetProps>
