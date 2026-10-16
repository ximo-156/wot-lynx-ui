# wot-lynx-ui 架构设计与长期发展规划

> 本文档是 `wot-lynx-ui` 的**架构权威文档**，与 `CONVENTIONS.md`（编码规范）互为补充：
> `CONVENTIONS.md` 回答「一个组件怎么写」，本文回答「整个系统怎么组织、怎么演进」。
>
> 版本：v1.0 ｜ 日期：2026-10-16 ｜ 基线：`packages/ui` 101 组件 / ~33.9k 行 / `main@821500c`
> 角色：软件架构师 ｜ 输入：代码库全量盘点 + wot-ui 架构研究 + 全库代码审查结论

---

## 0. 摘要（TL;DR）

**一句话结论**：`wot-lynx-ui` 的**组件内实现质量已经很高**（三层令牌、双线程无 MTS 策略、事件注册表回归矩阵都是领先实践），但**系统级架构仍是「单包单体」**——所有能力挤在一个 `wot-lynx-ui` 包里，缺少包边界、缺少平台抽象、缺少契约单一来源。当前瓶颈不是"组件写得不好"，而是**架构缺少让 101 个组件持续扩张而不腐化的骨架**。

**本次设计的三件核心事**：

| # | 架构决策 | 解决的问题 |
|---|---|---|
| 1 | **分层 + 多包**：单包 → L0–L5 六层 / 8 个 workspace 包 | 可独立演进、可独立发布、团队可并行、能力可复用 |
| 2 | **三个横切骨架**：样式解析层（Style Funnel）、平台适配层（Platform Adapter）、组件元数据（Component Meta） | 消除「条件写样式」类系统性缺陷、隔离平台差异、契约单一来源驱动代码生成 |
| 3 | **演进而非重写**：Phase 0–4 分阶段迁移，每阶段可独立交付、可回滚 | 不停工、不推倒、不引入回归 |

**最高优先级的三处「架构修复」**（本周即可做，收益最大）：

1. **`packages/ui/src/index.ts` 的 435 行手写 barrel + 重复的 `components` 注册数组 → 由文件系统生成**（当前同一份组件清单维护了两遍，是头号腐化热点）。
2. **引入 Style Funnel，把「条件写样式」从代码习惯升级为架构约束**（`CODE_REVIEW-2026-10-16.md` 第三节已证明这是**系统性缺陷模式**，已让 wd-transition / wd-swipe-action / wd-segmented / wd-picker-view / wd-toast / wd-fab 六处踩坑）。
3. **把 `common/uni.ts` 的隐式兼容层升级为显式的 `PlatformAdapter` 契约**（当前平台差异散落在 `useDeviceInfo` / `getSystemInfo` / 各处 `if (host)` 分支里，无法被测试替身、无法被未来平台复用）。

---

## 1. 现状盘点（As-Is）

### 1.1 规模与形态

```
wot-lynx-ui/  (pnpm monorepo, packageManager: pnpm@10.24.0, node>=20)
├── packages/ui/        组件库本体（源码分发，main → ./src/index.ts）
│   ├── src/components/ 102 个 wd-* 目录（103 .vue + types.ts + index.scss + 生成 index.css）
│   ├── src/composables/ 21 个组合式函数（父子通信 / 触摸 / 弹层定位 / 表单 / 上传…）
│   ├── src/common/      13 个基础模块（util / props / uni 兼容层 / 日期 / 过渡 / 主题 JS 镜像…）
│   ├── src/styles/      三层令牌（tokens/primitive + tokens/semantic）+ mixin + theme 入口
│   ├── src/icons/       图标注册表（registry + sets + 字体 .ttf）
│   ├── src/locale/      16 种语言
│   ├── plugin/          Rspeedy 标签兼容插件（wd-* → PascalCase）
│   └── test/            27 个测试文件（双线程测试环境）
├── packages/demo/       Rspeedy 双端 Demo + 真机验收清单（8 组 35 项）
├── docs/                VitePress 文档站（8 篇指南 + 101 篇组件文档）
├── scripts/             build-css / gen-docs / generate-iconfont / review-lint
├── contributing/code-review/  7 篇审查标准与流程
└── .github/workflows/ci.yml   6 个并行门禁 job
```

统计：**101 个组件 / ~33.9k 行源码 / 103 个 `.vue` / 165 个 `.ts` / 109 个 `.scss`**。

### 1.2 当前隐式分层（代码里已存在，但没有被「声明」）

| 层 | 实际位置 | 职责 |
|---|---|---|
| 交付层 | `packages/demo` `docs` | 演示 / 文档 / 真机验收 |
| 组件层 | `src/components/*` | 101 个 UI 组件 |
| 组合式层 | `src/composables/*` | 父子契约、触摸、弹层定位、表单校验 |
| 基础能力层 | `src/common/*` `src/icons` `src/locale` | 工具、图标、国际化、过渡兼容 |
| 设计系统层 | `src/styles/*` | 三层令牌 |

**问题**：这五层**只存在于目录约定中**，没有强制的依赖方向、没有包边界、没有 lint 守护。`CONVENTIONS.md §7` 写了「composable / common 层不得 import 组件目录」，但这是**文档约定，不是机器约束**。

