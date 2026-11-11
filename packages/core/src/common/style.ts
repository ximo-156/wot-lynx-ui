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
 * 中性值可以选「视觉上等同于不设置」的合法取值（`translateX(0px)` / `none` /
 * `flex` / `0px`），或选 `''` 清除内联覆盖，让 CSS 类与主题继续生效。
 * **不要**用 `inherit` 去兜底可能被 CSS 类声明的属性
 * （如 `font-size`）——`inherit` 会把内联值变成父级取值，反而覆盖掉类里的声明。
 *
 * @see CONVENTIONS.md §20
 * @see test/style-funnel.test.ts
 */

/** 单个样式键的取值（`undefined` / `null` / `''` 均表示「未设置」） */
export type StyleValue = string | number | null | undefined

/** 样式对象（对象语法是 Lynx 唯一认的形式，CONVENTIONS §19） */
export type StyleObject = Record<string, StyleValue>

/**
 * CSS 键名归一：camelCase → kebab-case。
 *
 * Lynx 的内联样式通道要求键名为 kebab-case（官方 Element API 文档：
 * 「The style names must be in kebab-case」），camelCase 键会被静默丢弃
 * （真机 2026-10-25 巡检：zIndex / marginLeft / paddingTop 等全数失效）。
 * vue-lynx 的 normalizeStyle 不做转换，这里在 Style Funnel 出口统一兜住，
 * 手写 `:style` 对象的组件另用 {@link kebabKeys} 归一。
 */
const CAMEL_TEST_RE = /[A-Z]/
const CAMEL_REPLACE_RE = /[A-Z]/g
export function kebabKey(key: string): string {
  // `--wot-*` 自定义属性与已是 kebab 的键原样返回
  if (key.charCodeAt(0) === 45 /* - */ || !CAMEL_TEST_RE.test(key)) return key
  return key.replace(CAMEL_REPLACE_RE, (ch) => `-${ch.toLowerCase()}`)
}

/**
 * 归一整个样式对象的键名（camelCase → kebab-case）。
 * 供未走 resolveStyle 的裸样式对象使用。
 */
export function kebabKeys(style: StyleObject): StyleObject {
  const out: StyleObject = {}
  for (const key in style) {
    if (!Object.prototype.hasOwnProperty.call(style, key)) continue
    out[kebabKey(key)] = style[key]
  }
  return out
}

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
  // 键名统一 kebab-case（Lynx 内联通道要求，见 kebabKey 说明）；neutral 与
  // 源对象先各自归一，再按原合并规则处理，camelCase 写法不再依赖调用方自律。
  const base: StyleObject = {}
  for (const key in neutral) {
    if (!Object.prototype.hasOwnProperty.call(neutral, key)) continue
    base[kebabKey(key)] = neutral[key]
  }
  const merged: StyleObject = { ...base }

  for (const source of sources) {
    if (!source) continue
    for (const key in source) {
      if (!Object.prototype.hasOwnProperty.call(source, key)) continue
      const value = source[key]
      const targetKey = kebabKey(key)
      if (value === undefined || value === null || value === '') {
        // 显式清除：声明过中性值就回落，否则整个键移除
        if (Object.prototype.hasOwnProperty.call(base, targetKey)) merged[targetKey] = base[targetKey]
        else delete merged[targetKey]
        continue
      }
      merged[targetKey] = value
    }
  }

  // 空字符串是已声明键的「清除内联覆盖」值，不能再经 filterStyle 剔除。
  // Lynx 下只省略键会保留旧值；显式下发 '' 才能恢复 CSS 类和主题变量。
  return Object.fromEntries(
    Object.entries(merged)
      .filter(([, value]) => value !== undefined && value !== null)
      .map(([key, value]) => [key, String(value)])
  )
}

/**
 * 每个元素单独创建的动态 Style Funnel。主题变量/customStyle 的键由消费方决定，
 * 静态 neutral 无法预列；记住曾经使用的键并在下一帧输出空值清除覆盖。
 * 它不触发响应式更新、不访问 DOM，不得跨元素共享一个实例。
 */
export function createStyleResolver(neutral: Record<string, string> = {}) {
  const knownKeys: Record<string, string> = {}
  for (const key in neutral) {
    if (!Object.prototype.hasOwnProperty.call(neutral, key)) continue
    knownKeys[kebabKey(key)] = neutral[key]
  }
  return (...sources: Array<StyleObject | null | undefined>): Record<string, string> => {
    for (const source of sources) {
      if (!source) continue
      for (const key of Object.keys(source)) {
        const k = kebabKey(key)
        if (!Object.prototype.hasOwnProperty.call(knownKeys, k)) knownKeys[k] = ''
      }
    }
    return resolveStyle(knownKeys, ...sources)
  }
}
