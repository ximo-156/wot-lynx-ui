# wot-lynx-ui 架构设计（v2.0）

> 本文档是 `wot-lynx-ui` 的**架构权威文档**，与 `CONVENTIONS.md`（编码规范）互为补充：
> `CONVENTIONS.md` 回答「一个组件怎么写」，本文回答「整个系统怎么组织、怎么演进」。
>
> | 项 | 值 |
> |---|---|
> | 版本 | **v2.0**（2026-10-22 修订） |
> | 上一版 | v1.0（2026-10-16），已因两次全库重写而失效 |
> | 基线 | `packages/ui` 106 个 `wd-*` 组件 / 50,024 行源码 |
> | 修订依据 | 2026-10-22 架构评审（依赖图实测 + 文档漂移比对，报告存档于评审人本机） |
> | 决策留痕 | `docs/adr/` |

---

## 0. v1.0 → v2.0 修订说明

v1.0 于 2026-10-16 写成。此后仓库发生两次全库级重写（`a00b6b9` 全量对齐 wot-ui 2.3.2、`7658d0c` 全组件原生优先重写），导致 v1.0 的 6 处断言与代码不符。**本版的首要工作不是增加新设计，而是把文档拉回事实。**

| # | v1.0 断言 | v2.0 更正 | 依据 |
|---|---|---|---|
| C1 | **INV-5 / ADR-009：零 MTS**，`src/` 不得出现 worklet | **撤销。** 改为「声明式 MTS 是跟手交互的唯一形态，命令式跨线程 API 禁止」 | `7658d0c`；`CONVENTIONS §10`（2026-10-19 改写）；12 个组件使用 `main-thread-bind*` |
| C2 | P0-1：`index.ts` 435 行手写 barrel，清单维护两遍 | **已解决。** `scripts/gen-index.mjs` 生成，`src/index.ts` 173 行 + `components/index.ts` 生成物 | `pnpm check:index` |
| C3 | §3.3 Style Funnel「待引入」（Phase 0.4） | **已落地。** `common/style.ts` 提供 `resolveStyle` / `defineStyleKeys` / `createStyleResolver`，带单测 | `common/style.ts`、`test/style-funnel.test.ts` |
| C4 | §1.1「`docs/` 8 篇指南 + 101 篇组件文档」 | **更正。** `docs/components/` 由 `gen-docs.mjs` 按需生成，不入库 | 目录实测 |
| C5 | §3.1「组件之间不得互相 import 实现」 | **改写。** 该禁令从未生效（实存 153 条边），且方向错误。改为三条边规则（见 §5） | 依赖图实测 |
| C6 | §3.2 / ADR-003：拆域包「暂不做」，条件为「单域 > 40 组件」 | **改写。** 拆域包的真实障碍是依赖图有环（5 个）且稠密（153 边），不是版本管理成本。前提条件改为「业务↔业务边 ≤ 60 且环 = 0」 | 依赖图实测 |

另新增两个 ADR：**ADR-011 声明式 MTS**、**ADR-012 Primitives 层**。

> **本版的核心判断**：纵向分层已经达标（`common/`、`composables/` 反向 import 均为 0，且有 lint 守护）；**真正的扩展性瓶颈在横向**——改造前组件之间的 153 条依赖边、5 个循环依赖、65 处契约借用（46 对组件）；改造后业务↔业务边已降至 48、跨族契约借用为 0、跨族环为 0。v1.0 把 80% 的路线图预算投给了纵向重构，这是优先级错配。

---

## 1. 现状（As-Is）

> 以下数据均可由 `node scripts/gen-snapshot.mjs` 与 `node scripts/analyze-deps.mjs` 复现。**文档中的数字若与脚本输出不一致，以脚本为准。**

### 1.1 规模与形态

```
wot-lynx-ui/  (pnpm monorepo, packageManager: pnpm@10.24.0, node>=20)
├── packages/ui/        组件库本体（源码分发 + dist 入口桥接层）
│   ├── src/components/ 106 个 wd-* 目录（111 .vue + 111 types.ts + index.scss + 生成 index.css）
│   ├── src/composables/ 23 个组合式函数（父子通信 / 触摸 / 弹层 / 表单 / 上传…）
│   ├── src/common/      14 个基础模块（util / props / style / uni / uniAdapter / 日期 / 过渡 / 主题镜像…）
│   ├── src/styles/      三层令牌 + mixin + 3 套预设主题（brand-a / compact / high-contrast）
│   ├── src/icons/       图标注册表（registry + sets + 字体 .ttf）
│   ├── src/locale/      16 种语言
│   ├── plugin/          Rspeedy 插件：标签转换 / 自动按需导入 / Web 字体
│   └── test/            87 个测试文件（node + jsdom 双 project，组件 project 关闭文件隔离）
├── packages/demo/       Rspeedy 双端 Demo + 真机验收清单
├── docs/                VitePress 站点（组件文档由脚本生成）
├── scripts/             14 个工程脚本（gen-index / gen-docs / build-css / build-dist / review-lint …）
├── contributing/code-review/  7 篇审查标准与流程
└── .github/workflows/ci.yml   并行门禁 job
```

| 指标 | 数值 |
|---|---|
| 组件数 | 106 |
| 源码行数 | 50,024（vue 23,687 / ts 13,614 / scss 12,723） |
| 每组件均值 | vue 221 / ts 127 / scss 118 |
| 最大组件 | `wd-calendar-view`（vue 1,591 + ts 866，21 文件） |
| vue 行数分布 | 中位数 156 / p90 505 / >800 行仅 2 个 |

### 1.2 分层现状：纵向健康，横向失控

**纵向（层间）——已达标**：

| 检查 | 结果 |
|---|---|
| `common/` → `components/` 或 `composables/` | **0 处** |
| `composables/` → `components/` | **0 处** |
| 守护 | `review-lint.mjs` 的 `dep-direction` ×2（error 级） |