### 1.3 与 wot-ui 的架构对照

| 维度 | wot-ui（uni-app 生态） | wot-lynx-ui（现状） | 差距判定 |
|---|---|---|---|
| 令牌体系 | 三层：基础 `--wot-blue-6` → 语义 `--wot-primary-6` → 组件 `--wot-button-primary-bg` | 同构三层 `--wd-*`（primitive / semantic / component） | ✅ 已对齐 |
| 主题定制 | CSS 变量 + `ConfigProvider theme-vars` + **预设主题库**（shadcn / cartoon / nutui / vant / tdesign…） | CSS 变量 + `ConfigProvider themeVars` + 亮/暗双主题 | ⚠️ 缺**预设主题**与主题市场 |
| 多平台 | 微信/支付宝/钉钉小程序 + H5 + App（条件编译） | Lynx 双线程（iOS/Android/HarmonyOS/Web） | ➖ 路线不同，不可照搬 |
| 按需引入 | easycom 自动引入 | 源码分发 + Tree-shaking（`import 'wot-lynx-ui/theme'` 手动） | ⚠️ 缺自动按需插件 |
| 生态 | **wot-starter / @wot-ui/router / @wot-ui/cli / @wot-ui/unocss-preset / VS Code 插件 / CI 工具** | 仅组件库 + Demo + 文档 | ❌ **最大差距：无生态层** |
| 包组织 | `uni_modules` + npm `@wot-ui/ui` 双分发 | 单包 `wot-lynx-ui`，源码分发 | ⚠️ 缺预构建产物与子路径导出 |
| 设计取向 | V2 主打 **AI 友好度**（Skills + 结构化元数据） | 面向人类的 CONVENTIONS.md | ⚠️ 缺机器可读契约 |

**关键洞察**：wot-ui 的成功不在组件数量，而在**它把自己做成了一个生态（starter + router + CLI + 插件 + 预设主题）**。`wot-lynx-ui` 若只做"组件集合"，长期天花板就是"另一套组件库"；要做成平台，必须在架构里预留**生态层**。

### 1.4 必须固化的平台不变量（Lynx 硬约束）

这些是 Lynx 引擎的物理事实，是**架构级约束**，必须从"文档知识"升级为"机器守护"：

| # | 不变量 | 当前守护方式 | 风险 |
|---|---|---|---|
| I1 | `SET_STYLE` 是**逐属性合并**，省略键不清除已应用内联样式 | 仅 CONVENTIONS 注释 + 两处组件注释 | 🔴 已致 6 处缺陷 |
| I2 | 字符串 `:style` 被静默丢弃，只认对象 | CONVENTIONS §19 + 回归测试 | 🟡 部分覆盖 |
| I3 | 无 Main Thread Script（MTS 不可用且会崩） | `no-main-thread-script.test.ts`（**已失效**：7 个用例全超时） | 🔴 防线形同虚设 |
| I4 | `<svg :content>` 元素白名单（svg/g/path/rect/circle/polyline） | `sanitizeSvgContent()` 运行时兜底 | 🟡 仅运行时降级 |
| I5 | 无 `::before/::after`、无 `:nth-child`、无 `!important` | review-lint 部分规则 | 🟡 规则不全 |
| I6 | 默认 `linear` 布局，弹性属性必须挂 `display:flex` | CONVENTIONS §15 | 🟡 无守护 |
| I7 | 事件注册表只容忍函数，同名监听合并成数组会崩 | 4 份回归测试（矩阵覆盖） | ✅ 守护良好 |
| I8 | kebab-case 标签被当原生元素 | 标签转换插件 + 测试 | ✅ 守护良好 |

### 1.5 现状的架构性问题（按严重度）

| 级别 | 问题 | 证据 |
|---|---|---|
| 🔴 P0 | **契约重复**：组件清单在 `index.ts` 维护两遍（import 列表 + `components` 数组），101 个组件手工同步 | `index.ts:399-411` |
| 🔴 P0 | **系统性缺陷模式无架构约束**：「条件写样式 + SetStyle 合并语义」同类缺陷已在 6 个组件复现，却只能靠人眼审查 | `CODE_REVIEW` 第三节 |
| 🔴 P0 | **守卫测试失效**：`no-main-thread-script.test.ts` 因无缓存全库读盘 7 次 → 全超时，CI 假红/被忽略 | `CODE_REVIEW` 第七节 |
| 🟠 P1 | **平台差异无抽象**：`uni.ts` 兼容层 + `useDeviceInfo` + 各处 `host` 分支，无统一 `PlatformAdapter` 契约，无法测试替身 | `common/uni.ts`、`useDeviceInfo.ts` |
| 🟠 P1 | **单包单体**：101 个组件同生共死，无法独立版本、无法按域拆分团队、无法选择性采纳 | `packages/ui/package.json` |
| 🟠 P1 | **无预构建产物**：`main` 指向 `.ts` 源码，非 Rspeedy 消费方（纯 Vite/webpack/CI 静态分析）无法直接使用 | `package.json exports` |
| 🟠 P1 | **测试环境极慢**：全套 582s，其中 `collect` 1027s、`environment` 2130s，是 `tests` 197s 的 10 倍以上 | `CODE_REVIEW` 第七节 |
| 🟡 P2 | **无版本与发布工程**：无 changesets、无 release workflow、无迁移 codemod、无 API 稳定性策略 | 仓库根目录 |
| 🟡 P2 | **无架构决策记录（ADR）**：`pnpm.overrides` 把 `vue-lynx` 锁死 0.5.1 等决策无留痕 | `package.json` |
| 🟡 P2 | **无视觉回归**：`__web_preview` 截图靠人工核对（CONVENTIONS §15 提到手动截图） | 无自动化 |

