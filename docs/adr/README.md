# 架构决策记录（ADR）

本目录记录 `wot-lynx-ui` 的**架构级决策**：为什么这样组织、放弃了哪些备选、什么条件下应该重新审视。

## 为什么需要 ADR

本仓库曾在 5 天内经历两次全库级重写（`a00b6b9` 全量对齐 wot-ui 2.3.2、`7658d0c` 全组件原生优先）。重写本身是必要的，但**决策理由没有留痕**，导致 `ARCHITECTURE.md` v1.0 中「零 MTS」这类断言在重写后依然存在，持续误导实现与评审。

ADR 的目的不是记录「做了什么」（代码里有），而是记录**「当时为什么这么选」和「什么条件下该推翻」**。

## 规则

1. **一个决策一篇**，编号递增，永不删除。
2. 决策被推翻时，**不修改原文**，而是新增一篇并标注 `取代 ADR-XXX`，同时在原文顶部标注 `已被 ADR-XXX 取代`。
3. 状态取值：`提议` / `已采纳` / `已撤销` / `已取代`。
4. 每篇必须包含**推翻条件**（什么情况下应该重新决策）——这是 ADR 最有价值的部分。
5. 架构变更的 PR 若涉及新增/推翻决策，必须同时提交 ADR。

## 索引

| ID | 标题 | 状态 |
|---|---|---|
| [001](./001-layered-architecture.md) | 布局分层与依赖单向 | 已采纳 |
| [002](./002-phased-package-split.md) | 分阶段拆包 | 已采纳 |
| [003](./003-no-domain-package-split.md) | 组件域包暂不拆 | 已采纳（前提修正） |
| [004](./004-style-funnel.md) | Style Funnel 强制唯一出口 | 已采纳（已落地） |
| [005](./005-platform-adapter.md) | PlatformAdapter 显式契约 | 已采纳（**范围收敛**，见 015） |
| [006](./006-component-meta.md) | meta 作为契约单一来源 | 已采纳（改为推导式，见 017） |
| [007](./007-dual-distribution.md) | 双轨分发（source + dist） | **已取代**（被 014 取代） |
| [008](./008-generated-css-not-committed.md) | 生成物 `index.css` 不入库 | 已采纳 |
| [009](./009-zero-mts.md) | 零 MTS | **已撤销**（被 011 取代） |
| [010](./010-pin-vue-lynx.md) | `vue-lynx` 锁定 0.5.1 | 已采纳 |
| [011](./011-declarative-mts.md) | 声明式 MTS 为跟手交互唯一形态 | 已采纳 |
| [012](./012-primitives-layer.md) | 引入 L3.5 Primitives 层 | 已采纳 |
| [013](./013-declarative-families.md) | 组件族声明式化（`families.json` 单一来源） | 已采纳 |
| [014](./014-dist-is-bridge-not-build.md) | `dist` 是入口桥接层，不是编译产物（取代 007） | 已采纳 |
| [015](./015-platform-capabilities-scope.md) | PlatformAdapter 只落地 capabilities，方法层不做 | 已采纳 |
| [016](./016-theme-presets-on-demand.md) | 预设主题按需引入，不进主包 | 已采纳 |
| [017](./017-meta-derived-from-source.md) | 组件契约由源码推导，产物是 JSON | 已采纳 |
| [018](./018-docs-generated-from-meta.md) | 文档由 meta 生成，侧边栏是唯一组件清单 | 已采纳 |
| [019](./019-api-diff-and-codemod.md) | API 变更检测走语义 diff，codemod 只做等价改写 | 已采纳 |
| [020](./020-visual-regression.md) | 视觉回归拍组件区域而非整页，基线按平台隔离 | 已采纳 |
| [021](./021-test-isolation-and-sharding.md) | 测试环境复用（`isolate: false`）+ LPT 分片 | 已采纳（附顺序无关取证要求） |