**横向（组件间）——失控**：

| 指标 | 评审时（改造前） | 当前 |
|---|---|---|
| 跨组件 import 行数 | 197 | 205 |
| 去重依赖边 | 153 | 157 |
| 「业务 ↔ 业务」边 | **153（全部）** | **48** |
| 「业务 → 基础件」边 | 0 | 97 |
| 「基础件 ↔ 基础件」边 | — | 10 |
| 「基础件 → 业务」边 | — | **0** |
| 有出边的组件 | 74 / 106（70%） | — |
| 跨族环 | — | **0** |
| 族内环（父子组件对） | 5 | 5 |
| `wd-icon` fan-in | 47（44% 的组件依赖它） | — |

> 总数从 153 变为 157 不是劣化：评审用的临时脚本只匹配同根 `../wd-x/`，
> 而 `analyze-deps.mjs` 额外覆盖跨根 `../../primitives/wd-x/` 与嵌套子目录。
> **可比指标是「业务 ↔ 业务」边**，它由 153 降到 48（−69%）。

边的类型分布（决定修复策略，不能一刀切）：

| 类型 | 条数 | 例子 | 判定 |
|---|---|---|---|
| `component-compose`（引 `.vue`） | 132 | `wd-calendar → wd-tabs.vue` | ✅ 合法组合，需限方向 |
| `type-contract`（`import type` 引 `types`） | 42 | `wd-button → wd-loading/types` | ❌ 必须下沉 |
| `other`（值导入 `types` 内 KEY 常量） | 22 | `wd-avatar → wd-avatar-group/types` | ❌ 必须下沉 |
| `util-borrow`（引 `utils`） | 1 | `wd-calendar → wd-calendar-view/utils` | ❌ 应下沉 `common` |

**契约借用（跨族业务↔业务借 types/utils）是「环」与「拆包不可行」的唯一成因，现为 0。**

> 口径修正：评审时统计的「65 处」把族内父子契约也算进去了。子组件 import 父组件的
> `*_KEY` 是 provide/inject 的固有形态，不是可拆解的耦合（见 `docs/architecture/families.json`）。
> 按「跨族才算」的真实口径，改造后该指标为 **0**。

### 1.3 必须固化的平台不变量（Lynx 硬约束）

这些是 Lynx 引擎的物理事实，属架构级约束：

| # | 不变量 | 当前守护 |
|---|---|---|
| I1 | `SET_STYLE` 是**逐属性合并**，省略键不清除已应用内联样式 | ✅ Style Funnel + `style/*` lint 规则（warn） |
| I2 | 字符串 `:style` 被静默丢弃，只认对象 | ✅ `vue/string-style`（error） |
| I3 | **声明式 MTS 是跟手交互唯一形态；命令式 `runOnMainThread` 会崩（真机 1101）** | ✅ `js/mts-imperative`（error）+ `no-main-thread-script.test.ts` |
| I4 | `<svg :content>` 元素白名单（svg/g/path/rect/circle/polyline） | 🟡 `sanitizeSvgContent()` 运行时兜底 |
| I5 | 无 `::before/::after`、无 `!important` | ✅ `scss/no-pseudo-element`、`scss/no-important` |
| I6 | 默认 `linear` 布局，弹性属性必须挂 `display:flex` | 🟡 文档 + 回归测试，无 lint |
| I7 | 事件注册表只容忍函数，同名监听合并成数组会崩 | ✅ 4 份回归测试（矩阵覆盖） |
| I8 | kebab-case 标签被当原生元素 | ✅ 标签转换插件 + 测试 |
| I9 | worklet 之间禁止互相引用（`'main thread'` 函数不可互调） | ✅ `CONVENTIONS §21` + lint |

### 1.4 架构性问题（按严重度）

| 级别 | 问题 | 证据 |
|---|---|---|
| 🔴 P0 | **横向依赖稠密 + 有环**：153 边 / 5 环，阻断拆包与团队并行 | `analyze-deps` |
| 🔴 P0 | **文档与代码漂移**：v1.0 六处断言失效，其中「零 MTS」会误导实现 | 本文 §0 |
| 🔴 P0 | **分发契约未兑现**：`exports` 声明 `dist/*` 但 `dist/` 从未产出 | `check-exports` |
| 🟠 P1 | **tree-shaking 被关闭**：`sideEffects: true` 使 `import { WdButton }` 拉入全部组件 | `package.json`（v2.0 已修） |
| 🟠 P1 | **契约无源**：`meta` 0 份；`gen-docs` 反解析 `.vue`，写法一变即失效 | ✅ `meta.json` 已建（ADR-017），`gen-docs` 已改读 meta（ADR-018） |
| 🟠 P1 | **破坏性变更只能靠人**：无 API diff、无迁移工具，改契约靠人工排查 | ✅ `api-diff` + `codemod`（ADR-019） |
| 🟠 P1 | **平台能力无声明**：`uniAdapter` 是 17 行 `Record<string, any>`，组件改动面 O(组件数) | `common/uniAdapter.ts` |
| 🟡 P2 | **无脚手架**：新增组件需手改 `demo/App.vue`（1,623 行）与真机清单 | `gen-component` 缺失 |
| 🟡 P2 | **无视觉回归**：`__web_preview` 截图靠人工核对 | ✅ `visual:check`（ADR-020），104 张组件基线 |
| 🟡 P2 | **测试慢**：86 个测试文件，`environment` 是主要开销（每文件 ≈3s） | ✅ 环境复用 + LPT 分片（ADR-021），全量 110s → 33s |

---

## 2. 架构目标与原则

### 2.1 质量属性优先级

1. **可扩展性** — 组件 106 → 300 时，架构成本接近线性。
2. **稳定性** — 平台约束不可违反（崩溃 > 样式错 > 功能缺），API 兼容是底线。
3. **可维护性** — 新人 1 天内产出合规组件；契约变更只改一处。
4. **性能** — 高频交互跟手、首屏可接受、包体可控。
5. **生态友好** — 机器可读、可被工具链与 AI 消费。