---

## 2. 架构目标与原则（North Star）

### 2.1 质量属性优先级（架构师排序）

大型组件库的架构取舍，按此优先级裁决：

1. **可扩展性（Extensibility）** — 组件从 101 → 300 时，架构成本应接近线性而非指数。
2. **稳定性（Stability）** — 平台约束不可违反（崩溃 > 样式错 > 功能缺），API 兼容是底线。
3. **可维护性（Maintainability）** — 新人能在 1 天内产出合规组件；契约变更只需改一处。
4. **性能（Performance）** — 高频交互跟手、首屏可接受、包体可控。
5. **生态友好（Ecosystem）** — 机器可读、可被工具链消费、可被 AI 消费。

### 2.2 六条架构原则

| 原则 | 含义 | 反例（当前违反） |
|---|---|---|
| **P1 单一来源** | 任何事实只在一处定义，其余靠生成 | 组件清单维护两遍 |
| **P2 依赖单向** | 上层依赖下层，绝不反向；层内可并行 | 无强制，仅文档约定 |
| **P3 显式契约** | 平台能力、组件 API、父子通信都必须是可类型化、可测试的显式契约 | `uni.ts` 隐式兼容层 |
| **P4 失败降级而非崩溃** | 平台不支持的能力给出降级路径并留痕 | SVG 白名单已有兜底，其余散落 |
| **P5 约束机器化** | 文档里的每一条硬规则，都要有 lint / 测试守护 | I3/I5/I6 无守护 |
| **P6 演进优先** | 架构改动必须可增量交付、可回滚，不推倒重来 | — |

### 2.3 架构不变量（Architecture Invariants）

以下不变量**在任何阶段都必须成立**，违反即视为架构回归：

- **INV-1 依赖无环**：`components → composables → common/platform → styles`，任何反向 import 都是错误。
- **INV-2 样式出口唯一**：组件不得直接拼装内联样式对象下发；一律经 Style Funnel。
- **INV-3 平台能力经适配层**：组件不得直接读 `SystemInfo` / `uni` / 宿主全局，必须经 `PlatformAdapter`。
- **INV-4 契约有源**：组件的 props / events / slots / 元信息由 `meta` 单一来源驱动生成物。
- **INV-5 零 MTS**：`src/` 下不得出现 `main-thread` / worklet 相关代码。
- **INV-6 API 兼容**：`wd-*` 组件的 props / events / slots / 类名与 wot-ui 对齐（差异须在 `differences.md` 登记）。

---

## 3. 目标架构（To-Be）

### 3.1 分层架构（L0–L5）

```
┌───────────────────────────────────────────────────────────────────────┐
│ L5  交付与生态层                                                        │
│     demo / docs / device-test / cli / rspeedy-plugins / unocss-preset  │
├───────────────────────────────────────────────────────────────────────┤
│ L4  组件层  @wot-lynx/components-*                                     │
│     basic · form · display · feedback · navigation · data-viz          │
│     （每个组件 = meta.ts + types.ts + *.vue + index.scss）              │
├───────────────────────────────────────────────────────────────────────┤
│ L3  组合式层  @wot-lynx/composables                                    │
│     useParent/useChildren · useTouch · usePopover · useFormDisabled …  │
│     （父子契约、交互行为、可复用逻辑；不含 UI）                          │
├───────────────────────────────────────────────────────────────────────┤
│ L2  基础能力层  @wot-lynx/runtime                                      │
│     Style Funnel · Platform Adapter · util · props · 日期 · 过渡兼容    │
│     @wot-lynx/icons · @wot-lynx/locale                                 │
├───────────────────────────────────────────────────────────────────────┤
│ L1  平台适配层  (runtime 子模块)                                        │
│     LynxAdapter · WebAdapter · (HarmonyAdapter) · MockAdapter(测试)     │
├───────────────────────────────────────────────────────────────────────┤
│ L0  设计系统层  @wot-lynx/tokens                                       │
│     primitive → semantic → component；预设主题；JS 镜像                │
└───────────────────────────────────────────────────────────────────────┘
        ▲ 依赖方向只能向上依赖（下层不得 import 上层）
```

**依赖规则（INV-1）**：

```
L5 ──▶ L4 ──▶ L3 ──▶ L2 ──▶ L1 ──▶ L0
                      └──────────────▶ L0
```

- L0/L1/L2 是**平台无关 / 平台适配**能力，不得 import 任何组件或 composable。
- L3 可 import L2，不得 import L4。
- L4 可 import L3/L2/L1/L0，**组件之间不得互相 import 实现**（只能通过 L3 契约通信）。
- L5 可 import 全部。

### 3.2 目标包结构（8 个 workspace 包）

