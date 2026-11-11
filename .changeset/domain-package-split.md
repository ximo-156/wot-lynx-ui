---
"wot-lynx-ui": minor
---

域包拆分（ADR-023）：门面 `wot-lynx-ui` 保持不变，组件迁入 `@wot-lynx/*` 分包。

- 满足 ADR-003 的依赖图门槛后执行域包拆分：`@wot-lynx/core`（common /
  composables / icons / locale / styles）、`@wot-lynx/primitives`（24 基础件）、
  `@wot-lynx/ui-layout|display|nav|form|feedback|picker`（81 业务组件），
  门面保留 barrel、`wotLynxUI` 全局注册插件、`theme` 入口与 `wd-config-provider`。
- 包级依赖图为 DAG：跨包业务边 4 条（form→layout、form→display、
  display→layout、picker→display），零环；组件级「业务↔业务」边 28
  （评审 §12 拆包门槛 ≤30，`analyze-deps` 双口径输出）。
- **破坏性变更**：组件深导入子路径改变——`wot-lynx-ui/components/wd-x`、
  `wot-lynx-ui/primitives/wd-x` 改为 `@wot-lynx/ui-<domain>/wd-x`、
  `@wot-lynx/primitives/wd-x`（barrel 与全局注册不受影响；每个组件目录
  现有统一 `index.ts` 入口，默认导出与命令式 API 同路径）。
- SCSS 主题依赖改为 load-path 式 `@use 'styles/...'`（`styles/` 住在
  `@wot-lynx/core`）；预编译 CSS 仍是消费者主路径，深度自定义需配合
  core 包的 load path。
