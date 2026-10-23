# wot-lynx-ui 架构扩展性评审与设计修订

> 评审对象：`ARCHITECTURE.md` v1.0（2026-10-16）
> 评审基线：`main@b6be886`（2026-10-21）｜ 107 个 `wd-*` 组件 ｜ 50,057 行源码
> 评审角色：软件架构师 ｜ 评审方式：**文档声明 vs 代码现实逐条比对 + 依赖图静态分析 + 门禁规则核对**
> 结论版本：v2.0-rev1

---

## 0. 评审结论

### 0.1 一句话结论

**组件内的实现质量是 A 级，系统级的扩展性只有 C 级；而限制扩展性的关键不在纵向分层（纵向已经达标，甚至超出文档预期），而在横向耦合（文档只用一句话禁止，代码里有 153 条边，零守护）。**

`ARCHITECTURE.md` v1.0 的诊断方向（Style Funnel / Platform Adapter / Component Meta / 分层）**是对的**，但它把 **80% 的路线图预算投给了纵向重构（拆包、分层、meta），只给横向耦合留了一句从未生效的禁令**。而「101 → 300 组件」这件事的真实成本，恰恰全部落在横向。

### 0.2 三个最重要的判断

| # | 判断 | 证据 |
|---|---|---|
| 1 | **架构权威文档已失效**：5 条核心论断与代码不符，其中 INV-5「零 MTS」已被一次全库重写推翻 | `7658d0c feat(ui): 全组件原生优先重写（MTS 跟手…）`，12 个组件在用声明式 MTS；`CONVENTIONS §10` 已于 10-19 改写 |
| 2 | **纵向分层是健康的，横向耦合是失控的** | `common/` 反向 import 组件 = **0**；`composables/` import 组件 = **0**；但组件间 import = **197 行 / 153 条边 / 5 个环** |
| 3 | **扩展性瓶颈是「契约无源 + 依赖图稠密」，不是「没拆包」** | `meta.ts` 数量 = **0**；拆域包被 153 条边 + 5 个环物理阻断，文档 §3.2「Phase 3 条件触发拆域包」不可执行 |

### 0.3 扩展性评分

| 扩展维度 | 评分 | 决定性依据 |
|---|---|---|
| 新增组件 | 7 / 10 | 文件系统即清单（`gen-index` 已落地），但无脚手架、demo 手工维护 1623 行 |
| 新增语言 | 9 / 10 | `check-locale-parity.mjs` + 语言包契约 |
| 新增图标集 | 9 / 10 | `registerIconSet` 注册表，插件式 |
| 新增主题 | 8 / 10 | 预设已实现且 `ConfigProvider` 走 `wot-theme-*` 类；但全量预设打进主包 |
| 新增平台 | **3 / 10** | `uniAdapter` 是 17 行 `Record<string, any>`，无能力声明 → 改动面 O(组件数) |
| API 演进 / 破坏性变更 | **4 / 10** | 无 meta、无 API diff、无 codemod、无 ADR |
| 拆包 / 团队并行 | **2 / 10** | 153 条横向边、5 个环，任何拆法都产生循环依赖 |
| 生态接入 | 6 / 10 | auto-import 插件已有；但 `sideEffects: true` + `dist` 未产出，`exports` 承诺落空 |
| **加权** | **6.0 / 10** | 单点优秀，系统级缺少「让 300 个组件不腐化」的横向骨架 |

---

## 1. 评审方法（为什么不能只读文档）

本次评审不采信文档自述，全部结论由三类机器证据支撑：

1. **依赖图静态分析**：扫描 `packages/ui/src/**` 全部 `.vue` / `.ts`，提取 `from '../wd-*/*'` 边，构建有向图，计算 fan-in / fan-out / 强连通分量（环）。
2. **声明物核对**：对文档中每一处「已落地 / 待落地」的断言，直接查文件是否存在、行数多少（`meta.ts`、`docs/adr/`、`dist/`、`presets/`）。
3. **门禁规则核对**：逐条读 `scripts/review-lint.mjs`（677 行 / 28 条规则），确认哪条不变量真的有守护、守护范围多大。

---

## 2. 关键发现一：架构文档已与代码漂移（P0，必须先修）

`ARCHITECTURE.md` 是仓库唯一的架构权威。它一旦失效，所有下游决策（新人上手、Issue 排期、代码评审依据）都建立在错误前提上。当前漂移 6 处：