### 2.2 六条原则

| 原则 | 含义 | 当前状态 |
|---|---|---|
| **P1 单一来源** | 任何事实只定义一处，其余靠生成 | ✅ 组件清单 + `meta.json` 已生成 |
| **P2 依赖单向** | 层间单向；**层内也须单向** | ✅ 层间；🔴 层内（153 边） |
| **P3 显式契约** | 平台能力、组件 API、父子通信都可类型化、可测试 | 🟡 父子契约好；平台契约弱 |
| **P4 失败降级** | 平台不支持时降级并留痕 | 🟡 散落 |
| **P5 约束机器化** | 文档里的每条硬规则都有 lint / 测试守护 | 🟡 28 条规则，横向缺口 |
| **P6 演进优先** | 可增量交付、可回滚 | ✅ |

### 2.3 架构不变量

违反即视为架构回归：

- **INV-1 依赖无环**：全库 import 图无强连通分量。
- **INV-2 层间单向**：`components/primitives → composables → common/platform → styles`，反向 import 是错误。
- **INV-3 层内单向**：业务组件可依赖基础件；**业务组件之间禁止契约借用**；基础件之间禁止互相依赖。
- **INV-4 样式出口唯一**：组件不得直接拼装内联样式对象下发，一律经 Style Funnel。
- **INV-5 声明式 MTS**：跟手交互只能用 `main-thread-bind*` + `useMainThreadRef` + `'main thread'`；**禁止** `runOnMainThread` / `runOnBackground` / `lynxWorkletImpl`。
- **INV-6 平台能力经适配层**：组件不得直接读 `SystemInfo` / 宿主全局，必须经 `PlatformAdapter`。
- **INV-7 契约有源**：props / events / slots / 元信息由 `meta` 单一来源驱动生成物。
- **INV-8 API 兼容**：`wd-*` 的 props / events / slots / 类名与 wot-ui 2.3.2 对齐（差异须在 `differences.md` 登记）。

---

## 3. 目标架构（To-Be）

### 3.1 分层架构（L0–L5，含 L3.5）

```
┌───────────────────────────────────────────────────────────────────────┐
│ L5  交付与生态层                                                        │
│     demo / docs / cli / rspeedy-plugins / unocss-preset                │
├───────────────────────────────────────────────────────────────────────┤
│ L4  业务组件层   src/components/wd-*                                    │
│     calendar / select-picker / tabs / form / table …                   │
│     可依赖 L3.5；禁止依赖其他 L4（禁止契约借用）                          │
├───────────────────────────────────────────────────────────────────────┤
│ L3.5 基础件层 ★v2.0 新增   src/primitives/wd-*                          │
│     icon · loading · transition · overlay · popup · root-portal         │
│     badge · button · img · cell · input                                │
│     只依赖 L3/L2/L0；禁止依赖 L4；基础件之间禁止互相依赖                    │
├───────────────────────────────────────────────────────────────────────┤
│ L3  组合式层   src/composables                                          │
│     useParent/useChildren · useTouch · usePopover · useFormDisabled …   │
├───────────────────────────────────────────────────────────────────────┤
│ L2  基础能力层 src/common                                               │
│     Style Funnel · PlatformAdapter · util · props · 日期 · 过渡兼容      │
│     src/icons · src/locale                                              │
├───────────────────────────────────────────────────────────────────────┤
│ L1  平台适配层 (common/platform 子模块)                                  │
│     LynxAdapter · WebAdapter · MockAdapter(测试)                        │
├───────────────────────────────────────────────────────────────────────┤
│ L0  设计系统层 src/styles                                               │
│     primitive → semantic → component；预设主题；JS 镜像                  │
└───────────────────────────────────────────────────────────────────────┘
        ▲ 依赖方向只能向上依赖（下层不得 import 上层）
```

### 3.2 为什么是 Primitives 层，而不是「拆域包」

v1.0 计划按域拆包（`components-form` / `components-display` …），条件为「单域 > 40 组件」。**该计划在依赖图上不可执行**：

- `wd-address-edit`（form）依赖 `wd-cell`（display）、`wd-button`（basic）
- `wd-action-sheet`（feedback）依赖 `wd-popup`（display）
- 按域切分后，包依赖图立即出现环

**拆包不改变依赖图，只改变依赖图的可见性。** 真正能降低耦合的是**把高频叶子件提升为一层**。

实测收敛效果（判据：fan-in ≥ 3 且所有依赖均为叶子件）：

| 指标 | 收敛前 | 收敛后（实测） |
|---|---|---|
| 跨组件边总数 | 153 | 157 |
| 「业务 → 基础件」边 | 0 | **97** |
| 「业务 ↔ 业务」边 | 153 | **48（−69%）** |
| 「基础件 → 业务」边 | — | **0**（铁律） |
| 跨族环 | — | **0** |
| 族内环 | 5 | 5（父子组件对，允许） |

**12 个基础件清单**（`wd-tab` 因与 `wd-tabs` 互引，暂留 L4；`wd-textarea` 于 2026-10-23 补入，
与 `wd-input` 同为表单叶子件，避免 `wd-dialog`/`wd-address-edit` 借它的类型）：

```
wd-icon(47) wd-loading(9) wd-transition(7) wd-overlay(5) wd-badge(5)
wd-button(11) wd-popup(9) wd-img(3) wd-cell(3) wd-input(4) wd-root-portal
```

### 3.3 目标包结构

> 拆分由「收益 > 成本」触发，不一步拆到底。

