import type { ExtractPropTypes, PropType } from 'vue-lynx'
import { baseProps, makeBooleanProp, makeNumberProp, makeStringProp } from '../../common/props'

export type KeyboardMode = 'default' | 'custom' | 'car'

export type KeyType = '' | 'delete' | 'extra' | 'close'

export type CarKeyboardLang = 'zh' | 'en'

export interface Key {
  text: string | number
  type?: KeyType
  wider?: boolean
}

export const keyboardProps = {
  ...baseProps,
  /**
   * 是否显示键盘
   */
  visible: makeBooleanProp(false),
  /**
   * 当前输入值
   */
  modelValue: makeStringProp(''),
  /**
   * 标题
   */
  title: String,
  /**
   * 键盘模式
   */
  mode: makeStringProp<KeyboardMode>('default'),
  /**
   * 层级
   */
  zIndex: makeNumberProp(100),
  /**
   * 最大输入长度
   */
  maxlength: makeNumberProp(Infinity),
  /**
   * 是否显示删除键
   */
  showDeleteKey: makeBooleanProp(true),
  /**
   * 是否随机键盘顺序
   */
  randomKeyOrder: makeBooleanProp(false),
  /**
   * 关闭按钮文字
   */
  closeText: String,
  /**
   * 删除按钮文字
   */
  deleteText: String,
  /**
   * 关闭按钮加载态
   */
  closeButtonLoading: makeBooleanProp(false),
  /**
   * 是否显示遮罩
   */
  modal: makeBooleanProp(false),
  /**
   * 点击遮罩是否关闭
   */
  hideOnClickOutside: makeBooleanProp(true),
  /**
   * 是否锁定滚动
   */
  lockScroll: makeBooleanProp(true),
  /**
   * 底部安全区适配
   */
  safeAreaInsetBottom: makeBooleanProp(true),
  /**
   * 额外按键
   */
  extraKey: [String, Array] as PropType<string | Array<string>>,
  /**
   * 是否挂载到根节点
   */
  rootPortal: makeBooleanProp(false),
  /**
   * 车牌键盘语言
   */
  carLang: String as PropType<CarKeyboardLang>,
  /**
   * 车牌键盘是否自动切换语言
   */
  autoSwitchLang: makeBooleanProp(false)
}

export type KeyboardProps = ExtractPropTypes<typeof keyboardProps>
