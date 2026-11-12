/*
 * ⚠️ 本文件由 scripts/gen-index.mjs 自动生成，请勿手动编辑。
 *
 * @wot-lynx/ui-layout（domain/layout）的清单单一来源：src/domain/ 下的目录（含 <dir>.vue 与 types.ts）。
 * 新增 / 删除组件后运行：pnpm gen:index
 */

import CellGroup from './wd-cell-group/wd-cell-group.vue'
import Col from './wd-col/wd-col.vue'
import Collapse from './wd-collapse/wd-collapse.vue'
import CollapseItem from './wd-collapse-item/wd-collapse-item.vue'
import Divider from './wd-divider/wd-divider.vue'
import Gap from './wd-gap/wd-gap.vue'
import Grid from './wd-grid/wd-grid.vue'
import GridItem from './wd-grid-item/wd-grid-item.vue'
import Resize from './wd-resize/wd-resize.vue'
import Row from './wd-row/wd-row.vue'

export {
  CellGroup,
  Col,
  Collapse,
  CollapseItem,
  Divider,
  Gap,
  Grid,
  GridItem,
  Resize,
  Row,
}

export type { CellGroupProps } from './wd-cell-group/types'
export type { ColProps } from './wd-col/types'
export type { CollapseProps } from './wd-collapse/types'
export type { CollapseItemProps } from './wd-collapse-item/types'
export type { DividerProps } from './wd-divider/types'
export type { GapProps } from './wd-gap/types'
export type { GridProps } from './wd-grid/types'
export type { GridItemProps } from './wd-grid-item/types'
export type { ResizeProps } from './wd-resize/types'
export type { RowProps } from './wd-row/types'

/** @wot-lynx/ui-layout（domain/layout）清单（供 createApp().use(wotLynxUI) 全局注册使用） */
export const allLayout = [
  CellGroup,
  Col,
  Collapse,
  CollapseItem,
  Divider,
  Gap,
  Grid,
  GridItem,
  Resize,
  Row,
]