| 包 | 内容 | 时机 |
|---|---|---|
| `@wot-lynx/tokens` | `styles/*` + 预设主题 + `common/theme.ts` JS 镜像 | P3 |
| `@wot-lynx/runtime` | `common/*`（含 Style Funnel + PlatformAdapter） | P3 |
| `@wot-lynx/composables` | `composables/*` | P3 |
| `@wot-lynx/primitives` | `src/primitives/*`（★v2.0） | P3（先目录分层，后拆包） |
| `@wot-lynx/icons` / `@wot-lynx/locale` | 资产包 | P3 |
| `@wot-lynx/components` | `src/components/*` + 生成 barrel | 保持整包 |
| `@wot-lynx/cli` | scaffold / gen-* / codemod | P2 |
| `wot-lynx-ui`（保留） | 兼容层：re-export 全部，存量零改动 | 全程 |

**按域拆组件包的前提**：`业务↔业务边 ≤ 60 且环 = 0`。

---

## 4. 横切骨架

### 4.1 样式解析层（Style Funnel）— 已落地

**根因**：Lynx `SET_STYLE` → `__SetInlineStyles` 是逐属性合并，**省略的键不会清除**已应用的内联属性。故「`if (cond) style.x = …`」在 cond 由真转假时留下脏值。已为此付出 6 次代价（transition / swipe-action / segmented / picker-view / toast / fab）。

**现状**：`common/style.ts` 已实现三个 API：

```ts
defineStyleKeys<T>(neutral: Record<T, string>): Record<T, string>
resolveStyle(neutral, ...sources): Record<string, string>
createStyleResolver(neutral?) => (...sources) => Record<string, string>  // 动态键（customStyle / themeVars）
```

**守护**：`style/conditional-key-write`（warn，存量 baseline）+ `test/style-funnel.test.ts` + `test/inline-style-regression.test.ts`。

**待办**：存量 59 处条件写样式迁移；迁移完成后规则收紧为 `error`。

### 4.2 平台适配层（PlatformAdapter）— capabilities 已落地，方法层不做

`common/uniAdapter.ts` 是字符串键注册表（宿主可注入 `pageScrollTo` 等 API）。
`common/platform.ts` 在其上提供**能力判定**，解决「两个组件对同一能力得出不同结论」：

```ts
getPlatform().capabilities.canvas2d      // 需要 createCanvasContext + canvasToTempFilePath
getPlatform().capabilities.intersectionObserver
getPlatform().capabilities.videoContext
getPlatform().capabilities.pageScroll
```

- 能力是**派生值**：宿主注入 API 后自动为真，不另设一份「能力声明」——否则
  注册表与声明必然漂移（本仓库反复出现的「声明与实现不一致」不能在代码里重演）。
- 用 getter 而非快照：宿主可能在挂载后才注入。
- `mockPlatform()` 强制能力为 false，**压过已注入的宿主能力**，用于覆盖降级分支。
- 只抽象**有 ≥2 个消费者**的能力（ADR-005 自身的 YAGNI 条款）。单点能力
  （`getImageInfo` / `makePhoneCall` / `openType`）继续用 `hasUniAdapter(key)`，
  否则 capabilities 会退化成注册表的镜像。
- `measure` / `navigate` / `pickMedia` 等**方法层不做**：它们只是 `uni.*` 的第二层
  门面，零消费者。理由见 ADR-015。

### 4.3 组件元数据（Component Meta）— ✅ 已落地（P3.1）

v1.0 计划「脚本生成骨架 + 人工补 events/slots/a11y」，需人工过 106 遍。**v2.0 改为推导式**，
产物是 `packages/ui/meta.json`（ADR-017）。

| meta 字段 | 来源 | 维护方 |
|---|---|---|
| `props`（含 `type` / `default` / `required` / `options`） | `types.ts` 的 props 对象 + 前置 JSDoc 兜底 | 机器（`scripts/gen-meta.mjs`） |
| `events` | `.vue` 的 `defineEmits`（五种写法全支持） | 机器 |
| `slots` | template 中的 `<slot name="x">` | 机器 |
| `name` / `layer` | 目录结构（`primitives` / `components`） | 机器 |
| `family` | `docs/architecture/families.json`（ADR-013） | 机器 |
| `modelValue` | props 含 `modelValue` **且** events 含 `update:modelValue` | 机器 |
| `domain` / `tier` / `status` / `a11y` / `wotCompat` | 人工语义 | 人工（尚未引入，见 ADR-017 推翻条件） |

实测：106 个组件 / 1464 个 prop / 218.8 KB，**type 与 description 覆盖率均 100%**。

**一份 meta 驱动**（括号内为现状）：barrel 生成（✅）、组件文档（✅ ADR-018）、
demo 注册（待建）、API 变更检测（✅ ADR-019）、codemod（✅ ADR-019）、
JSON schema（IDE / AI，待建）。

**副产品**：`meta.json` 的 diff 天然就是 API 变更清单。序列化时每个 prop 独占一行
且字段顺序固定，所以 diff 粒度落在**单个 prop** 上；`scripts/api-diff.mjs` 再把这层
diff 翻译成 13 类语义变更与四级严重度，避免「改描述」和「删 prop」被混为一谈。

**门禁**：

- `pnpm check:meta`（CI `generated` job）—— 产物与源码不一致即红灯。
- `test/meta-generated.test.ts`（11 条断言）—— 管「解析是否完整」，其中 4 条是防
  解析器**静默失效**：源码有 `emit('x')` 则 events 必含 `x`、有 `<slot>` 则 slots
  非空、`types.ts` 定义的 prop 必在 props 里、`default` 不能是人话。
  这些检测逻辑**独立实现**，不 import `gen-meta.mjs` 的函数——复用会让同一个 bug
  同时污染生产者和校验者。

⚠️ 解析器按**写法形态**匹配，新写法出现时会安静地返回空数组而非报错。落地过程中
已发生三次（漏 10 → 4 → 2 个组件），全部靠上述断言发现，详见 ADR-017「后果」。

---

## 5. 横向依赖治理（v2.0 新增，扩展性的核心）

### 5.1 三条边规则

