/**
 * 跨组件共享的类型契约。
 *
 * 判定标准：**两个及以上互不相关的组件需要同一个类型，且该类型不属于任何一方**。
 *
 * 为什么放这里而不是让 A 借 B 的 `types`：
 * 借用会在 A 与 B 之间建立一条纯类型耦合边（review-lint 的 `dep/lateral-contract`），
 * 后果有两个——拆包时 A 必须连带 B 的类型模块；B 改动契约会无声波及 A。
 * 类型下沉到 L2（common）后，双方都只依赖中立层，A 与 B 之间没有任何边。
 *
 * 不放进这里的东西：
 * - 只被一个组件使用的类型 → 留在该组件 `types.ts`；
 * - 父子组件之间的 Provide/Inject 类型 → 留在父组件 `types.ts`
 *   （子组件 import 父组件的 `*_KEY` 属于族内契约，见 docs/architecture/families.json）；
 * - Props 工厂函数（`makeStringProp` 等）→ `common/props.ts`。
 */

/**
 * 底部指示条的位置样式。
 *
 * 被 `wd-tabs`（自有 `lineTheme` prop）与 `wd-cascader`（透传给内部 tabs）共用。
 *
 * - `normal`：默认宽度，未设置 `lineWidth` 时 24px
 * - `text`：宽度跟随文字
 * - `underline`：下划线，宽度等于 tab 宽度
 * - `dot`：点状，宽度 6px
 */
export type TabsLineTheme = 'normal' | 'text' | 'underline' | 'dot'
