# ADR-023 组件域包拆分

- **状态**：已采纳（2026-11-11）
- **日期**：2026-11-11
- **相关**：ADR-002（分阶段拆包）、ADR-003（域包拆分门槛，本文满足其触发条件）、ADR-012（Primitives 层）、ADR-013（组件族）、`docs/architecture/packages.json`

## 背景

2026-10-22 架构评判定性：「拆域包**做不了**，不是暂不做」——按域切分后包依赖图立刻成环，
真实障碍是 153 条业务↔业务边 + 5 个跨族环，而非版本管理成本。ADR-003 随之把触发条件
从「单域 > 40 组件」改为依赖图门槛：**业务↔业务边 ≤ 60 且跨族环 = 0**。

此后两轮收敛已把该门槛从「不可达」变成「已超额满足」：

| 阶段 | 动作 | 业务↔业务边 | 跨族环 |
|---|---|---|---|
| 评审基线（10-22） | — | 153 | 5 |
| ADR-012 primitives 层（10-23） | 12 件下沉 | 48 | 0 |
| building-block 提升（11-11 上午） | 14 件下沉 primitives（action-sheet / toast / tabs 族 / sticky 族 / checkbox 族 / radio 族 / switch / search） | **28** | 0 |
| 域包拆分（11-11 下午） | 81 件迁入 6 个域包，门面留 config-provider | 28（不变） | 0 |

评审 §12 的 P4 前门槛是 ≤ 30；当前 28，已达标。拆分后组件级耦合不变
（同一批边换了包名形式），**包级依赖图实测为 DAG：跨包业务边 4 条**
（form→layout、form→display、display→layout、picker→display），零环。
`analyze-deps` 同时输出两个口径：组件级「业务↔业务 28」与包级「跨包 4」，
后者才是拆包后团队并行/独立发布的真实边界。

## 决策

**按域拆分组件包，门面 `wot-lynx-ui` 保持零感知兼容。** 包划分声明于
`docs/architecture/packages.json`（只声明包边界，组件归属由文件系统位置决定，
不引入第二份手写清单）：

```
@wot-lynx/core        infra      common / composables / icons / locale / styles（无组件）
@wot-lynx/primitives  基础件      24 件（不得依赖任何 domain 包）
@wot-lynx/ui-layout   布局        10 件
@wot-lynx/ui-display  展示        28 件
@wot-lynx/ui-nav      导航        13 件
@wot-lynx/ui-form     表单        15 件
@wot-lynx/ui-feedback 反馈        9 件
@wot-lynx/ui-picker   选择器      6 件（picker 族原子链）
wot-lynx-ui           门面        barrel + wotLynxUI 插件 + theme 入口 + wd-config-provider
```

1. **依赖方向**：domain → {infra, primitives, 下游 domain}；infra 不依赖任何组件包；
   primitives 不依赖 domain。包级 DAG 由 `review-lint` 与 `analyze-deps` 守护。
2. **公开 API 不变的部分**：barrel（`import { WdButton } from 'wot-lynx-ui'`）、
   全局注册（`createApp().use(wotLynxUI)`）、`wot-lynx-ui/theme`、`wot-lynx-ui/plugin`。
3. **破坏性变更**：组件深导入子路径从 `wot-lynx-ui/components/wd-x`、
   `wot-lynx-ui/primitives/wd-x` 改为域包路径 `@wot-lynx/ui-<domain>/wd-x`、
   `@wot-lynx/primitives/wd-x`。这与 2026-10-23 primitives 迁移改变
   `components/wd-icon` 深路径的先例一致；库处于 0.1.0，barrel 是文档化的主入口。
4. **组件间引用**：同包内保持相对路径；跨包引用走包名（`@wot-lynx/primitives/wd-icon`）。
   `analyze-deps` 扩展解析包名导入，指标从「业务↔业务边」升级为
   **「业务↔业务边 + 跨包边」双口径**：前者衡量组件级耦合（门槛 ≤30，当前 28），
   后者衡量包级耦合（拆分后 4）。两个数字都进 `DEPS.md` 与快照，不隐藏旧口径。
5. **SCSS 主题依赖**：`styles/` 随 core 包分发，组件 SCSS 的
   `@use '../../styles/variable.scss'` 改为 load-path 式 `@use 'styles/variable.scss'`；
   编译由 `build-css.mjs` 配置 loadPaths 完成。预编译 CSS 仍是消费者主路径
   （ADR-008），深度自定义需配合 `@wot-lynx/core` 的 load path——这是源码分发
   多包化的固有代价，记录在此不再视为缺陷。
6. **测试不随包拆分**：全部测试留在门面包 `packages/ui/test`（库级集成资产），
   经包名引用各包组件。拆分解决的是发布/团队边界，不是测试物理归属。

## 后果

**正面**

- 域包可独立版本、独立发布、按 CODEOWNERS 分配团队；门面包 re-export 保证存量用户零改动。
- 包级 DAG（4 条跨包边）使「新增域」变成加一个包，不再触碰其他域。
- 指标双口径让「组件级收敛」与「包级收敛」都可度量、可断言。

**负面**

- 一次性改写约 600 处 import（相对路径 → 包名）与全部组件 SCSS 的 `@use` 路径；
  回归面覆盖全部门禁（check:* / typecheck / 全量测试 / 双端构建）。
- 深导入子路径 breaking change，需要 changeset 与文档同步。
- 每包一份 `package.json` / 构建配置 / 版本号，兼容层（门面）长期存在。

## 推翻条件

- 某域被独立产品复用 → 优先拆该域独立发布，而非调整全域划分。
- 跨包边增长到需要二次提权（如 form 同时依赖 3 个以上 domain）→ 说明域边界划错，
  应重新聚类（把共用组件提升为 primitives），而不是放任包图变稠密。
- 门面 re-export 导致类型解析或 tree-shaking 出现实测回退 → 重新评估「门面保持
  零感知」这一承诺的代价。
