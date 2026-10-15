import type { ExtractPropTypes, InjectionKey } from 'vue-lynx'
import { baseProps, makeBooleanProp, makeNumberProp, makeStringProp } from '../../common/props'
import { ref } from 'vue-lynx'

export type DropDirection = 'up' | 'down'

export type DropMenuProvide = {
  props: Record<string, any>
  offset: ReturnType<typeof ref<number>>
  fold: (child?: any) => void
}

export const DROP_MENU_KEY: InjectionKey<DropMenuProvide> = Symbol('wd-drop-menu')

export const dropMenuProps = {
  ...baseProps,
  /**
   * 层级
   */
  zIndex: makeNumberProp(12),
  /**
   * 展开方向
   */
  direction: makeStringProp<DropDirection>('down'),
  /**
   * 是否显示遮罩
   */
  modal: makeBooleanProp(true),
  /**
   * 点击遮罩是否关闭
   */
  closeOnClickModal: makeBooleanProp(true),
  /**
   * 动画时长（ms）
   */
  duration: makeNumberProp(200)
}

export type DropMenuProps = ExtractPropTypes<typeof dropMenuProps>