| # | ARCHITECTURE.md 声明 | 代码现实 | 影响 |
|---|---|---|---|
| D1 | **INV-5：零 MTS**，`src/` 下不得出现 `main-thread` / worklet | `7658d0c` 全库原生优先重写；**12 个组件**使用 `main-thread-bind*` / `useMainThreadRef`；`CONVENTIONS §10` 已改为「声明式 MTS 为唯一形态，只禁命令式」 | 🔴 最严重。按文档执行会**删掉正确实现** |
| D2 | P0-1「`index.ts` 435 行手写 barrel，清单维护两遍」 | 已由 `scripts/gen-index.mjs` 生成：`src/index.ts` 173 行 + `components/index.ts` 生成物 | 🟡 已解决但文档仍在描述为 P0 |
| D3 | §3.3「Style Funnel 待引入（Phase 0.4）」 | `common/style.ts` 已实现 `resolveStyle` / `defineStyleKeys` / `createStyleResolver`，并带完整注释与单测 | 🟡 文档落后于实现 |
| D4 | §1.1「`docs/` VitePress 8 篇指南 + 101 篇组件文档」 | `docs/components/` **不存在**（`gen-docs.mjs` 按需生成，未入库）；`docs/` 仅 3 篇 md | 🟡 事实错误 |
| D5 | §3.2「Phase 2 拆 8 个包」+ §3.1「组件之间**不得**互相 import」 | 组件间 **153 条边**；拆包在依赖图上不可行 | 🔴 计划不可执行（详见 §3） |
| D6 | Phase 0.6「建立 `docs/adr/`」 | `docs/adr/` **不存在** | 🟡 治理留痕为零 |

**根因**：文档是**手写的快照**，而代码在 10-19～10-21 之间发生了两次全库级重写（`a00b6b9` 全量对齐 wot-ui、`7658d0c` 全组件原生优先）。手写快照无法跟上这种节奏。

**修正方案（不是「再写一遍文档」）**：把 `ARCHITECTURE.md` 拆成**稳定部分**与**可生成部分**：

```text
ARCHITECTURE.md           # 只写「为什么」：原则、不变量、ADR、取舍理由 —— 变更频率低
docs/architecture/
  SNAPSHOT.md             # 由 scripts/gen-snapshot.mjs 生成：组件数/行数/依赖边/环/规则数/门禁状态
  DEPS.md                 # 由依赖图分析生成：fan-in 排行、环、违规清单
```

`gen-snapshot.mjs` 进 CI，与源码不一致即失败 —— 与 `gen-index --check` 同一模式（该模式已被验证有效）。**文档一致性从此是机器问题，不是自觉问题。**

---

## 3. 关键发现二：纵向达标，横向失控（扩展性的真正瓶颈）

### 3.1 纵向分层：实际是干净的

文档 §1.2 称「五层只存在于目录约定中，没有强制依赖方向」。实测：

| 检查 | 结果 |
|---|---|
| `common/` → `components/` 或 `composables/` | **0 处** |
| `composables/` → `components/` | **0 处** |
| `review-lint.mjs` 中 `dep-direction` 规则 | **已存在 2 条**（守 `composables` 与 `common/icons/locale`） |

**结论**：纵向依赖方向不仅没有违规，而且已经有机器守护。文档低估了自身现状 —— 这本身是一种漂移，会让团队把精力投到已经解决的地方。

### 3.2 横向耦合：153 条边，零守护

```
组件数              107
跨组件 import 行数   197
去重后依赖边         153
有出边的组件         74 / 107  (69%)
强连通分量（环）      5
```

**环清单**（全部是「父 ↔ 子」互引）：

| 环 | 成因 |
|---|---|
| `wd-avatar ↔ wd-avatar-group` | 子引父的 `types`，父引子的 `.vue` |
| `wd-tab ↔ wd-tabs` | 同上 |
| `wd-swiper ↔ wd-swiper-nav` | 同上 |
| `wd-tabbar ↔ wd-tabbar-item` | 同上 |
| `wd-table ↔ wd-table-column` | 同上 |

**边的类型分布**（决定了修复策略，不能一刀切）：

