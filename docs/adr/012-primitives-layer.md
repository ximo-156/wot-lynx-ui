# ADR-012 引入 L3.5 Primitives 层

- **状态**：**已落地**（2026-10-23 完成，全量测试通过）
- **日期**：2026-10-22
- **相关**：ADR-001、ADR-003、`ARCHITECTURE.md §3.2`

## 背景

2026-10-22 依赖图实测（`scripts/analyze-deps.mjs`）：

| 指标 | 数值 |
|---|---|
| 跨组件依赖边 | **153** |
| 有出边的组件 | 74 / 107（69%） |
| 强连通分量（环） | **5** |
| `wd-icon` fan-in | **47** |

`ARCHITECTURE.md` v1.0 §3.1 曾规定「组件之间不得互相 import 实现」，但该禁令**从未生效**（实存 153 条边），也**没有守护**。更关键的是它方向错了：组件组合复用是刚需（132 条），真正有害的是**契约借用**（64 条：42 条 `import type` + 22 条值导入 `types` 内的 KEY 常量）——后者是 5 个环与「拆包不可行」的唯一成因。

ADR-003 原计划「按域拆包」在依赖图上不可执行：`wd-address-edit`(form) 依赖 `wd-cell`(display)、`wd-action-sheet`(feedback) 依赖 `wd-popup`(display)，切分后包依赖图立刻成环。

**拆包不改变依赖图，只改变它的可见性。**

## 决策

在 L3（composables）与 L4（业务组件）之间新增 **L3.5 基础件层** `src/primitives/`，收纳「高 fan-in 且所有依赖均为叶子件」的组件：

```
wd-icon(47) wd-loading(9) wd-transition(7) wd-overlay(5) wd-badge(5)
wd-button(11) wd-popup(9) wd-img(3) wd-cell(3) wd-input(4) wd-root-portal
```

（`wd-tab` 因与 `wd-tabs` 互引，暂留 L4。）

配套三条边规则（`review-lint` error 级）：

| 规则 | 内容 |
|---|---|
| `dep/lateral-contract` | 禁止 `wd-A` 直接 import `wd-B/types` 的契约；共享类型下沉 `common/types` 或基础件 `types` |
| `dep/lateral-business` | 业务组件禁止 import 其他业务组件的 `.vue` |
| `dep/core-purity` | 基础件禁止 import 业务组件；基础件之间禁止互相 import |

并新增 `dep/lateral` 边数基线（`docs/architecture/deps-baseline.json`），CI 断言**「业务↔业务边数不得增加」**——收敛是单调的，允许分阶段下降，禁止任何 PR 让它上升。

## 实测收敛效果（2026-10-23，`pnpm check:deps`）

| 指标 | 收敛前 | 收敛后 |
|---|---|---|
| 跨组件边总数 | 153 | 157（分析器覆盖面更全，见下） |
| 「业务 → 基础件」边 | 0 | **98** |
| 「业务 ↔ 业务」边 | 153 | **48（−69%）** |
| 「基础件 → 业务」边 | — | **0**（铁律成立） |
| 跨族契约借用 | 46 | **0** |
| 跨族环 | — | **0** |
| 族内环（父子组件对） | 5 | 5 |

**基础件最终为 12 个**：初版 11 个之外，2026-10-23 补入 `wd-textarea`——
它与 `wd-input` 同属表单叶子件（且自己就依赖 `wd-input`），把它留在业务层会让
`wd-dialog` / `wd-address-edit` 不得不借它的 `TextareaProps` 类型，产生 2 条
`dep/lateral-contract` 违规。

**环的判定标准在落地中被修正。** 原计划「解掉 5 个环（KEY 下沉）」被评估为**过度设计**：
5 个环全部是父子组件对（`wd-avatar`↔`wd-avatar-group`、`wd-tab`↔`wd-tabs`、
`wd-swiper`↔`wd-swiper-nav`、`wd-tabbar`↔`wd-tabbar-item`、`wd-table`↔`wd-table-column`），
它们本就是不可分割的原子单元，`provide/inject` 的互引不是缺陷。强行解环只会把
注入 KEY 搬去 `common/`，增加一次间接而不降低任何真实耦合。

因此判据改为**「族内允许、跨族禁止」**：`analyze-deps.mjs` 自动识别组件族
（前缀相同的父子对），`dep/cross-family-cycle` 为 error 级，族内环不阻断。
这也让「拆域包」的前提从不可达成的「环 = 0」变为可达成的「跨族环 = 0」。

**总数 153 → 157 不是劣化。** 评审时的临时脚本只匹配同根 `../wd-x/`；
`analyze-deps.mjs` 额外覆盖跨根 `../../primitives/wd-x/` 与嵌套子目录。
可比指标是「业务 ↔ 业务」边。

## 后果

**正面**

- 69% 的横向耦合一次性变为「业务 → 基础件」单向依赖。
- 为 ADR-003 的域包拆分提供了**可达成的前提**（业务↔业务边 ≤ 60 且跨族环 = 0，当前 48 / 0）。
- 基础件可独立测试、独立发布（`@wot-lynx/primitives`）。

**负面**

- 需要一次性改写约 100 条 import 路径，回归面大（实际对策：先建 `analyze-deps.mjs` 基线 → 一次性 codemod 改写 → 全量测试兜底）。
  **踩坑记录**：codemod 正则缺词边界导致 `wd-cell` 误匹配 `wd-cell-group`、`wd-input` 误匹配
  `wd-input-number`，9 处测试 import 被错改；另有多处「非 import 形式的路径构造」
  （`join(COMPONENT_DIR, x, 'index.css')`、模板字符串）需单独修。新增
  `test/helpers/component-roots.ts` 统一双根解析，杜绝再犯。
- 基础件的 API 稳定性要求高于业务组件（它是 47 个组件的依赖）。
- 深度导入路径（`wot-lynx-ui/components/wd-icon`）变化，需保留 re-export 兼容。

## 推翻条件

- 下沉后「业务 ↔ 业务」边未降到 60 以下 → 说明判据（fan-in ≥ 3 且依赖均为叶子件）不足，需引入第二层（如 `layouts/`）。
  **当前 48，已达标。**
- 基础件被迫频繁变更且波及全库 → 说明基础件边界划错，应重新聚类而非扩大 core。
