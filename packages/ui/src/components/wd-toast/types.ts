import type { ExtractPropTypes, PropType } from 'vue-lynx'
import { baseProps, makeBooleanProp, makeNumberProp, makeStringProp } from '../../common/props'
import type { LoadingType } from '../wd-loading/types'

export type ToastIconType = 'success' | 'error' | 'warning' | 'loading' | 'info' // 图标类型
export type ToastPositionType = 'top' | 'middle-top' | 'middle' | 'bottom' // 提示信息框的位置类型
export type ToastDirection = 'vertical' | 'horizontal' // 提示信息框的排列方向
export type ToastLoadingType = LoadingType // 提示信息加载状态类型

export type ToastOptions = {
  msg?: string
  duration?: number
  direction?: ToastDirection
  iconName?: ToastIconType
  iconSize?: number
  loadingType?: ToastLoadingType
  loadingColor?: string
  loadingSize?: number
  iconColor?: string
  position?: ToastPositionType
  show?: boolean
  zIndex?: number
  /**
   * 是否存在遮罩层
   */
  cover?: boolean
  /**
   * 图标类名
   */
  iconClass?: string
  /**
   * 类名前缀，用于使用自定义图标
   */
  classPrefix?: string
  /**
   * CSS 图标
   */
  cssIcon?: boolean | string
  /**
   * 完全展示后的回调函数
   */
  opened?: () => void
  /**
   * 完全关闭时的回调函数
   */
  closed?: () => void
}

export interface Toast {
  // 打开Toast
  show(toastOptions: ToastOptions | string): void
  // 成功提示
  success(toastOptions: ToastOptions | string): void
  // 关闭提示
  error(toastOptions: ToastOptions | string): void
  // 常规提示
  info(toastOptions: ToastOptions | string): void
  // 警告提示
  warning(toastOptions: ToastOptions | string): void
  // 加载提示
  loading(toastOptions: ToastOptions | string): void
  // 关闭Toast
  close(): void
}

export const toastProps = {
  ...baseProps,
  /**
   * 选择器，用于区分多个 toast 实例
   */
  selector: makeStringProp(''),
  /**
   * 消息内容
   */
  msg: makeStringProp(''),
  /**
   * 排列方向
   */
  direction: makeStringProp<ToastDirection>('horizontal'),
  /**
   * 图标类型
   */
  iconName: makeStringProp<ToastIconType | ''>(''),
  /**
   * 图标大小
   */
  iconSize: Number,
  /**
   * 加载类型
   */
  loadingType: makeStringProp<ToastLoadingType>('circular'),
  /**
   * 加载颜色
   */
  loadingColor: makeStringProp('#ffffff'),
  /**
   * 加载大小
   */
  loadingSize: Number,
  /**
   * 图标颜色
   */
  iconColor: String,
  /**
   * 位置
   */
  position: makeStringProp<ToastPositionType>('middle'),
  /**
   * 层级
   */
  zIndex: makeNumberProp(100),
  /**
   * 是否存在遮罩层
   */
  cover: makeBooleanProp(false),
  /**
   * 图标类名
   */
  iconClass: makeStringProp(''),
  /**
   * 图标类名前缀
   */
  classPrefix: makeStringProp('wd-icon'),
  /**
   * CSS 图标
   */
  cssIcon: {
    type: [Boolean, String],
    default: false
  },
  /**
   * 完全展示后的回调
   */
  opened: Function as PropType<() => void>,
  /**
   * 完全关闭时的回调
   */
  closed: Function as PropType<() => void>
}

export type ToastProps = ExtractPropTypes<typeof toastProps>