| 类型 | 条数 | 例子 | 判定 |
|---|---|---|---|
| `component-compose`（引 `.vue`） | 132 | `wd-calendar → wd-tabs.vue` | ✅ 合法组合，但需限方向 |
| `type-contract`（`import type` 引 `types`） | 42 | `wd-button → wd-loading/types` | ❌ **必须下沉**，是拆包与环的元凶 |
| `other`（值导入 `types` 里的 KEY 常量） | 22 | `wd-avatar → wd-avatar-group/types` | ❌ 同上 |
| `util-borrow`（引 `utils`） | 1 | `wd-calendar → wd-calendar-view/utils` | ❌ 应下沉到 `common` |

**关键洞察**：64 处（42 + 22）**契约借用**是「拆包不可行」与「5 个环」的唯一成因。而 132 处组合复用是组件的正常形态，不该禁止 —— 文档那句「组件之间不得互相 import 实现」**方向错了**：它既无法执行（组合是刚需），也没抓到真问题（契约借用）。

### 3.3 fan-in 分布：`wd-icon` 是事实上的核心

| 组件 | fan-in | fan-out | 角色 |
|---|---|---|---|
| `wd-icon` | **47** | 0 | 叶子核心（44% 的组件依赖它） |
| `wd-button` | 11 | 2 | 半核心 |
| `wd-loading` | 9 | 0 | 叶子核心 |
| `wd-transition` | 7 | 0 | 叶子核心 |
| `wd-overlay` | 5 | 1 | 叶子核心 |
| `wd-badge` | 5 | 0 | 叶子核心 |
| `wd-input` / `wd-img` / `wd-cell` | 3–4 | 1 | 叶子核心 |
| `wd-tab` | 3 | 2 | **伪核心**（fan-out 有环，不该进 core） |

fan-out 最大：`wd-select-picker`(8)、`wd-calendar`(7)、`wd-address-edit`(6)、`wd-cascader`(5)、`wd-dialog`(5)、`wd-tabs`(5)。

### 3.4 结论：拆域包的计划必须撤回

文档 §3.2 写「按域拆组件包**暂不做**，触发条件：单域 > 40 组件或单域 > 3 人」。这个判断的**理由错了**：

> 拆域包的真实障碍不是「版本管理成本」，而是**依赖图不是 DAG**。`form` 域的 `wd-address-edit` 依赖 `display` 域的 `wd-cell`、`basic` 域的 `wd-button`；`feedback` 域的 `wd-action-sheet` 依赖 `display` 域的 `wd-popup`。按域切分后，包依赖图会立刻出现环。

因此正确的表述是：**在依赖图收敛之前，拆域包不是「暂不做」，而是「做不了」**。而收敛的手段不是拆包，是引入 **Primitives 层**。

---

## 4. 关键发现三：契约无源，扩展成本随组件数线性增长

### 4.1 现状

| 契约载体 | 现状 | 问题 |
|---|---|---|
| `types.ts`（107 份） | ✅ 已是纯声明 + `props.ts` 工厂（`makeBooleanProp` 等） | 质量好，是可推导的 |
| `meta.ts` | ❌ **0 份** | props/events/slots/a11y/status 无单一来源 |
| `docs/components/*.md` | `gen-docs.mjs` 反解析 `.vue` | 反解析是脆弱的（改写法即失效） |
| API 变更检测 | 无 | 破坏性变更只能靠人 |
| IDE / AI 契约 | 无 | 无 JSON schema |

**好消息**：`types.ts` 用 `props.ts` 工厂函数声明，`ExtractPropTypes` 可推导 —— 这意味着 meta **不需要手写 107 份**。文档 §7 已识别该风险（「meta 改造工作量被低估」），但给出的对策是「脚本生成骨架 + 人工补 events/slots/a11y」，仍然要人工过 107 遍。

### 4.2 修正设计：推导式 meta，而非手写式 meta

```ts
// scripts/gen-meta.mjs 的推导源（全部来自已有代码，零人工）
//   props      ← types.ts 的 props 对象 + common/props.ts 工厂的运行时类型
//   events     ← .vue 中 defineEmits / emits 声明
//   slots      ← .vue template 中的 <slot name="x">
//   name       ← 目录名
// 人工只补「机器推不出来的语义」：domain / tier / status / a11y / wotCompat
```

产出 `meta.generated.ts`（机器维护，CI 校验）+ `meta.ts`（人工语义，仅 5 字段）。这样：