> **重要判断**：**不要一步拆到底**。拆分必须由「收益 > 成本」触发。下表给出**目标态**与**拆分时机**，迁移路径见 §5。

| 包 | 内容 | 拆分时机 | 理由 |
|---|---|---|---|
| `@wot-lynx/tokens` | `styles/tokens` + 预设主题 + `common/theme.ts` JS 镜像 | **Phase 2**（优先） | 设计系统是最高复用层，独立后 demo/docs/生态都能消费，且**必须与 SCSS 同源** |
| `@wot-lynx/runtime` | `common/*`（util/props/过渡/uni）+ **Style Funnel** + **Platform Adapter** | **Phase 2**（优先） | 骨架能力，独立后可被任何 Lynx 应用复用（非组件库也能用） |
| `@wot-lynx/composables` | `src/composables/*` | **Phase 2** | 契约层，独立后组件包瘦身，契约变更影响面清晰 |
| `@wot-lynx/icons` | `src/icons/*` + 字体资产 | **Phase 2** | 资产包（.ttf），独立发布避免组件包体积膨胀 |
| `@wot-lynx/locale` | `src/locale/*` | **Phase 3** | 社区可独立贡献语言包 |
| `@wot-lynx/components` | `src/components/*`（全量）+ 生成的 barrel | **Phase 2 保留**，Phase 3+ 可选按域拆分 | 组件是主体，先保整包降低迁移风险 |
| `@wot-lynx/cli` | 组件脚手架 / barrel 生成 / 文档生成 / 图标生成 / 迁移 codemod | **Phase 2** | 把 `scripts/*` 产品化为可分发 CLI |
| `@wot-lynx/rspeedy-plugins` | 标签转换 + 按需引入 + MTS 守卫 | **Phase 3** | 生态入口 |
| `wot-lynx-ui`（保留） | 兼容层：re-export 上述包，保证存量用户零改动 | 全程保留 | **向后兼容锚点** |

**按域拆组件包**（`components-form` / `components-display` …）**暂不做**：101 个组件的规模下，拆域带来的版本管理成本 > 收益。触发条件：**单域组件数 > 40 或 单域团队 > 3 人**。

### 3.3 横切骨架一：样式解析层（Style Funnel）

**这是本次架构设计中最重要的一块**，直接消灭 `CODE_REVIEW` 第三节的**系统性缺陷模式**。

**根因回顾**：Lynx `SET_STYLE` → `__SetInlineStyles` 是 `Object.assign` 逐属性合并，**省略的键不会清除元素上已应用的内联属性**。因此「`if (cond) style.x = ...`」在 cond 由真转假时留下脏值。已在 6 处复现（wd-segmented / wd-picker-view / wd-toast / wd-fab / wd-transition / wd-swipe-action）。

**架构解法**：把「写样式」从散落代码收敛为**唯一的出口**，并在出口处强制「完整键集」语义。

```ts
// @wot-lynx/runtime/style —— Style Funnel
type StyleSource = Record<string, string | number | undefined>

/**
 * 合并多个样式源并**保证键集完整**。
 * - reset 中的键在缺省时会补中性值（如 transform → 'none'），
 *   从根本上杜绝「省略键 → 脏值残留」。
 * - 数组值直接替换，null/undefined 视为「显式清除」（写中性值）。
 */
export function resolveStyle(
  reset: StyleSource,        // 该元素可能被切换的全部键 + 其中性值
  ...sources: StyleSource[]
): StyleSource

/** 组件内定义「可切换样式键」的声明式清单 */
export function defineStyleKeys<T extends string>(neutral: Record<T, string>): StyleDecl<T>
```

**用法对比**：

```ts
// ❌ 现状（脏值风险）
const lineStyle = computed(() => {
  const style: Record<string, string> = {}
  const left = rects.slice(0, state.activeIndex).reduce((a, b) => a + b, 0)
  if (left) style.transform = `translateX(${left}px)`   // left===0 时不写 → 旧值残留
  return style
})

// ✅ 目标（Style Funnel 保证归位）
const LINE_STYLE = defineStyleKeys({ transform: 'translateX(0px)' })
const lineStyle = computed(() =>
  resolveStyle(LINE_STYLE, {
    transform: `translateX(${offset.value}px)`            // 无条件写，恒完整
  })
)
```

**配套机器守护**（review-lint 新增规则，见 §4）：

- `style-conditional-write`：禁止 `if (...) { style[...] = ... }` 与 `style.x = cond ? v : undefined` 模式。
- `style-direct-emit`：组件内 `:style="xxx"` 绑定的对象必须来自 `resolveStyle` / `filterStyle` / `parseStyle` 三者之一（白名单函数）。

### 3.4 横切骨架二：平台适配层（Platform Adapter）

把散落的平台差异收敛为**一个可类型化、可替换、可测试替身**的契约。

```ts
// @wot-lynx/runtime/platform
export interface PlatformAdapter {
  readonly name: 'lynx' | 'web' | 'harmony' | 'mock'

  /** 能力声明：组件据此降级，而不是各自 if (host) */
  readonly capabilities: {
    canvas2d: boolean
    svgGradient: boolean       // 白名单外元素是否可用（当前恒 false）
    pseudoElements: boolean    // 当前恒 false
    mainThreadScript: boolean  // 当前恒 false
    clipboard: boolean
    safeArea: boolean
  }

  measure(target: unknown): Promise<Rect>
  getSystemInfo(): SystemInfo
  navigate(to: string): Promise<void>
  pickMedia(opts: MediaOptions): Promise<MediaFile[]>
  // …按需扩展
}
```

