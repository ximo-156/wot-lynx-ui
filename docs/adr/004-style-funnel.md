# ADR-004 Style Funnel 强制唯一出口

- **状态**：已采纳（已落地）
- **日期**：2026-10-16
- **相关**：`common/style.ts`、`CONVENTIONS §20`、`test/style-funnel.test.ts`

## 背景

Lynx 的 `SET_STYLE` 经后台线程 `pushOp` → 主线程 `__SetInlineStyles(el, value)` 下发，语义是**逐属性合并**（`Object.assign`）：新对象里**没有出现的键，不会清除**元素上已应用的内联属性。

因此「条件写样式」成为本库最容易复发的缺陷类型——某个键在某一帧被省略，上一帧的值就残留。仓库已为此付出 **6 次**代价：

| 组件 | 脏值 | 表现 |
|---|---|---|
| `wd-transition` | `display` | 元素永久 `display:none`，toast / 遮罩全不可见（2026-10-15 真机核实） |
| `wd-swipe-action` | `transition` | 跟手时段未显式写 `none` → 拖动不跟手 |
| `wd-segmented` | `transform` | `if (left)` 为 0 时省略 → 选中首项滑块不归位 |
| `wd-picker-view` | `transition` | 首次拖动跟手、之后每次都带缓动 |
| `wd-toast` | `top` / `bottom` | position 切换时 `top` 残留 → 上下同时存在 |
| `wd-fab` | `transform` | 位移归零时省略 → 旧位移残留 |

## 决策

把「写样式」收敛为**唯一出口**，并在出口处强制「完整键集」语义：

```ts
defineStyleKeys<T>(neutral: Record<T, string>): Record<T, string>
resolveStyle(neutral, ...sources): Record<string, string>
createStyleResolver(neutral?) => (...sources) => Record<string, string>
```

- 中性值必须是「视觉上等同于不设置」的合法取值（`translateX(0px)` / `none` / `flex` / `0px`）。
- **不要**用 `inherit` 兜底可能被 CSS 类声明的属性（会把内联值变成父级取值，反而覆盖类声明）。

守护：`style/conditional-key-write`（warn，存量 baseline）+ 两份回归测试。

## 后果

- 已迁移 6 个受害组件；存量 59 处登记 baseline 待迁移。
- 规则定级为 `warn` 而非 `error`，因为该规则命中的是缺陷的**必要条件**而非充分条件（`if (a) { style.top = … } else if (b) { style.top = … }` 这类安全写法同样被命中）。

## 推翻条件

- Lynx 引擎将 `SET_STYLE` 语义改为「整体替换」→ 根因消失，可移除 Funnel（需引擎版本 ADR）。
- 存量迁移完成后，将规则收紧为 `error`（这是计划内的收紧，不是推翻）。
