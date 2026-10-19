/**
 * 选择器类组件共享的数据契约。
 *
 * 为什么放在 common（L2）而不是组件目录（L4）：
 * `useSelection`（L3）是 picker / select-picker / cascader 的共同契约层，需要
 * `PickerOption` 这个类型；若类型定义在 `components/wd-picker-view/types.ts`，
 * L3 就必须反向 import L4，违反 INV-1（依赖方向单向，ARCHITECTURE §2.3）。
 *
 * 因此把「跨层共享的选项形状」下沉到 L2，组件侧 `types.ts` 再 re-export，
 * 保持对外类型名不变（`import type { PickerOption } from '../wd-picker-view/types'`
 * 依然可用）。
 */

/** 选择器选项：除 value/label/children 外允许携带任意业务字段 */
export type PickerOption = {
  [key: string]: any
}