- 默认导出 `lynxAdapter`；`configurePlatformAdapter(adapter)` 供宿主注入（**兼容现有 `configureUniAdapter`，旧 API 保留为薄封装**）。
- 测试环境注入 `mockAdapter`（`capabilities` 全 false → 强制走降级分支，天然覆盖降级路径）。
- **组件写法**：`if (!platform.capabilities.canvas2d) return fallback`，替代 `if (typeof canvas !== 'undefined')`。

### 3.5 横切骨架三：组件元数据（Component Meta）

把组件的**全部契约**收敛为一个机器可读的单一来源，驱动所有生成物（INV-4）。

```ts
// src/components/wd-button/meta.ts
import { buttonProps } from './types'

export const meta = defineComponentMeta({
  name: 'wd-button',
  title: '按钮',
  domain: 'basic',            // basic | form | display | feedback | navigation
  tier: 1,
  status: 'stable',           // draft | beta | stable | deprecated | removed
  since: '0.1.0',
  deprecated: null,
  props: buttonProps,         // ← 唯一 props 来源（types.ts 已是纯声明）
  events: [{ name: 'tap', desc: '点击' }],
  slots: [{ name: 'default' }, { name: 'icon' }],
  a11y: { role: 'button', states: ['disabled', 'loading'] },
  platformNotes: ['1ppx 细线', '禁用态不响应 :active'],
  wotCompat: { api: 'aligned', diff: [] }   // 与 wot-ui 的兼容声明
})
```

**一份 meta 驱动六处生成物**：

| 生成物 | 当前状态 | 由 meta 驱动后 |
|---|---|---|
| `src/index.ts` barrel（435 行） | 手写，重复清单 | 全自动生成，CI 校验一致性 |
| `docs/components/*.md`（101 篇） | `gen-docs.mjs` 半自动 | 全自动，props 表来自 meta |
| Demo 注册 + 真机清单 | 手写 | 自动注册，未覆盖即 CI 失败 |
| 全局注册数组（`index.ts:399`） | 手写 | 生成 |
| API 变更检测 / 迁移 codemod | 无 | meta diff → 自动生成 changelog + codemod |
| VS Code 智能提示 / AI 友好 | 无 | meta → JSON schema（对齐 wot-ui 的 AI 友好取向） |

### 3.6 构建与分发架构（双轨分发）

**问题**：`main` / `module` / `types` 全部指向 `./src/index.ts`，只有 Rspeedy 消费者可用。

**目标**：`exports` 条件导出，**源码优先、产物兜底**：

```jsonc
{
  "exports": {
    ".": {
      "source": "./src/index.ts",        // 条件导出：Rspeedy/支持 source 条件的构建器走源码（Tree-shaking 最优）
      "import": "./dist/index.mjs",      // 预构建 ESM（含 .d.ts）
      "types": "./dist/index.d.ts"
    },
    "./components/*": { "source": "./src/components/*", "import": "./dist/components/*/index.mjs" },
    "./theme": { "source": "./src/styles/theme/index.scss", "import": "./dist/theme/index.css" },
    "./tokens": "./dist/tokens/index.css",
    "./plugin": "./plugin/index.js",
    "./package.json": "./package.json"
  }
}
```

- **生成物不入库**：`index.css` 当前 104 个入库 + CI 校验一致性。建议改为**构建时生成**，`git` 只留 `.scss`（消除「手改生成物」与「忘记重生成」两类 CI 红灯）。若为兼容源码分发需保留，则保留但**强制 CI 校验**（已有）。
- **按需引入插件**（Phase 3）：`unplugin` 风格的 `@wot-lynx/rspeedy-plugins` —— 自动 import 组件 + 自动注入其 CSS，消除 `import 'wot-lynx-ui/theme'` 的手工负担（对齐 wot-ui 的 easycom 体验）。
- **版本工程**：`changesets` + release workflow；`meta.status` 驱动 deprecation 窗口（≥2 个 minor）；破坏性变更配 codemod。

### 3.7 主题与设计系统架构

保持现有三层令牌（**已与 wot-ui 对齐，不推翻**），补齐两块：

1. **预设主题**（对齐 wot-ui `presets.scss`）：
   ```
   @wot-lynx/tokens/presets/{default,dark,brand-a,compact,high-contrast}.scss
   ```
   消费者：`<WdConfigProvider theme="brand-a">`。当前 `theme` prop 只支持 `light|dark`，扩展为**主题名注册表**。
2. **令牌单一来源 + JS 镜像一致性**：`_primitive.scss` 与 `common/theme.ts` 当前是**两份手抄**。建议由 `_primitive.scss` **生成** `theme.ts` 色板常量（CLI 任务），CI 校验一致。

### 3.8 国际化架构