- 107 份 meta 的人工成本从「107 × 20 分钟」降到「107 × 2 分钟」
- 契约变更自动进 `meta.generated.ts` 的 diff → **天然得到 API 变更检测**
- `gen-docs` 从「反解析 vue」改为「读 meta」，脆弱性消失

---

## 5. 关键发现四：分发契约声明了但没兑现

`packages/ui/package.json` 的 `exports` 承诺了 `dist`：

```jsonc
".": { "source": "./src/index.ts", "import": "./dist/index.mjs", "types": "./dist/index.d.ts" }
```

但 `packages/ui/dist/` **不存在**，`scripts/build-dist.mjs` 存在却未进 CI，也从未产出。

更关键的是：

```jsonc
"sideEffects": true    // ← 扩展性硬伤
```

`sideEffects: true` 告诉打包器「所有模块都有副作用，**不许裁剪**」。后果：消费者写 `import { WdButton } from 'wot-lynx-ui'`，打包器**无法**剔除其余 106 个组件。107 组件 / 50k 行时这是浪费；300 组件时这是事故。

（缓解项：`plugin/auto-import.ts` 已实现按需注入，能绕过该问题。但 auto-import 是「约定式旁路」，`sideEffects` 是「主路径」，两者不该互相打补丁。）

**修正**：

```jsonc
// 组件源码本身无副作用；只有样式与字体是副作用
"sideEffects": ["**/*.css", "**/*.scss", "**/*.ttf"]
```

并把 `build-dist` 纳入 CI，新增 `check-exports.mjs` 校验「`exports` 中每个 `import` 目标文件真实存在」—— 让声明与产物由机器对齐。

---

## 6. 关键发现五：平台适配层仍是占位实现

文档 §3.4 设计了 `PlatformAdapter`（含 `capabilities`）。现实是 `common/uniAdapter.ts` 全部内容：

```ts
export type UniAdapter = Record<string, any>
const hostAdapter: UniAdapter = {}
export function configureUniAdapter(adapter: UniAdapter): void { Object.assign(hostAdapter, adapter) }
export function hasUniAdapter(api: string): boolean { return typeof hostAdapter[api] === 'function' }
export function getUniAdapter(api: string) { return hasUniAdapter(api) ? hostAdapter[api] : undefined }
```

**17 行，字符串键，无类型，无能力声明。** 它解决了「宿主可注入」，但没解决「组件如何知道平台有什么能力」。

后果（这是平台扩展性的量化伤害）：

| 场景 | 当前改动面 |
|---|---|
| 新增 Harmony 专有 API | `configureUniAdapter` 加键 + **每个用到该能力的组件**内部加 `if (hasUniAdapter(...))` 分支 → O(组件数) |
| 新 Lynx 版本支持某能力 | 同上 |
| 测试降级路径 | 无法注入「全能力关闭」的 mock → 降级分支无覆盖 |

**修正**：补 `capabilities` 声明 + `mockAdapter`（capabilities 全 false），组件写法从「查函数是否存在」升级为「查能力是否声明」。这是把 O(组件数) 的改动面压到 O(1) 的唯一手段。

---

## 7. 扩展性压力测试（把「扩展性」变成可测量的东西）

抽象讨论「扩展性好不好」没有意义。用 5 个真实扩展场景量化「改动面」：

| 扩展场景 | 当前改动面 | 目标改动面 | 差距 |
|---|---|---|---|
| 新增 1 个组件 | 建目录 → `gen:index` → `gen:docs` → **手改 `demo/App.vue`(1623 行)** → 手改真机清单 | 1 条命令 `pnpm gen:component wd-xxx` 生成全部 5 处 | 缺脚手架 |
| 新增 1 个平台 | `uniAdapter` 加键 + **N 个组件内分支** | 1 个 Adapter 文件 + capabilities 表 | **O(N) → O(1)** |
| 新增 1 个主题 | `presets/*.scss` + `index.scss` mixin | 同左，但**按需引入** | 包体线性增长 |
| 新增 1 种语言 | `locale/xx.ts` + parity 脚本自动校验 | 已达标 | ✅ 无差距 |
| 拆分组件包 | **不可行**（153 边 / 5 环） | primitives 收敛后可拆 | 阻断 |
| 引入破坏性变更 | 人工排查 + 手写 changelog | meta diff 自动产出 + codemod | 无机制 |

