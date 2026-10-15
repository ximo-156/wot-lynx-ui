import type { ExtractPropTypes, PropType } from 'vue-lynx'
import { baseProps, makeArrayProp, makeBooleanProp, makeNumberProp, makeRequiredProp, makeStringProp, numericProp } from '../../common/props'

export interface CascaderOption {
  [key: string]: any
}

export type CascaderBeforeConfirm = (value: string | number | (string | number)[], selectedOptions: CascaderOption[]) => boolean | Promise<boolean>

export type CascaderLazyLoad = (
  node: CascaderOption | null,
  resolve: (children: CascaderOption[]) => void
) => void

export const cascaderProps = {
  ...baseProps,
  /**
   * 当前值
   */
  modelValue: makeRequiredProp([String, Number, Array] as PropType<string | number | (string | number)[]>),
  /**
   * 选项数据（树形）
   */
  options: makeArrayProp<CascaderOption>(),
  /**
   * 标题
   */
  title: String,
  /**
   * 确认前拦截
   */
  beforeConfirm: Function as PropType<CascaderBeforeConfirm>,
  /**
   * 是否允许选择任意一级
   */
  checkStrictly: makeBooleanProp(false),
  /**
   * 确认按钮文字
   */
  confirmText: makeStringProp(''),
  /**
   * 选项对象中 value 对应的 key
   */
  valueKey: makeStringProp('value'),
  /**
   * 选项对象中展示文本对应的 key
   */
  textKey: makeStringProp('text'),
  /**
   * 选项对象中 children 对应的 key
   */
  childrenKey: makeStringProp('children'),
  /**
   * 选项对象中提示对应的 key
   */
  tipKey: makeStringProp('tip'),
  /**
   * 点击遮罩是否关闭
   */
  closeOnClickModal: makeBooleanProp(true),
  /**
   * 层级
   */
  zIndex: makeNumberProp(15),
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
  visible: makeBooleanProp(false),
  /**
   * 懒加载
   */
  lazyLoad: Function as PropType<CascaderLazyLoad>,
  /**
   * 叶子节点标识 key
   */
  isLeafKey: makeStringProp('isLeaf'),
  /**
   * 选项高度
   */
  itemHeight: numericProp
}

export type CascaderProps = ExtractPropTypes<typeof cascaderProps>

export type CascaderExpose = {
  open: () => void
  close: () => void
}