| 规则 ID | 内容 | 级别 |
|---|---|---|
| `dep/lateral-contract` | 禁止 `wd-A` 直接 import `wd-B/types` 的契约；共享类型下沉 `common/types` 或基础件 `types` | error |
| `dep/lateral-component` | 业务组件禁止 import 其他业务组件的 `.vue`；两条出路：提升为基础件，或在 `families.json` 声明同族 | error（存量 baseline） |
| `dep/primitives-purity` | 基础件禁止 import 业务组件（`coreToBusiness` 必须为 0）。基础件之间**允许**互引——`popup → overlay → transition` 是必要的组合链，只需保证这条链不成环 | error |

### 5.2 解环手法（5 处，统一）

5 个环全部是「子引父 `types` 拿注入 KEY，父引子 `.vue`」。统一解法：**KEY 与 Provide 类型下沉**。

```ts
// common/context-keys.ts
export const AVATAR_GROUP_KEY: InjectionKey<AvatarGroupProvide> = Symbol('wd-avatar-group')
```

改完后 `wd-avatar → wd-avatar-group` 的边消失，环归零，**不改任何公开 API**。

| 环 | 下沉的 KEY |
|---|---|
| `wd-avatar ↔ wd-avatar-group` | `AVATAR_GROUP_KEY` |
| `wd-tab ↔ wd-tabs` | `TABS_KEY` |
| `wd-swiper ↔ wd-swiper-nav` | `SWIPER_KEY` |
| `wd-tabbar ↔ wd-tabbar-item` | `TABBAR_KEY` |
| `wd-table ↔ wd-table-column` | `TABLE_KEY` |

### 5.3 收敛是单调的，不是一次性的

`scripts/analyze-deps.mjs` 输出边数基线到 `docs/architecture/deps-baseline.json`，CI 断言 **「业务↔业务边数不得增加」**。允许分阶段下降，禁止任何 PR 让它上升。

---

## 6. 构建与分发

### 6.1 双轨分发

```jsonc
{
  "exports": {
    ".": { "source": "./src/index.ts", "import": "./dist/index.mjs", "types": "./dist/index.d.ts" },
    "./theme": { "source": "./src/styles/theme/index.scss", "import": "./dist/theme/index.css" },
    "./components/*": { "source": "./src/components/*/*.vue", "import": "./dist/components/*/index.mjs" },
    "./primitives/*": { "source": "./src/primitives/*/*.vue", "import": "./dist/primitives/*/index.mjs" },
    "./plugin": "./plugin/index.js",
    "./package.json": "./package.json"
  }
}
```

**`dist` 是入口桥接层，不是编译产物**（ADR-014）。`scripts/build-dist.mjs` 只写
`export { default } from '../../../src/<root>/<comp>/<comp>.vue'` 这样的 re-export，
不做 SFC / worklet / SCSS 编译。它的唯一作用是让子路径落到具体文件上。

| 消费者 | 结果 |
|---|---|
| 能编译 `.vue` 的打包器（Rspeedy / Vite + `@vitejs/plugin-vue` / webpack + `vue-loader`） | ✅ |
| 裸 Node / SSR 直跑 | ❌ `ERR_UNKNOWN_FILE_EXTENSION` |

- **源码优先**：支持 `source` 条件的构建器走源码，Tree-shaking 最优；其余走 `dist` 垫片。
- `source` 子路径目标**必须落到文件**。写成 `./src/components/*` 会代入出**目录**，
  Node 的 `PACKAGE_TARGET_RESOLVE` 不做目录解析 → `ERR_UNSUPPORTED_DIR_IMPORT`。
  （`import.meta.resolve()` 对目录也返回成功，手工验证抓不到，必须机器校验。）
- `sideEffects` 必须限定为 `["**/*.css", "**/*.scss", "**/*.ttf"]`。写成 `true` 会关闭整个包的 tree-shaking —— `import { WdButton }` 会拉入全部 106 个组件。
- `scripts/check-exports.mjs` 四类校验：①exports 目标存在；②`files` 白名单覆盖；
  ③`--built` 时 `dist` 每条 re-export 目标可解析；④通配符代入真实条目名后解析到**文件**。
  **声明了不存在的产物是发布期故障，必须由机器拦住。**
- demo 必须走真实 `exports`（`resolve.conditionNames` 追加 `'source'`），
  并用 `packages/demo/src/device-test/subpath-contract.ts` 覆盖子路径映射 ——
  别名抄近路会让整个契约无人验证。


### 6.2 按需引入

`plugin/auto-import.ts` 已实现：扫描业务代码中的 `<wd-*>` 标签，自动生成 import 并注入主题 CSS。这是主路径的补充，不替代 `sideEffects` 的正确配置。

### 6.3 版本工程

**API 变更检测已落地**（ADR-019）。`meta.json` 是源码的函数（ADR-017），两个 commit
的 meta 之差就是公开 API 之差，`scripts/api-diff.mjs` 把它变成三样东西：

| 产物 | 用途 |
|---|---|
| 变更清单（`--md` / `--json`） | PR 摘要、CHANGELOG 素材 |
| 迁移计划（`--plan`） | 喂给 `scripts/codemod.mjs` |
| 人工指引 | 无法自动改写的破坏性变更 |

判定按**契约单元**（组件 / prop / event / slot）比较，13 类变更映射到
major / minor / patch / docs 四级。类型用联合成员集合的包含关系判断收窄与放宽，
不看字符串是否相等；可选值单独比较，因为 `type` 常是别名。

`codemod` 只执行**能证明等价**的改写（当前仅 prop 改名：类型、默认值、可选值三者
全同才认定），其余一律输出人工指引。它只碰模板、跳过 `<script>`/`<style>`、要求
属性名有边界，默认 dry-run。