现状：`locale/` 16 种语言 + `useTranslate`。
补齐：
- **语言包契约校验**：所有语言包必须与 `zh-CN` 的 key 集合完全一致，CI 强制（缺 key / 多余 key 即失败）。
- **语言包独立贡献流程**：拆为 `@wot-lynx/locale`（Phase 3），社区可独立 PR。
- **懒加载**：大语言包按需加载（当前全量内置，包体随语言数线性增长）。

### 3.9 测试与质量架构

**测试金字塔（目标）**：

```
        ▲ 真机验收（device-test 8组35项，人工 + 可选自动化）
       ╱ 视觉回归（__web_preview 截图 diff，自动）
      ╱  契约测试（事件注册表矩阵、父子排序、meta 一致性）
     ╱   组件测试（双线程环境，交互回归）
    ╱    单元测试（纯函数：util / 格式化 / 编码器）
```

**必须补的三件事**：

1. **修好失效守卫**：`no-main-thread-script.test.ts` 把「读文件 + 去注释」缓存到 `describe` 作用域，只做一次；并设合理 timeout。（`CODE_REVIEW` 第七节已给出方案）
2. **测试提速**：`collect` 1027s + `environment` 2130s 是瓶颈。措施：jsdom 环境按文件复用、vitest 分片（`--shard`）、关闭不必要的 transform 缓存重建、把重环境用例与轻用例分 project。
3. **视觉回归**：`rspeedy dev` → `__web_preview` 截图 → 像素 diff。CONVENTIONS §15 已给出 `__web_preview?casename=` 的可用路径，只差自动化封装。**这是唯一能自动抓住「静默丢样式」类缺陷的手段**。

**性能预算（Phase 3 引入）**：为高频热路径（picker-view / slider / swipe-action）建立基准，断言「每帧分配次数」「getRect 调用次数」不超阈值。

### 3.10 治理与演进机制

- **ADR（架构决策记录）**：`docs/adr/NNNN-*.md`。每个架构决策（如"不做 MTS"、"vue-lynx 锁 0.5.1"、"不拆域包"）留痕，避免后人反复推翻。
- **组件生命周期**：`meta.status` 驱动 `draft → beta → stable → deprecated → removed`，配套发布策略。
- **CODEOWNERS 按域划分**：`basic` / `form` / `display` / `feedback` / `navigation` / `runtime` / `tokens` 各设 owner。
- **贡献阶梯**：修复 → 组件 → 域 → 架构（对齐 `contributing/code-review/`）。

---

## 4. 关键设计决策（ADR 摘要）

| ID | 决策 | 备选 | 结论与理由 |
|---|---|---|---|
| ADR-001 | 布局分层 + 依赖单向 | 保持平铺 | **采纳**。101→300 组件时，无层则腐化；成本仅为目录规整 + lint 规则 |
| ADR-002 | 分阶段拆包（Phase 2 起） | 立即全拆 / 永不拆 | **采纳分阶段**。立即全拆迁移风险高；永不拆则复用与版本治理无解 |
| ADR-003 | 组件域包**暂不拆** | 按 basic/form/… 拆 | **暂不拆**。触发条件：单域 >40 组件或 >3 人 |
| ADR-004 | Style Funnel 强制唯一出口 | 仅文档规范 | **采纳强制**。已被证明是系统性缺陷，文档规范不足 |
| ADR-005 | Platform Adapter 显式契约 | 保持 `uni.ts` 隐式 | **采纳**。可测试替身 + 未来平台复用 + 降级路径可覆盖 |
| ADR-006 | meta 作为契约单一来源 | 继续手写生成物 | **采纳**。消除重复清单 + 驱动 6 处生成物 + AI 友好 |
| ADR-007 | 双轨分发（source + dist） | 纯源码 / 纯产物 | **采纳双轨**。源码保 Tree-shaking，产物保工具链无关 |
| ADR-008 | 生成物 `index.css` 是否入库 | 入库 + CI 校验 / 不入库 | **建议不入库**（构建时生成）；若需保源码分发则保留入库 + CI 强校验 |
| ADR-009 | 继续零 MTS | 引入 MTS 提性能 | **维持零 MTS**。CONVENTIONS §10 已论证：可用性检测不可靠 + 跨线程竞态崩溃 + 配置负担 |
| ADR-010 | `vue-lynx` 锁 0.5.1 | 放开版本范围 | **维持锁定**，但升级需 ADR + 回归矩阵全绿后再放范围 |

---

## 5. 迁移路径（从 As-Is 到 To-Be）

**总原则（P6）**：每阶段独立可交付、可回滚、不阻塞功能开发。**任何阶段都不允许出现"大爆炸式重构"分支**。

### Phase 0 — 止血（1–2 周，与功能开发并行）

| # | 动作 | 产出 | 验收 |
|---|---|---|---|
| 0.1 | 修复 `CODE_REVIEW` P0-1..P0-4 | 4 处缺陷修复 + 回归测试 | 新增用例覆盖 deepMerge 数组/null、segmented 归位、tabs 首帧、debounce leading |
| 0.2 | 修复失效守卫测试 | `no-main-thread-script.test.ts` 缓存读盘 | 该文件全绿且 <10s |
| 0.3 | **barrel 自动生成**（INV-4 前置） | `scripts/gen-index.mjs` 生成 `src/index.ts` | 手工改 `index.ts` 会被 CI 拒绝 |
| 0.4 | 引入 Style Funnel（最小版） | `common/style.ts`：`resolveStyle` / `defineStyleKeys` | 先迁移 6 个已知受害组件 |
| 0.5 | review-lint 新增 2 条规则 | `style-conditional-write` / `style-direct-emit` | 存量按 baseline 豁免，增量强制 |
| 0.6 | 建立 ADR 目录 | `docs/adr/` + 本文件 ADR 摘要迁入 | 首个 ADR 合入 |

