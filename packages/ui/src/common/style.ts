/**
 * Style Funnel — 内联样式的唯一出口（CONVENTIONS §20）。
 *
 * ## 为什么需要它
 *
 * Lynx 的 `SET_STYLE` 经 BG `pushOp` → MT `__SetInlineStyles(el, value)` 下发，
 * 语义是**逐属性合并**（Object.assign）：新对象里**没有出现的键，不会清除**元素
 * 上已经应用的内联属性。
 *
 * 于是「条件写样式」成为本库最容易复发的缺陷类型——只要某个键在某一帧被省略，
 * 上一帧的值就会残留。仓库已为此付出 6 次代价：
 *
 *   - `wd-transition`：用「删键」表达 display 状态 → 元素永久 `display:none`，
 *     toast / 遮罩全不可见（2026-10-15 真机核实）；
 *   - `wd-swipe-action`：跟手时段未显式写 `transition: none` → 上次落位过渡残留，
 *     拖动不跟手；
 *   - `wd-segmented`：`if (left)` 为 0 时省略 transform → 选中首项滑块不归位；
 *   - `wd-picker-view`：同 transition 残留 → 首次拖动跟手、之后每次都不跟手；
 *   - `wd-toast`：position 由 top 切 bottom 时 `top` 残留 → 上下同时存在；
 *   - `wd-fab`：位移归零时省略 transform → 旧位移残留。
 *
 * ## 用法
 *
 * 先声明该元素**可能被切换的全部键**及其**中性值**，之后任何一帧都输出完整键集：
 *
 * ```ts
 * const LINE_STYLE = defineStyleKeys({ transform: 'translateX(0px)' })
 *
 * const lineStyle = computed(() =>
 *   resolveStyle(LINE_STYLE, { transform: `translateX(${offset.value}px)` })
 * )
 * ```
 *
 * 中性值必须选「视觉上等同于不设置」的合法取值（`translateX(0px)` / `none` /
 * `flex` / `0px`）。**不要**用 `inherit` 去兜底可能被 CSS 类声明的属性
 * （如 `font-size`）——`inherit` 会把内联值变成父级取值，反而覆盖掉类里的声明。
 *
 * @see CONVENTIONS.md §20
 * @see test/style-funnel.test.ts
 */
import { filterStyle } from './util'

/** 单个样式键的取值（`undefined` / `null` / `''` 均表示「未设置」） */
export type StyleValue = string | number | null | undefined

/** 样式对象（对象语法是 Lynx 唯一认的形式，CONVENTIONS §19） */
export type StyleObject = Record<string, StyleValue>

/**
 * 声明一组「可切换样式键」及其中性值。
 *
 * 返回值直接传给 {@link resolveStyle} 的第一个参数。函数本身只做类型收敛，
 * 便于在组件内以常量形式定义（模块级常量可避免每次渲染重新分配）。
 */
export function defineStyleKeys<T extends string>(neutral: Record<T, string>): Record<T, string> {
  return neutral
}

/**
 * 合并多个样式源，并**保证 `neutral` 中声明的键始终出现在结果里**。
 *
 * 合并规则（后写的源覆盖先写的）：
 *   1. 以 `neutral` 作为基底，键集完整；
 *   2. 源里取值为 `undefined` / `null` / `''` 时视为「显式清除」——
 *      该键若在 `neutral` 中声明过，回落到中性值；否则从结果中移除；
 *   3. 其余取值按 `String` 归一（与 `filterStyle` 一致）。
 *
 * 这样无论条件如何翻转，下发的样式对象键集都是完整的，从根上消除
 * 「省略键 → 脏值残留」。
 *
 * @param neutral 该元素可切换的全部键 + 中性值（`defineStyleKeys` 的返回值）
 * @param sources 各帧的实际取值，按顺序覆盖
 */
export function resolveStyle(
  neutral: Record<string, string>,
  ...sources: Array<StyleObject | null | undefined>
): Record<string, string> {
  const merged: StyleObject = { ...neutral }

  for (const source of sources) {
    if (!source) continue
    for (const key in source) {
      if (!Object.prototype.hasOwnProperty.call(source, key)) continue
      const value = source[key]
      if (value === undefined || value === null || value === '') {
        // 显式清除：声明过中性值就回落，否则整个键移除
        if (Object.prototype.hasOwnProperty.call(neutral, key)) merged[key] = neutral[key]
        else delete merged[key]
        continue
      }
      merged[key] = value
    }
  }

  return filterStyle(merged)
}
