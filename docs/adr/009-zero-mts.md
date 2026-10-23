# ADR-009 零 MTS

- **状态**：**已撤销**（被 [ADR-011](./011-declarative-mts.md) 取代）
- **日期**：2026-10-16 ／ 撤销：2026-10-19（代码）／ 2026-10-22（文档）
- **相关**：ADR-011、`CONVENTIONS §10`

## 背景（历史记录）

2026-10-16 的决策是「完全不使用 Main Thread Script」：`src/` 下不得出现 `main-thread` / worklet 相关代码，全部交互走后台线程。理由是：

1. `lynxWorkletImpl` 可用性检测不可靠（后台线程恒为 `undefined`）；
2. 命令式 `runOnMainThread` 存在跨线程竞态（`INIT_MT_REF` ops 与 worklet 派发无顺序保证，refMap 未就绪时崩溃，真机 1101）；
3. 配置负担（`includeWorkletPackages` 白名单）。

## 为什么被撤销

上述三条理由**都成立，但结论过度**：它们证明的是「命令式跨线程 API 不可用」，而不是「MTS 不可用」。

Lynx 官方的**声明式** MTS（`main-thread-bind*` + `useMainThreadRef` + `'main thread'` 指令）由框架在建树时注册，**不经**上述竞态路径，同时提供真正的原生跟手性能（事件在主线程直接派发，零线程跨越；后台线程方案每帧两次线程往返，低端机手感明显滞后）。

2026-10-19 提交 `7658d0c`（全组件原生优先重写）已在 12 个组件中落地声明式 MTS。`CONVENTIONS §10` 同日改写为「声明式唯一形态」。

## 后果

- `ARCHITECTURE.md` v1.0 的 INV-5 与 ADR-009 在 10-16 至 10-22 期间持续误导实现与评审（文档漂移 C1）。
- 保留的有效结论：**禁止命令式** `runOnMainThread` / `runOnBackground` / `lynxWorkletImpl`（由 `js/mts-imperative` 规则守护）。

## 教训（本 ADR 的主要价值）

**「某条路径有缺陷」不等于「整个机制不可用」。** 决策时应把机制拆到「具体用法」粒度，否则会因一个危险用法放弃整类能力，并在文档中留下会误导后人的强断言。

这也是本仓库引入 ADR 机制的直接动因：撤销决策必须留痕，否则原文会继续被当作事实引用。