CI 在 PR 上生成清单并写入 `$GITHUB_STEP_SUMMARY`，**不阻塞**：破坏性变更是产品
决策，`--fail-on major` 留给发布分支收口。硬门禁（必须配 changeset）等 `changesets`
就位后再接；`meta.status` 驱动的 deprecation 窗口（≥2 个 minor）仍待建。

---

## 7. 主题与国际化

### 7.1 主题

三层令牌（primitive → semantic → component）已与 wot-ui 对齐。

**主主题与预设主题是独立入口**（ADR-016）：

```
wot-lynx-ui/theme                    → base 刻度 + light/dark 语义令牌
wot-lynx-ui/theme/presets/brand-a    → 紫色品牌覆盖
wot-lynx-ui/theme/presets/compact    → 紧凑模式
wot-lynx-ui/theme/presets/high-contrast → 高对比度
wot-lynx-ui/theme/presets            → 三者聚合
```

预设是**覆盖层**，不进主包：`brand-a` 会把 `--wot-primary-*` 整体改成紫色品牌色，
默认发给所有消费者等于替他们做品牌决策。实测主主题因此从 20103 → 18259 字节。

消费方式（`ConfigProvider` 输出 `wot-theme-${theme}` 类名，与预设选择器同源）：

```ts
import 'wot-lynx-ui/theme'                 // 必须
import 'wot-lynx-ui/theme/presets/brand-a' // 按需
```

```html
<WdConfigProvider theme="brand-a">…</WdConfigProvider>
```

⚠️ 未引入预设 CSS 时**不会报错**：`--wot-*` 回落到 light 主题的值，表现为
「主题没生效」。这是 CSS 自定义属性的固有行为，`test/theme-presets.test.ts`
锁住了类名同源与主包隔离两条契约。

### 7.2 国际化

16 种语言 + `check-locale-parity.mjs`（key 集合一致性 CI 校验）。**这一维度已达扩展性目标**，新增语言只需 1 个文件。

---

## 8. 测试与质量

**测试金字塔**：

```
        ▲ 真机验收（device-test，人工）
       ╱ 视觉回归（组件区域截图 diff，104 张基线）— 已落地
      ╱  契约测试（事件注册表矩阵、父子排序、meta 一致性）
     ╱   组件测试（双线程环境，交互回归）
    ╱    单元测试（纯函数：util / style / 格式化）
```

现状：87 个测试文件，vitest 按 node / jsdom 分两个 project。两处结构性优化已落地（ADR-021）：

- **环境复用**：组件 project 设 `isolate: false`，`test/setup.ts` 每 worker 只跑一次。
  87 文件 / 1302 用例全量从 **110s 降到 33s**，`environment` 累计从 255s 降到 24s。
  收益来自 JSDOM + LynxTestingEnv 的每文件重建（≈3s），它比单文件真正要验的逻辑
  （中位数 < 300ms）大一个数量级。
- **LPT 分片**：`scripts/test-shard.mjs` 按实测耗时装箱，CI 4 分片矩阵。
  内建 `--shard` 是按文件个数轮转，实测最慢片超均值 49%；LPT 偏差 0%。

⚠️ 关闭隔离的前提是「测试文件之间没有可变全局状态耦合」，这**不能靠一次跑绿证明**，
必须用 `--sequence.shuffle.files` 多 seed 取证。2026-10 的取证过程抓到两类真实泄漏：
图标注册表跨文件残留（已用 `__resetIconRegistry` 修复）、以及一个尚未复现的偶发失败
（约 6 次 seed=7 中出现 1 次，多 1 条用例失败）。新增「测试会写、生产不撤销」的全局
注册表时，必须在 `test/setup.ts` 的 `beforeEach` 里复位。

视觉回归尚未进 CI（需固定容器内拍 base 与 head 再比，见 ADR-020 推翻条件）。

---

## 9. 治理

- **ADR**：`docs/adr/NNNN-*.md`。任何架构决策（MTS 形态、primitives 层、版本锁定、不拆域包）必须留痕，避免后人反复推翻。
- **组件生命周期**：`meta.status` 驱动 `draft → beta → stable → deprecated → removed`。
- **CODEOWNERS 按域划分**：basic / form / display / feedback / navigation / runtime / tokens。
- **文档一致性**：`gen-snapshot.mjs` 生成架构快照，CI 校验与源码一致。**文档一致性是机器问题，不是自觉问题。**

---

## 10. ADR 索引

完整决策记录见 `docs/adr/`。摘要：

| ID | 决策 | 结论 |
|---|---|---|
| ADR-001 | 布局分层 + 依赖单向 | 采纳 |
| ADR-002 | 分阶段拆包 | 采纳 |
| ADR-003 | 组件域包暂不拆 | **前提修正**：依赖图收敛后才可拆 |
| ADR-004 | Style Funnel 强制唯一出口 | 采纳（已落地） |
| ADR-005 | Platform Adapter 显式契约 | 采纳（待建） |
| ADR-006 | meta 作为契约单一来源 | 采纳（推导式；产物 JSON 见 017） |
| ADR-007 | 双轨分发（source + dist） | 已取代（被 014） |
| ADR-008 | 生成物 `index.css` 不入库 | 采纳（构建时生成 + CI 校验） |
| ADR-009 | ~~继续零 MTS~~ | **已撤销**，见 ADR-011 |
| ADR-010 | `vue-lynx` 锁 0.5.1 | 维持，升级需 ADR + 回归矩阵 |
| ADR-011 | 声明式 MTS 为跟手交互唯一形态 | 采纳（已落地） |
| ADR-012 | 引入 L3.5 Primitives 层 | 采纳 |
| ADR-013 | 组件族声明式化（`families.json` 单一来源） | 采纳 |
| ADR-014 | `dist` 是入口桥接层，不是编译产物（取代 007） | 采纳 |
| ADR-015 | PlatformAdapter 只落地 capabilities，方法层不做 | 采纳 |
| ADR-016 | 预设主题按需引入，不进主包 | 采纳 |
| ADR-017 | 组件契约由源码推导，产物是 JSON | 采纳 |
| ADR-018 | 文档由 meta 生成，侧边栏是唯一组件清单 | 采纳 |
| ADR-019 | API 变更检测走语义 diff，codemod 只做等价改写 | 采纳 |
| ADR-020 | 视觉回归拍组件区域而非整页，基线按平台隔离 | 采纳 |
| ADR-021 | 测试环境复用（`isolate: false`）+ LPT 分片 | 采纳（附顺序无关取证要求） |

