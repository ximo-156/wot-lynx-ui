/*
 * ⚠️ 本文件由 scripts/gen-index.mjs 自动生成，请勿手动编辑。
 *
 * @wot-lynx/ui-feedback（domain/feedback）的清单单一来源：src/domain/ 下的目录（含 <dir>.vue 与 types.ts）。
 * 新增 / 删除组件后运行：pnpm gen:index
 */

import Curtain from './wd-curtain/wd-curtain.vue'
import Dialog from './wd-dialog/wd-dialog.vue'
import FloatingPanel from './wd-floating-panel/wd-floating-panel.vue'
import Notify from './wd-notify/wd-notify.vue'
import Popover from './wd-popover/wd-popover.vue'
import ShareSheet from './wd-share-sheet/wd-share-sheet.vue'
import SwipeAction from './wd-swipe-action/wd-swipe-action.vue'
import Tooltip from './wd-tooltip/wd-tooltip.vue'
import Tour from './wd-tour/wd-tour.vue'

export {
  Curtain,
  Dialog,
  FloatingPanel,
  Notify,
  Popover,
  ShareSheet,
  SwipeAction,
  Tooltip,
  Tour,
}

export type { CurtainProps } from './wd-curtain/types'
export type { DialogProps } from './wd-dialog/types'
export type { FloatingPanelProps } from './wd-floating-panel/types'
export type { NotifyProps } from './wd-notify/types'
export type { PopoverProps } from './wd-popover/types'
export type { ShareSheetProps } from './wd-share-sheet/types'
export type { SwipeActionProps } from './wd-swipe-action/types'
export type { TooltipProps } from './wd-tooltip/types'
export type { TourProps } from './wd-tour/types'

/** @wot-lynx/ui-feedback（domain/feedback）清单（供 createApp().use(wotLynxUI) 全局注册使用） */
export const allFeedback = [
  Curtain,
  Dialog,
  FloatingPanel,
  Notify,
  Popover,
  ShareSheet,
  SwipeAction,
  Tooltip,
  Tour,
]
