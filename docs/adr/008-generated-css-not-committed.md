# ADR-008 生成物 `index.css` 不入库

- **状态**：已采纳
- **日期**：2026-10-16
- **相关**：`scripts/build-css.mjs`、`.github/workflows/ci.yml`

## 背景

每个组件目录同时存在 `index.scss`（源）与 `index.css`（构建产物），且 `.css` 入库（104 个）。组件 `.vue` 顶部 `import './index.css'`。

带来两类 CI 红灯：

1. 有人**手改**了 `.css`，下次构建被覆盖 → 改动静默丢失。
2. 有人改了 `.scss` 但**忘记重生成** `.css` → 源码与产物不一致。

## 决策

`.css` 为**构建时生成物，不入库**，`git` 只保留 `.scss`。

- `build-css.mjs` 在 `dev` / `build` / CI 前生成。
- CI 校验「生成物与源一致」，防止手改。

**兼容例外**：若为保源码分发（消费者直接吃 `src/`）而必须入库，则**保留入库但强制 CI 校验**——二者必居其一，不允许「入库且不校验」。

## 后果

- 首次 clone 后必须先跑 `pnpm build:css`，否则 `.vue` 的 `import './index.css'` 解析失败。这是新增的启动成本，需在 README 与 CI 中显式说明。
- 仓库体积下降，diff 噪音消失。

## 推翻条件

- 消费者普遍直接吃 `src/` 且不愿跑构建 → 回退为「入库 + CI 强校验」。
