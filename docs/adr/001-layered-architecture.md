# ADR-001 布局分层与依赖单向

- **状态**：已采纳
- **日期**：2026-10-16
- **相关**：ADR-012、`ARCHITECTURE.md §3.1`

## 背景

101 个组件平铺在 `src/components/` 下，基础能力（`util` / `props` / `style`）、组合式函数（`useParent` / `useTouch`）、设计令牌（`styles`）与组件同处一层，没有声明的依赖方向。

组件数继续增长时，若基础模块可以反向 import 组件，会出现「改一个工具函数导致全库编译失败」的连锁反应，且无法判断某模块的稳定程度。

## 决策

按职责分为五层，依赖只能单向向上：

```
components → composables → common → styles
```

- `common/` 不得 import `components/` 或 `composables/`
- `composables/` 不得 import `components/`
- 组件之间不得互相 import 实现（**此条在 ADR-012 中修正**）

用 `review-lint.mjs` 的 `dep-direction` 规则（error 级）机器守护，不依赖文档约定。

## 后果

**正面**

- 2026-10-22 实测：`common/` 与 `composables/` 的反向 import 均为 **0 处**，层间依赖健康。
- 基础模块可被非组件场景复用（这是后来 `@wot-lynx/runtime` 拆分的前提）。

**负面**

- 跨层共享类型需要显式下沉，写代码时多一步。

## 推翻条件

- 出现「必须跨层共享」的类型且下沉成本高于收益（此时应新增一层，而不是允许反向 import）。
- 分层数量超过 6 层，导致依赖规则无法用简单正则表达。