**这张表就是本评审的核心结论**：6 个场景里 4 个的改动面是「随组件数线性增长」甚至「不可执行」。扩展性不是感觉，是这 4 行。

---

## 8. 修订后的目标架构（v2.0）

### 8.1 唯一的架构改动：新增 L3.5 Primitives 层

不新增包、不推翻分层、不改任何组件 API —— 只把「已被反复复用的叶子件」从 L4 提到 L3.5，并在 lint 里加三条边规则。

```text
┌──────────────────────────────────────────────────────────────┐
│ L5 交付与生态   demo / docs / cli / rspeedy-plugins          │
├──────────────────────────────────────────────────────────────┤
│ L4 业务组件     wd-calendar / wd-select-picker / wd-tabs …   │
│                 （可依赖 L3.5，禁止依赖其他 L4）              │
├──────────────────────────────────────────────────────────────┤
│ L3.5 基础件  ★新增                                           │
│   wd-icon · wd-loading · wd-transition · wd-overlay          │
│   wd-popup · wd-root-portal · wd-badge · wd-button           │
│   wd-img · wd-cell · wd-input                                │
│   （只依赖 L3/L2/L0；禁止依赖 L4；**禁止相互依赖**）           │
├──────────────────────────────────────────────────────────────┤
│ L3 组合式   useParent / useChildren / useTouch / usePopover  │
├──────────────────────────────────────────────────────────────┤
│ L2 基础能力 Style Funnel · PlatformAdapter · util · props     │
├──────────────────────────────────────────────────────────────┤
│ L1 平台适配 LynxAdapter · WebAdapter · MockAdapter           │
├──────────────────────────────────────────────────────────────┤
│ L0 设计系统 tokens / presets                                 │
└──────────────────────────────────────────────────────────────┘
```

### 8.2 收敛效果（已用依赖图实测）

以 fan-in ≥ 3 且 fan-out ≤ 2 为判据选出 **10 个基础件**：

```text
wd-icon(47) wd-button(11) wd-loading(9) wd-transition(7) wd-overlay(5)
wd-badge(5) wd-input(4) wd-img(3) wd-cell(3) wd-tab(3, 需先解环)
```

| 指标 | 收敛前 | 收敛后 | 变化 |
|---|---|---|---|
| 跨组件边总数 | 153 | 153（结构不变） | — |
| 其中「业务 → 基础件」边 | 0 | **91** | 单向、可守护 |
| 其中「业务 ↔ 业务」边 | 153 | **53** | **−65%** |
| 环 | 5 | 目标 0 | 需解 5 处父子互引 |

**65% 的横向耦合被一次性收敛为「业务 → 基础件」单向依赖**。这才是让「300 组件」可行的结构性改动 —— 而不是把 101 个组件拆成 6 个包（拆包不改变依赖图，只改变依赖图的**可见性**）。

### 8.3 三条边规则（进 lint，替换文档里那条不可执行的禁令）

| 规则 ID | 内容 | 级别 |
|---|---|---|
| `dep/lateral-contract` | 禁止 `wd-A/types` → `wd-B/types` 的契约借用；共享类型必须下沉 `common/types` 或基础件 `types` | error |
| `dep/lateral-business` | 业务组件（非基础件）禁止 import 其他业务组件的 `.vue`；组合需求应改为「基础件组合」或「`useChildren` 契约」 | error（存量 baseline） |
| `dep/core-purity` | 基础件禁止 import 业务组件；基础件之间禁止互相 import | error |

配套 `scripts/analyze-deps.mjs`（本次评审已写出的分析逻辑产品化），产出 `docs/architecture/DEPS.md` + 边数基线。**CI 断言「业务↔业务边数不得增加」** —— 单调收敛，允许分阶段。

### 8.4 解环方案（5 处，统一手法）

5 个环全是「子组件引父组件 `types` 拿注入 KEY，父组件引子组件 `.vue`」。统一解法：**把 KEY 常量与 Provide 类型下沉到基础件或 `common`**。

```ts
// ❌ 现状：wd-avatar 引 wd-avatar-group/types（父）→ 环
// ✅ 修正：KEY 下沉
// common/context-keys.ts
export const AVATAR_GROUP_KEY: InjectionKey<AvatarGroupProvide> = Symbol('wd-avatar-group')
```

改完后 `wd-avatar → wd-avatar-group` 的边消失，环归零。**5 处环全部可这样解，无需改任何公开 API。**