---

## 11. 路线图

### P0 — 对齐事实与兑现契约（1 周，零风险）

| # | 动作 | 验收 |
|---|---|---|
| 0.1 | 修正本文六处漂移 | 每条「已落地」断言可被脚本验证 |
| 0.2 | `gen-snapshot.mjs` + CI 校验 | 快照与源码零 diff |
| 0.3 | `docs/adr/` + 12 篇 ADR | 目录就位 |
| 0.4 | `sideEffects` 修正 | `import { WdButton }` 体积下降 > 60% |
| 0.5 | `build-dist` 进 CI + `check-exports.mjs` | exports 目标真实存在 |

### P1 — 横向收敛（3–4 周，扩展性的核心投资）

| # | 动作 | 验收 |
|---|---|---|
| 1.1 | `analyze-deps.mjs` + 基线 | ✅ `DEPS.md` 自动生成，`pnpm check:deps` 进 CI |
| 1.2 | `src/primitives/` 下沉基础件 | ✅ 12 个；97 条边转为单向；业务↔业务 153→48 |
| 1.3 | 5 处环解掉（KEY 下沉） | ✅ **改为族判据**：5 个环全是父子组件对（原子单元），跨族环 0 即达标 |
| 1.4 | 契约借用下沉 | ✅ **跨族契约借用 = 0**（`dep/lateral-contract` 全绿）；口径见 §3.3 |
| 1.5 | 三条边规则进 lint | ✅ 业务↔业务边 ≤ 48 且不增长，进 CI；三条规则均做过负向验证（注入违规确认会报错） |
| 1.6 | `gen:component` 脚手架 | ✅ `pnpm gen:component wd-foo` 一条命令生成 4 文件 + index.css + barrel |

### P2 — 平台抽象与分发兑现（3–4 周）

| # | 动作 |
|---|---|
| 2.1 | `PlatformAdapter` + `capabilities` + `mockAdapter` → ✅ `common/platform.ts`：4 个能力（各有 2 个消费者）+ `mockPlatform()` 强制降级（压过已注入的宿主能力）；8 处组件字符串键判断改为能力判断；`test/platform.test.ts` 10 例，含「mock 失效则 3 例失败」的负向验证（ADR-015） |
| 2.2 | `uniAdapter` 降级为薄封装 → ✅ **反向决策**：`uniAdapter` 保持 17 行注册表原样，`platform` 叠在其上做语义层。方法层（measure/navigate/pickMedia）**不做**——它们只是 `uni.*` 的第二层门面，零消费者（ADR-015） |
| 2.3 | 预设主题按需（不进主包） → ✅ 主主题从 20103 → 18259 字节；新增 `./theme/presets` 与 `./theme/presets/*` 两个 exports 子路径；类名规则下沉到各预设文件（单独编译即得可用 CSS）；`test/theme-presets.test.ts` 锁住「主包隔离 + 类名同源」（ADR-016） |
| 2.4 | `dist` 真实产出 + 非 Rspeedy 消费者验证 → ✅ **重新定义为「入口桥接层」**（ADR-014）：`build-dist` 构建前清空；`exports` 的 `source` 子路径改为落到文件（原指向目录，主路径实为 `ERR_UNSUPPORTED_DIR_IMPORT`）；demo 去掉 `wot-lynx-ui$` 别名、启用 `source` 条件并加子路径探针；`check-exports` 新增「re-export 目标可解析」「通配符代入后解析到文件」「跨条件条目集合一致」三节，均过负向验证 |

### P3 — 契约生成与包拆分（4–6 周）

