/*
 * ⚠️ 本文件由 scripts/gen-index.mjs 自动生成，请勿手动编辑。
 *
 * L3.5 基础件的清单单一来源：src/primitives/ 下的目录（含 <dir>.vue 与 types.ts）。
 * 新增 / 删除组件后运行：pnpm gen:index
 */

import Badge from './wd-badge/wd-badge.vue'
import Button from './wd-button/wd-button.vue'
import Cell from './wd-cell/wd-cell.vue'
import Icon from './wd-icon/wd-icon.vue'
import Img from './wd-img/wd-img.vue'
import Input from './wd-input/wd-input.vue'
import Loading from './wd-loading/wd-loading.vue'
import Overlay from './wd-overlay/wd-overlay.vue'
import Popup from './wd-popup/wd-popup.vue'
import RootPortal from './wd-root-portal/wd-root-portal.vue'
import Textarea from './wd-textarea/wd-textarea.vue'
import Transition from './wd-transition/wd-transition.vue'

export {
  Badge,
  Button,
  Cell,
  Icon,
  Img,
  Input,
  Loading,
  Overlay,
  Popup,
  RootPortal,
  Textarea,
  Transition,
}

export type { BadgeProps } from './wd-badge/types'
export type { ButtonProps } from './wd-button/types'
export type { CellProps } from './wd-cell/types'
export type { IconProps } from './wd-icon/types'
export type { ImgProps } from './wd-img/types'
export type { InputProps } from './wd-input/types'
export type { LoadingProps } from './wd-loading/types'
export type { OverlayProps } from './wd-overlay/types'
export type { PopupProps } from './wd-popup/types'
export type { RootPortalProps } from './wd-root-portal/types'
export type { TextareaProps } from './wd-textarea/types'
export type { TransitionProps } from './wd-transition/types'

/** L3.5 基础件清单（供 createApp().use(wotLynxUI) 全局注册使用） */
export const allPrimitives = [
  Badge,
  Button,
  Cell,
  Icon,
  Img,
  Input,
  Loading,
  Overlay,
  Popup,
  RootPortal,
  Textarea,
  Transition,
]