---

## 9. 修订后的路线图（重排优先级）

原路线图的顺序是「止血 → 分层 → 拆包 → 生态」。修订为「**对齐事实 → 收敛横向 → 兑现分发 → 平台抽象 → 契约生成 → 才谈拆包**」：

### P0 — 对齐事实与兑现契约（1 周，零风险，收益最高）

| # | 动作 | 验收 |
|---|---|---|
| 0.1 | 修正 `ARCHITECTURE.md`：INV-5 改为「声明式 MTS 唯一形态」；D2/D3/D4/D6 六处漂移逐条更正 | 文档中每条「已落地」断言都能被 `grep` 验证 |
| 0.2 | 新增 `scripts/gen-snapshot.mjs` + CI 一致性校验 | 快照与源码零 diff |
| 0.3 | 建 `docs/adr/`，迁入 10 条 ADR + 新增 `ADR-011 声明式 MTS`、`ADR-012 primitives 层` | 目录存在且有 12 篇 |
| 0.4 | `sideEffects` 改为 `["**/*.css","**/*.scss","**/*.ttf"]` | 打包实验：`import { WdButton }` 体积下降 > 60% |
| 0.5 | `build-dist` 进 CI + `check-exports.mjs` | `exports` 中每个路径真实存在 |

### P1 — 横向收敛（3–4 周，扩展性的核心投资）

| # | 动作 | 验收 |
|---|---|---|
| 1.1 | `scripts/analyze-deps.mjs` + 边数基线入库 | `DEPS.md` 自动生成 |
| 1.2 | 建 `src/components/core/`（或 `src/primitives/`），下沉 10 个基础件 | 目录就位，import 路径全量改写 |
| 1.3 | 5 处环解掉（KEY 下沉 `common/context-keys.ts`） | 环 = 0 |
| 1.4 | 64 处契约借用下沉 | `dep/lateral-contract` 全绿 |
| 1.5 | 3 条边规则进 lint（存量 baseline） | 业务↔业务边 ≤ 60 且不再增长 |
| 1.6 | `gen:component` 脚手架（含 demo/真机清单自动注册） | 新组件 1 条命令，0 处手改 |

### P2 — 平台抽象与分发兑现（3–4 周）

| # | 动作 | 验收 |
|---|---|---|
| 2.1 | `PlatformAdapter` + `capabilities` + `mockAdapter` | 降级路径测试覆盖 > 80% |
| 2.2 | `uniAdapter` 降级为薄封装（旧 API 保留） | 零破坏 |
| 2.3 | 主题按需（presets 不进主包） | 未选预设时包体不含其 CSS |
| 2.4 | `dist` 真实产出 + 非 Rspeedy 消费者验证 | 纯 Vite 工程可安装使用 |

### P3 — 契约生成与生态（4–6 周）

| # | 动作 |
|---|---|
| 3.1 | 推导式 meta（`gen-meta` 从 `types.ts`/`emits`/`slots` 推导）+ 人工语义 5 字段 |
| 3.2 | `gen-docs` 改读 meta（不再反解析 `.vue`） |
| 3.3 | meta diff → API 变更检测 + changelog + codemod |
| 3.4 | 视觉回归（`__web_preview` 截图 diff） |
| 3.5 | 测试分片（当前 85 个测试文件、`environment` 是主要开销） |

### P4 — 拆包（**前提：P1 完成且业务↔业务边 ≤ 60**）

只有当依赖图从「稠密」变成「业务 → 基础件」的星形后，拆域包才有意义。**在此之前拆包只会把编译期错误变成运行期循环依赖。**

---

## 10. 与 v1.0 的分歧点（明确记录，避免反复推翻）

| # | v1.0 主张 | 本次评审结论 | 理由 |
|---|---|---|---|
| 1 | 分层缺失是首要问题（§1.2） | **不成立**：纵向 0 违规，且有 lint 守护 | 实测 |
| 2 | 「组件之间不得互相 import」（§3.1） | **改为**：允许业务 → 基础件；禁止业务 ↔ 业务契约借用；禁止基础件互引 | 原禁令不可执行，且未命中真问题 |
| 3 | 拆域包「暂不做」，条件是单域 > 40 组件（ADR-003） | **改为**：在依赖图收敛前「做不了」；条件改为「业务↔业务边 ≤ 60」 | 153 边 / 5 环物理阻断 |
| 4 | 零 MTS（ADR-009 / INV-5） | **撤销**：已改为声明式 MTS 唯一形态 | `7658d0c` 全库重写 + `CONVENTIONS §10` |
| 5 | meta 由「脚本生成骨架 + 人工补」 | **改为**：推导式生成 `meta.generated.ts`，人工只写 5 个语义字段 | `types.ts` 已是纯声明，可推导 |
| 6 | 优先级：分层 → 拆包 → 生态 | **改为**：对齐事实 → 横向收敛 → 分发兑现 → 平台抽象 → 契约 → 拆包 | 见 §7 压力测试 |