| # | 动作 |
|---|---|
| 3.1 | 推导式 meta（`gen-meta`） → ✅ `scripts/gen-meta.mjs` 产出 `packages/ui/meta.json`：106 组件 / 1464 prop / 218.8 KB，type 与 description 覆盖率均 100%；`defineEmits` 五种写法全支持（数组 64 / 内联签名 7 / 键元组 3 / 类型别名 5 / 交叉类型 2）；`check:meta` 进 CI，`test/meta-generated.test.ts` 11 条断言（4 条防静默失效，均过负向验证）（ADR-017） |
| 3.2 | `gen-docs` 改读 meta → ✅ 转义从「解析时」下沉到「渲染时」；Props 从 2 列变 4 列（参数/说明/类型/默认值），Events 与 Slots 改从 meta 推导（原 Events 是 106 个组件共用的两行假数据）；侧边栏从 109 行手写数组改为生成（原写「101 个」实际 106 个、缺 5 条 404）；新增 `assertTableShape()` 生成后自检，拦住 `可选值: 'a' \| 'b'` 断列的旧 bug；`check:docs` 进 CI。顺带修掉 `.gitignore` 自相矛盾（`docs/adr/*` 等三条规则让 16 篇 ADR 从未入库）与双组件根迁移遗留的 29 个 demo 导入路径（ADR-018） |
| 3.3 | meta diff → API 变更检测 + codemod → ✅ `scripts/api-diff.mjs` 按契约单元（组件/prop/event/slot）做语义 diff，13 类变更映射四级严重度，类型按联合成员集合判收窄/放宽；`scripts/codemod.mjs` 只执行能证明等价的 prop 改名（类型+默认值+可选值三者全同才认定，签名有歧义就不猜），只碰模板、跳过 `<script>`/`<style>`、属性名要求边界，默认 dry-run；CI 在 PR 上生成清单进 `$GITHUB_STEP_SUMMARY` 但不阻塞。测试 26 条（16+10）；负向验证抓到两个真实缺陷——首版会静默删掉整个 `<script>` 块，以及测试自己复制 `compileRules` 导致边界断言失效（ADR-019） |
| 3.4 | 视觉回归 → ✅ `scripts/visual-regression.mjs` 用无头 Chrome + CDP 裁剪文档站右侧栏的 H5 预览（`.wd-h5-phone__screen`），不拍整页——正文由 meta 生成，改一句 JSDoc 会让 106 张基线全红；零依赖 PNG 编解码（`node:zlib`，位深 8 / colorType 2·6 / 滤波 0–4）；基线按平台隔离，缺基线报「跳过」不报「通过」；空白基线与不稳定组件单独报告（16 个组件默认不渲染内容、2 个时间相关组件已取证排除且必须写理由）；全量 106 张 85 秒，复检 104 张全 0.000%，改一处主色 token 后 button 11.94% / tag 3.88% / cell 0%（ADR-020） |
| 3.5 | 测试分片 → ✅ 根 `test.isolate: false`（环境复用；写在 project 内部会被静默忽略，实测 113.88s vs 33.35s）：87 文件 / 1302 用例全量 **110s → 33s**，`environment` 累计 255s → 24s；`scripts/test-shard.mjs` 按实测耗时 LPT 装箱（内建 `--shard` 按个数轮转，实测最慢片超均值 49%，LPT 偏差 0%），CI 4 分片矩阵；正确性与性能分离——分片清单现场扫描文件系统、`assignShards` 内部断言「不漏不重」，耗时缓存只影响均衡度；`test/project-coverage.test.ts` 9 条断言守住「每个文件恰好归一个 project」（三条前提断言均过负向验证）。取证过程用 `--sequence.shuffle.files` 多 seed 抓到图标注册表跨文件残留（`__resetIconRegistry` 修复），并顺带清掉 `mts-worklet-shim` 里三个零调用点的死符号（ADR-021） |
| 3.6 | 基础包拆分（tokens / runtime / composables / primitives / icons） |

### P4 — 平台化（6–12 个月）

多平台 Adapter · 设计工具链（Figma ↔ tokens）· AI 友好层（meta → JSON schema）· 企业白标 · `create-wot-lynx` starter。

**成熟度自评**：

```
L1 组件集合  →  L2 有规范的系统  →  L3 有契约与边界  →  L4 有生态  →  L5 平台
   当前 ────────▲                        (P1 目标)      (P2-P3)     (P4)
```

---

## 12. 风险

| 风险 | 等级 | 对策 |
|---|---|---|
| 下沉 11 个基础件改动 91 条 import，回归面大 | 高 | 先建基线（不改代码）→ 分批下沉（每批 ≤ 3 个）→ 每批跑全量测试 |
| 契约下沉改变深度导入路径 | 中 | `api-diff` 把换根判为 major 并给出新旧路径指引；`meta.status` 标 deprecated（待引入） |
| `sideEffects` 收紧后样式被摇掉 | 中 | 白名单含 css/scss/ttf；demo 构建产物比对兜底 |
| P1 期间功能开发被阻塞 | 中 | 边规则先进 baseline 不阻断，只对新代码生效 |
| 平台适配层抽象过度 | 中 | 只抽象「已被 2 个以上组件用到」的能力（YAGNI） |
| `vue-lynx` 版本升级 | 中 | 升级前跑事件矩阵 + 视觉回归；升级即 ADR |

---

## 13. 验收指标（季度自检）

| 指标 | v2.0 基线 | P1 后 | 拆包门槛 |
|---|---|---|---|
| 业务 ↔ 业务 依赖边 | 153 | ≤ 60 | ≤ 30 |
| 契约借用（跨族 type/util） | 64 | 0 | ✅ 0 |
| 强连通分量（环） | 5 | 0 | 0 |
| `meta` 覆盖率（props / events / slots） | 0% | 100% | 100% |
| 单组件引入体积 | 全量 | −60% | −80% |
| 新增组件改动点 | 5 处（含手改 demo） | 1 条命令 | 1 条命令 |
| 新增平台改动文件数 | O(N) | O(1) | O(1) |
| 文档与代码一致性 | 手写、已漂移 6 处 | 机器校验 | 机器校验 |

---

## 附录 A：与 wot-ui 的对齐与分化

**对齐**：三层令牌 · props/events/slots/类名 · `ConfigProvider` 主题注入 · 命令式弹层 API（`useToast`/`useDialog`/`useNotify`）· `useParent`/`useChildren` 父子模式。

**分化（Lynx 平台特性，须在 `differences.md` 登记）**：双线程渲染模型 · **声明式 MTS 跟手** · `1ppx` 细线 · 无伪元素 · SVG 白名单 · 字体图标（`<text>` 字形）· 事件语义 `tap`。

**应借鉴但当前缺失**：预设主题市场 · 按需引入插件（已有雏形）· CLI 工具链 · UnoCSS preset · 生态模板 · AI 友好结构化契约。

## 附录 B：架构健康度自检

| 检查项 | 通过标准 | 命令 |
|---|---|---|
| 依赖无环 | 环 = 0 | `node scripts/analyze-deps.mjs` |
| 层间单向 | `dep-direction` 全绿 | `pnpm lint:conventions` |
| 层内单向 | `dep/lateral-*` 全绿，边数不增长 | 同上 |
| 样式出口唯一 | `style/*` 无新增 baseline | 同上 |
| MTS 形态 | `js/mts-imperative` 全绿 | 同上 |
| 契约一致 | barrel / docs 生成物零 diff | `pnpm check:index` |
| 分发契约 | exports 目标存在 | `node scripts/check-exports.mjs` |
| 架构快照 | 与源码一致 | `node scripts/gen-snapshot.mjs --check` |