### Phase 1 — 内部边界（3–6 周）

| # | 动作 | 产出 | 验收 |
|---|---|---|---|
| 1.1 | 目录分层显式化 | `src/{components,composables,runtime,styles}` | 目录即分层 |
| 1.2 | review-lint 新增 `dep-direction` 规则 | 依赖方向守护 | 反向 import 即 CI 失败 |
| 1.3 | **Platform Adapter 落地** | `runtime/platform/` + `lynxAdapter` + `mockAdapter` | `uni.ts` 降级为薄封装；测试走 mock |
| 1.4 | **Component Meta 落地** | 101 个 `meta.ts` + 类型定义 | barrel / docs / demo 注册改由 meta 驱动 |
| 1.5 | 视觉回归最小闭环 | `__web_preview` 截图 diff 脚本 | 6 个样式受害组件先接入 |
| 1.6 | 测试提速 | vitest 分片 + 环境复用 | 全套 < 180s |

### Phase 2 — 包拆分与工具链（6–10 周）

| # | 动作 | 产出 | 验收 |
|---|---|---|---|
| 2.1 | 拆 `@wot-lynx/tokens` | tokens 包 + 预设主题 + JS 镜像生成 | demo/docs 消费新包；`theme.ts` 由 SCSS 生成且 CI 校验 |
| 2.2 | 拆 `@wot-lynx/runtime` | runtime 包（含 Style Funnel + Adapter） | 非组件库项目可独立使用 |
| 2.3 | 拆 `@wot-lynx/composables` | composables 包 | 契约变更影响面清晰 |
| 2.4 | 拆 `@wot-lynx/icons` | icons 包 + 字体资产 | 组件包体积下降 |
| 2.5 | `@wot-lynx/cli` 产品化 | scaffold / gen-index / gen-docs / gen-icons / codemod | 新组件一条命令生成骨架 |
| 2.6 | 双轨分发 | `dist/` 预构建 ESM + `.d.ts` | 非 Rspeedy 消费者可安装使用 |
| 2.7 | `changesets` + release workflow | 自动版本 / changelog / 发布 | 首个正式版本发布 |
| 2.8 | `wot-lynx-ui` 兼容层 | re-export 全包 | 存量用户零改动升级 |

### Phase 3 — 生态（3–6 个月）

| # | 动作 | 说明 |
|---|---|---|
| 3.1 | 按需引入插件 | `@wot-lynx/rspeedy-plugins`：自动 import + CSS 注入 |
| 3.2 | `@wot-lynx/locale` 拆分 + 语言包 CI 校验 | 社区可独立贡献 |
| 3.3 | 预设主题市场 | 对齐 wot-ui `presets.scss`（shadcn/nutui/vant/tdesign 风格） |
| 3.4 | UnoCSS preset | 对齐 wot-ui `@wot-ui/unocss-preset` |
| 3.5 | 组件域包拆分（**条件触发**） | 单域 >40 组件或 >3 人时执行 |
| 3.6 | 性能预算进 CI | 热路径基准断言 |
| 3.7 | 无障碍（a11y）体系 | meta.a11y 驱动，回归测试覆盖 |

### Phase 4 — 平台化（6–12 个月+）

| # | 动作 | 说明 |
|---|---|---|
| 4.1 | 多平台 Adapter | Harmony 专用适配 / 未来 Lynx 版本平滑升级 |
| 4.2 | 设计工具链 | Figma 令牌 ↔ `@wot-lynx/tokens` 双向同步 |
| 4.3 | AI 友好层 | meta → JSON schema / Skills，对齐 wot-ui V2 取向 |
| 4.4 | 企业主题与白标 | 多品牌主题 + 编译期裁剪 |
| 4.5 | 生态模板 | `create-wot-lynx` starter（对齐 wot-starter） |

---

## 6. 长期发展规划（Roadmap 总览）

| 阶段 | 时间 | 主题 | 关键里程碑 | 成功判据 |
|---|---|---|---|---|
| **Phase 0** | 1–2 周 | 止血 | P0 修复 + barrel 生成 + Style Funnel 最小版 | CI 全绿且真实有效；6 处样式缺陷修复 |
| **Phase 1** | 3–6 周 | 内部边界 | Platform Adapter + Component Meta + 视觉回归 | 依赖方向机器守护；契约单一来源；测试 <180s |
| **Phase 2** | 6–10 周 | 包拆分与工具链 | 4 个基础包拆分 + CLI + 双轨分发 + changesets | 首版发布；非 Rspeedy 消费者可用；新组件一条命令 |
| **Phase 3** | 3–6 月 | 生态 | 按需插件 + 预设主题 + locale 拆分 + a11y | 生态可扩展；社区可贡献语言包/主题 |
| **Phase 4** | 6–12 月+ | 平台化 | 多平台 Adapter + 设计工具链 + AI 友好层 | 平台无关；设计-代码同源；工具链可消费 |