---

## 11. 风险

| 风险 | 等级 | 对策 |
|---|---|---|
| 下沉 10 个基础件改动 91 条 import 路径，回归面大 | 高 | 先做 `dep/lateral-*` 基线（不改代码）→ 分批下沉（每批 ≤ 3 个组件）→ 每批跑全量测试 |
| `wd-tab` fan-out 有环，不宜进 core | 中 | 先解 `wd-tab ↔ wd-tabs` 环；若仍不纯，`wd-tab` 留在 L4 |
| 契约下沉改变深度导入路径（`wd-x/types`） | 中 | 在旧路径保留 `export type { ... } from '...'` re-export，`meta.status` 标 deprecated |
| `sideEffects` 收紧后样式被摇掉 | 中 | 白名单含 `*.css/*.scss/*.ttf`；用 demo 构建产物比对兜底 |
| P1 期间功能开发被阻塞 | 中 | 边规则先以 baseline 记录、不阻断；只对新代码生效 |

---

## 12. 验收指标（季度自检，可量化）

| 指标 | 当前 | P1 后 | P4 前门槛 |
|---|---|---|---|
| 业务 ↔ 业务 依赖边 | 153 | ≤ 60 | ≤ 30 |
| 契约借用（type/util 跨组件） | 64 | 0 | 0 |
| 强连通分量（环） | 5 | 0 | 0 |
| `meta.generated.ts` 覆盖率 | 0% | — | 100% |
| 单组件引入体积（gzip） | 全量 | −60% | −80% |
| 新增组件改动点 | 5 处（含手改 demo） | 1 条命令 | 1 条命令 |
| 新增平台改动文件数 | O(N) | O(1) | O(1) |
| 文档与代码一致性 | 手写、已漂移 6 处 | 机器校验 | 机器校验 |

---

## 附录 A：本次评审的原始数据

```text
组件目录            107（另含遗留 packages/ui/src/components/wot-ui/，非 wd-* 前缀，建议清理）
.vue 文件           112      .ts 文件  112（types.ts 112 份）
源码规模            vue 23,704 行 / ts 13,623 行 / scss 12,730 行 = 50,057 行
每组件均值          vue 221 / ts 127 / scss 118
最大组件            wd-calendar-view  vue 1,591 + ts 866（21 文件）
vue 行数分布        中位数 154 / p90 505 / >800 行 2 个
跨组件 import       197 行 → 153 边（compose 132 / type 42 / other 22 / util 1）
环                  5（avatar / tab / swiper / tabbar / table 的父子对）
fan-in Top          icon 47 / button 11 / loading 9 / transition 7 / overlay 5 / badge 5
review-lint         677 行 / 28 条规则（含 dep-direction ×2、style/conditional ×2）
测试                85 个测试文件；vitest projects 已按 node/jsdom 分离
生成物              src/index.ts 173 行（生成）、components/index.ts（生成）
缺失                meta.ts ×0、docs/adr/、dist/、docs/components/
```

## 附录 B：建议新增的脚本清单

| 脚本 | 作用 | 归属 |
|---|---|---|
| `analyze-deps.mjs` | 依赖图 → fan-in/fan-out/环/边数基线 → `DEPS.md` | P1.1 |
| `gen-snapshot.mjs` | 架构快照（组件数/行数/边数/规则数）→ CI 校验 | P0.2 |
| `gen-component.mjs` | 组件脚手架（目录 + types + vue + scss + demo 注册 + 真机清单） | P1.6 |
| `gen-meta.mjs` | 从 `types.ts` / `emits` / `<slot>` 推导 `meta.generated.ts` | P3.1 |
| `check-exports.mjs` | 校验 `package.json exports` 每个目标真实存在 | P0.5 |
