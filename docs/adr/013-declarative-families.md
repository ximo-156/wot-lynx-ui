# ADR-013 组件族声明式化

- **状态**：已采纳（2026-10-23 落地）
- **日期**：2026-10-23
- **相关**：ADR-012、`docs/architecture/families.json`、`scripts/analyze-deps.mjs`、`scripts/review-lint.mjs`

## 背景

ADR-012 引入「组件族」概念来区分两种环：父子组件对（`wd-tabs` + `wd-tab`）的互引是
provide/inject 契约，不是缺陷；跨族的环才是真耦合。

第一版实现由 `analyze-deps.mjs` **自动推断**族：只把「双向直连」（a→b 且 b→a）union 成一族。
这个推断有两个致命缺陷，在 P1.4 落地时同时暴露：

**缺陷一：漏判单向父子对（9 对）。**

`wd-col` 只 import `wd-row/types` 的 `ROW_KEY`，没有反向边——`wd-row` 通过插槽接收
`wd-col`，运行时不需要 import 它。按「双向」判据，这一对不算族，于是
`wd-col → wd-row` 被判为 `dep/lateral-contract` 违规。同类还有：

| 子组件 | 父组件 | 借用的注入契约 |
|---|---|---|
| wd-col | wd-row | `ROW_KEY` |
| wd-step | wd-steps | `STEPS_KEY` |
| wd-collapse-item | wd-collapse | `COLLAPSE_KEY` |
| wd-form-item | wd-form | `FORM_KEY` / `FORM_VALIDATE_EVENTS` |
| wd-grid-item | wd-grid | `GRID_KEY` |
| wd-sidebar-item | wd-sidebar | `SIDEBAR_KEY` |
| wd-drop-menu-item | wd-drop-menu | `DROP_MENU_KEY` |
| wd-index-anchor | wd-index-bar | `indexBarInjectionKey` |
| wd-sticky | wd-sticky-box | `STICKY_BOX_KEY` |

这 9 对在「46 处契约借用」的存量里占了 18 条（9 对 × 双向计数），全是**误报**。
按错误的判据去「下沉 KEY」，会把 9 个注入上下文搬进 `common/`，让中立层反过来
知道「row 上下文」「steps 上下文」这类组件知识——违反 INV-2，且不降低任何真实耦合。

**缺陷二：两个工具各持一份事实。**

`review-lint.mjs` 从 `deps-baseline.json` 的 `families` 字段读族，
`analyze-deps.mjs` 自己算族并写进基线。结果：

- lint 用 A 判据 → 0 errors（族豁免生效）
- `DEPS.md` 用 B 判据 → 50 条违规（族豁免没应用到 `dep/lateral-contract`）

同一份代码，两个工具给出相反结论。**报告虚报的直接后果是没人再看报告**——
这比判据错误更伤。

## 决策

**族改为声明式，且是唯一事实来源。**

1. 新建 `docs/architecture/families.json`：每族声明 `id` / `members` / `reason`。
   `reason` 必须回答「为什么这两个组件不能独立演进」，空值直接校验失败。
2. `analyze-deps.mjs` 与 `review-lint.mjs` **都只读这个文件**，不再各自推断。
3. `analyze-deps.mjs` 校验声明的真实性（不允许声明与图不符）：
   - 成员必须真实存在；
   - 一个组件不得同时属于两族；
   - 族内必须真的存在依赖边（防止过期声明）；
   - **反向校验**：任何双向依赖对必须被某个族覆盖，否则报错。
     这条堵住了「用沉默掩盖耦合」——想让一条双向边不报错，只能显式声明并写明理由。
4. 族内互引（compose 与 contract 都算）不进违规清单；
   跨族互引才判 `dep/lateral-component` / `dep/lateral-contract`。
5. 规则 ID 统一：`dep/primitives-purity` / `dep/lateral-component` / `dep/lateral-contract`
   在两个工具里同名，可直接跨工具 grep。

同时修正指标口径：`contractBorrow` 只统计**跨族、业务↔业务**的 types/utils 借用。
原口径把「业务→基础件」（期望方向）、「基础件↔基础件」（合法）、族内 KEY 借用
都算进去，得到 46 这个既不可比也不可行动的数字。

## 结果

| 指标 | 修正前 | 修正后 |
|---|---|---|
| 组件族 | 5（自动推断，漏 9 对） | **15**（声明式） |
| 契约借用（口径修正后） | 46 | **0** |
| `dep/lateral-contract` 违规 | 25 | **0** |
| 两工具结论是否一致 | 否（0 vs 50） | **是** |

真正的跨族契约借用只有 2 处，已分别处理：

- `wd-dialog → wd-textarea`：把 `wd-textarea` 提升为 L3.5 基础件（与 `wd-input` 同类，
  它自己就依赖 `wd-input`，把它留在业务层是任意切分）。
- `wd-cascader → wd-tabs`：`TabsLineTheme` 下沉到新建的 `common/types.ts`，
  `wd-tabs` 重新转出以保持对外 API 不变。

## 备选方案

| 方案 | 为何不选 |
|---|---|
| 继续自动推断，把「单向 KEY 借用」也纳入族判定 | 判据变成「import 了 `*_KEY` 就算同族」，等价于把规则的解释权交给正则；`wd-dialog` 借 `TextareaProps` 这类真问题会被一并豁免 |
| 维护白名单但放在脚本常量里 | 族是**架构决策**，必须可评审、可 diff、可写理由；塞进脚本就回到了「决策无留痕」的老问题 |
| 用命名约定推断（`wd-x` + `wd-x-item`） | `wd-col`/`wd-row`、`wd-sticky`/`wd-sticky-box` 都不符合；且命名相似不代表原子 |

## 推翻条件

- 声明式族增长到「几乎每两个组件一族」→ 说明族的粒度失效，此时应改为**按包边界声明**
  （拆包后族 = 包内组件集合），而不是继续在 `families.json` 里堆条目。
- 出现「族内互引导致真实 bug」（例如父组件改 Provide 类型后子组件静默失效）→
  说明族内契约需要显式版本化，而不是靠「同族即允许」放行。
