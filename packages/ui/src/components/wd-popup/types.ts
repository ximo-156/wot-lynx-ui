import type { ExtractPropTypes, PropType } from 'vue-lynx'
import { baseProps, makeBooleanProp, makeNumberProp, makeStringProp } from '../../common/props'
import type { TransitionName } from '../wd-transition/types'

export type PopupType = 'center' | 'top' | 'bottom' | 'left' | 'right'

export const popupProps = {
  ...baseProps,
  /**
   * 过渡动画名称
   */
  transition: String as PropType<TransitionName>,
  /**
   * 是否显示关闭按钮
   */
  closable: makeBooleanProp(false),
  /**
   * 弹出位置
   */
  position: makeStringProp<PopupType>('center'),
  /**
   * 点击遮罩是否关闭
   */
  closeOnClickModal: makeBooleanProp(true),
  /**
   * 动画时长（ms）
   */
  duration: {
    type: [Object, Number, Boolean] as PropType<Record<string, number> | number | boolean>,
    default: 300
  },
  /**
   * 是否显示遮罩
   */
  modal: makeBooleanProp(true),
  /**
   * 层级
   */
  zIndex: makeNumberProp(10),
  /**
   * 关闭时是否销毁内容
   */
  hideWhenClose: makeBooleanProp(true),
  /**
   * 遮罩自定义样式
   */
  modalStyle: makeStringProp(''),
  /**
   * 底部安全区适配
   */
  safeAreaInsetBottom: makeBooleanProp(false),
  /**
   * 是否显示
   */
  modelValue: makeBooleanProp(false),
  /**
   * 内容懒渲染
   */
  lazyRender: makeBooleanProp(true),
  /**
   * 是否锁定滚动
   */
  lockScroll: makeBooleanProp(true),
  /**
   * 是否挂载到根节点（fixed 提升 + 主题镜像）
   */
  rootPortal: makeBooleanProp(false),
  /**
   * 是否圆角
   */
  round: makeBooleanProp(false)
}

export type PopupProps = ExtractPropTypes<typeof popupProps>
