# 架构快照

> ⚠️ 本文件由 `scripts/gen-snapshot.mjs` 自动生成，请勿手动编辑。
> CI 通过 `node scripts/gen-snapshot.mjs --check` 断言本文与代码一致。
>
> 为什么要有这个文件：`ARCHITECTURE.md` v1.0 是手写快照，在两次全库重写后漂移了 6 处，
> 其中「零 MTS」一条持续误导实现（见 `docs/adr/009-zero-mts.md`）。凡能数出来的事实，交给机器。

## 组件

| 项 | 数值 |
|---|---|
| 基础件（L3.5 `src/primitives/`） | 12 |
| 业务组件（L4 `src/components/`） | 94 |
| **组件总数** | **106** |

> ⚠️ `src/components/` 下存在非 `wd-*` 目录：`wot-ui`（建议清理）

## 源码规模

| 层 | .vue | .ts | .scss | 合计 |
|---|---|---|---|---|
| 基础件 | 1733 | 1289 | 1871 | 4893 |
| 业务组件 | 21962 | 12321 | 10852 | 45135 |
| **合计** | **23695** | **13610** | **12723** | **50028** |

## 基础能力

| 项 | 数值 |
|---|---|
| composables | 23 |
| common 模块 | 16 |
| 语言包 | 17 |
| 预设主题文件 | 4 |
| 测试文件 | 87 |
| lint 规则 | 28 |
| 使用声明式 MTS 的组件 | 12 |

## 横向依赖

| 指标 | 数值 | 目标 |
|---|---|---|
| 去重依赖边 | 157 | — |
| 业务 → 基础件 | 97 | ↑ |
| 业务 ↔ 业务 | 48 | ≤ 60（拆包 ≤ 30） |
| 契约借用 | 0 | 0 |
| **跨族循环依赖** | **0** | **0** |
| 族内环（父子组件对） | 5 | 允许 |
| 组件族 | 15 | — |
| 基础件反向依赖 | 0 | 0 |

## 生成物与契约

| 路径 | 状态 |
|---|---|
| `src/index.ts` | ✅ 存在 |
| `src/components/index.ts`（生成） | ✅ 存在 |
| `src/primitives/index.ts`（生成） | ✅ 存在 |
| `docs/adr/` | ✅ 存在 |
| `dist/`（构建产物，不入库） | ✅ 存在 |

## 复现方式

```bash
node scripts/analyze-deps.mjs        # 依赖图 → DEPS.md + deps-baseline.json
node scripts/gen-snapshot.mjs        # 本文件
node scripts/check-exports.mjs       # exports 声明 vs 实际
```