**演进成熟度模型**（用于自评）：

```
L1 组件集合   →  L2 有规范的系统  →  L3 有契约与边界  →  L4 有生态  →  L5 平台
   当前在此 ──────▲                    (Phase 1)         (Phase 2-3)   (Phase 4)
```

---

## 7. 风险与对策

| 风险 | 等级 | 对策 |
|---|---|---|
| 拆包引入循环依赖 / 版本地狱 | 高 | 分阶段拆；`wot-lynx-ui` 兼容层全程保留；拆包前先做依赖图审计 |
| Style Funnel 迁移引入新回归 | 中 | 先迁移 6 个已知受害组件 + 视觉回归守护；存量 baseline 豁免 |
| meta 改造工作量被低估（101 个） | 中 | 脚本从 `types.ts` **自动生成 meta 骨架**，人工只补 events/slots/a11y |
| 视觉回归基线抖动（跨平台渲染差异） | 中 | 只对 Web 预览做基线；容差阈值 + 稳定用例集 |
| 平台适配层抽象过度 | 中 | 只抽象**已被 2 个以上组件用到**的能力；YAGNI |
| Lynx 引擎版本升级（vue-lynx 0.5.1 锁定） | 中 | 升级前跑事件矩阵 + 视觉回归；升级即 ADR |
| 生态层投入分散核心组件质量 | 低 | Phase 0-2 不动生态；生态只在核心稳定后启动 |

---

## 8. 落地清单（可直接转 Issue）

**Phase 0（本周）**

- [ ] 修复 `deepMerge` / `isObj`（`common/util.ts:628,26`）+ 单测
- [ ] 修复 `debounce` leading 语义（`util.ts:684`）+ 单测
- [ ] 修复 `wd-segmented` 滑块归位 + 回归
- [ ] 修复 `wd-tabs` 指示线首帧（`onMounted` 补调 `updateLineStyle`）+ 回归
- [ ] 修复 `no-main-thread-script.test.ts` 读盘缓存 + timeout
- [ ] 新增 `scripts/gen-index.mjs`，`src/index.ts` 改为生成物 + CI 一致性校验
- [ ] 新增 `common/style.ts`（`resolveStyle` / `defineStyleKeys`）
- [ ] 迁移 6 个样式受害组件到 Style Funnel
- [ ] `review-lint.mjs` 新增 `style-conditional-write` / `style-direct-emit`
- [ ] 建立 `docs/adr/`，迁入本文 ADR 摘要

**Phase 1**

- [ ] 目录分层：`runtime/` 独立出来
- [ ] `review-lint` 新增 `dep-direction`
- [ ] `runtime/platform/`：`PlatformAdapter` + `lynxAdapter` + `mockAdapter`
- [ ] `defineComponentMeta` + 101 个 `meta.ts`（脚本生成骨架）
- [ ] barrel / docs / demo 注册改由 meta 驱动
- [ ] `__web_preview` 视觉回归脚本 + 6 个组件接入
- [ ] vitest 分片 + 环境复用，全套 <180s

**Phase 2**

- [ ] 拆 `@wot-lynx/tokens`（含预设主题 + JS 镜像生成）
- [ ] 拆 `@wot-lynx/runtime` / `@wot-lynx/composables` / `@wot-lynx/icons`
- [ ] `@wot-lynx/cli`（scaffold / gen-* / codemod）
- [ ] `dist/` 双轨分发 + `exports` 条件导出
- [ ] `changesets` + release workflow + 首个正式版本
- [ ] `wot-lynx-ui` 兼容层

---

## 附录 A：与 wot-ui 架构的对齐与分化

**对齐（保持一致，降低迁移成本）**：三层令牌体系 · props/events/slots/类名 · `ConfigProvider` 主题注入 · 命令式弹层 API（`useToast`/`useDialog`/`useNotify`）· `useParent`/`useChildren` 父子模式。

**分化（Lynx 平台特性，须在 `differences.md` 登记）**：双线程渲染模型 · 零 MTS 策略 · `1ppx` 细线 · 无伪元素（真实元素替代）· SVG 白名单 · 字体图标（`<text>` 字形）· 事件语义 `tap`（非 `click`）。

**应当借鉴 wot-ui 但当前缺失**：预设主题库 · 按需引入插件 · CLI 工具链 · UnoCSS preset · 生态模板 · AI 友好结构化契约。

---

## 附录 B：架构健康度自检表（每季度）

| 检查项 | 通过标准 |
|---|---|
| 依赖无环 | `dep-direction` 规则全绿 |
| 样式出口唯一 | `style-direct-emit` 全绿，无新增 baseline 豁免 |
| 零 MTS | `no-main-thread-script` 全绿且真实有效（非超时跳过） |
| 契约一致 | `gen-index` / `gen-docs` 生成物与源码零 diff |
| API 兼容 | `meta.wotCompat` 无未登记差异 |
| 测试健康 | 全套 <180s，无 flaky，无超时型失败 |
| 视觉回归 | 无未确认的像素 diff |
| 架构留痕 | 本季度所有架构决策有对应 ADR |
