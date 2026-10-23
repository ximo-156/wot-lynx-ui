# ADR-007 双轨分发（source + dist）

- **状态**：**已取代**（被 [ADR-014](./014-dist-is-bridge-not-build.md) 取代）
- **日期**：2026-10-16 ／ 取代：2026-10-23
- **相关**：`packages/ui/package.json`、`scripts/check-exports.mjs`

> ⚠️ **本文的「决策」段落有一处事实错误**：`dist` 并非「预构建 ESM + `.d.ts`」，
> 而是只含 re-export 的入口桥接层。`exports` 的 `source` 子路径也曾指向目录，
> 导致主分发路径实际不可用。详见 ADR-014。以下为历史记录，未作修改。


## 背景

`main` / `module` / `types` 全部指向 `./src/index.ts`，只有 Rspeedy 消费者可用。纯 Vite / webpack / CI 静态分析无法直接消费 `.ts` 源码（尤其 `.vue` 单文件组件）。

同时，`exports` 声明了 `"import": "./dist/index.mjs"`，但 `packages/ui/dist/` **从未产出**——这是「声明了但没兑现」的契约缺陷，消费者一旦走到 `import` 条件就会报模块找不到。

## 决策

**双轨分发，源码优先、产物兜底**：

```jsonc
".": { "source": "./src/index.ts", "import": "./dist/index.mjs", "types": "./dist/index.d.ts" }
```

- 支持 `source` 条件的构建器（Rspeedy）走源码 → Tree-shaking 最优。
- 其他构建器走 `dist` 预构建 ESM + `.d.ts`。

配套两项强制措施：

1. **`sideEffects` 必须限定为 `["**/*.css", "**/*.scss", "**/*.ttf"]`**。写成 `true` 会关闭整个包的 tree-shaking，`import { WdButton }` 会拉入全部 107 个组件。
2. **`scripts/check-exports.mjs` 校验「声明 vs 实际」**：默认校验源码侧目标，`--built` 校验 dist 产物。声明了不存在的产物必须由机器拦住，而不是等用户报 bug。

## 后果

- 需要维护两套构建产物，CI 时间增加。
- `source` 条件是非标准字段，依赖构建器支持（Rspeedy 支持；其他构建器会忽略并落到 `import`）。

## 推翻条件

- 生态统一支持 `source` 条件 → 可去掉 `dist`，退回纯源码分发。
- `dist` 与 `src` 行为不一致（构建产物 bug）频发 → 应改为「只发产物」，源码仅供内部。
