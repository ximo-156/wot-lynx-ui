# AI 开发指南：按任务读取与验证

本页面向维护 **wot-lynx-ui 仓库**的 AI/开发者，不是给消费者拼接的全量 API 文档。先读[根 AI 入口](<../../AGENTS.md>)，再按本页选择必要上下文。规则在原有规范、源码和有效 ADR 中维护，本页只提供导航与可执行流程。

本文件和局部 AGENTS 指引在 Git/文件系统中读取，[站点配置](<../.vitepress/config.ts>)不将其生成消费者页面；下列路径是仓库对照入口，不是承诺文档站存在同名路由。消费者 AI 的公开分块资料属于后续阶段。

## 1. 最小阅读路径

| 想做什么 | 先读 | 不要误用 |
|---|---|---|
| 理解项目/安装使用 | [项目说明](<../../README.md>)、[根配置](<../../package.json>)、[快速开始](<../guide/quick-start.md>) | 不猜 Vue/Node/pnpm 版本，不把全局标签当命名导出 |
| 修改组件 | [UI 指引](<../../packages/ui/AGENTS.md>)、[组件规范](<../../CONVENTIONS.md>)、目标 SFC/类型及相关测试 | 不只找 components，基础件在另一个根 |
| 修改事件/弹层 | [事件与平台规范](<../../CONVENTIONS.md>)、[fire-event](<../../packages/ui/test/fire-event.ts>)、[事件矩阵测试](<../../packages/ui/test/component/event-registry-all-components.test.ts>) | 合成 click、DOM 监听数组支持不证明真机行为 |
| 修改样式/主题 | [Style Funnel](<../../packages/ui/src/common/style.ts>)、[主题入口](<../../packages/ui/src/styles/theme/index.scss>)、[JS 镜像](<../../packages/ui/src/common/theme.ts>) | 不靠省略键清样式，不把品牌原色当所有语义色 |
| 修改跟手交互 | [MTS 决策](<../adr/011-declarative-mts.md>)、[组件规范 §10/§21](<../../CONVENTIONS.md>)、目标实现与 MTS/手势回归 | 不把 Vitest worklet 垫片当生产编译器，不泛化已记录的降级 |
| 修改原生/宿主能力 | [原生分层决策](<../adr/022-native-capability-layer.md>)、[native](<../../packages/ui/src/common/native.ts>)、[host](<../../packages/ui/src/common/host.ts>)、[platform](<../../packages/ui/src/common/platform.ts>) | 不恢复 uni 层，不把能力 getter 解构成静态快照 |
| 调整依赖/组件根 | [组件族决策](<../adr/013-declarative-families.md>)、[族声明](<../architecture/families.json>)、[脚本指引](<../../scripts/AGENTS.md>) | 族内环不等于回归，不自动更新基线放行 |
| 修改演示/文档 | [Demo 指引](<../../packages/demo/AGENTS.md>)或[文档指引](<../AGENTS.md>) | VitePress DOM 预览及源码别名不是 npm/真机契约 |
| 修改生成/迁移工具 | [脚本指引](<../../scripts/AGENTS.md>)及对应实现、独立测试 | 不手改下游产物，不让测试复制生产算法而假绿 |

[ARCHITECTURE](<../../ARCHITECTURE.md>)解释系统组织；[ADR 索引](<../adr/README.md>)解释决策状态。无需为每个小修复通读所有历史评审与路线图。

## 2. 按组件名定位

1. 在[生成 meta](<../../packages/ui/meta.json>)查组件键与 `layer`，或同时搜索[基础件根](<../../packages/ui/src/primitives/>)与[业务根](<../../packages/ui/src/components/>)。
2. 读组件类型、SFC 和 SCSS；事件参数、作用域插槽、实例方法可能只在源码声明，不能因 meta 未收录就认定不存在。
3. 核对[主入口](<../../packages/ui/src/index.ts>)、[基础件 barrel](<../../packages/ui/src/primitives/index.ts>)、[业务 barrel](<../../packages/ui/src/components/index.ts>)与[包 exports](<../../packages/ui/package.json>)，区分真实导出、局部别名和全局标签。
4. 在[测试目录](<../../packages/ui/test/>)找组件名/相关行为，选择相似实现和回归。按名称读产物的测试使用[双根 helper](<../../packages/ui/test/helpers/component-roots.ts>)。
5. 演示入口分别是[Showcase](<../../packages/demo/src/showcase/Showcase.vue>)、[设备清单](<../../packages/demo/src/device-test/App.vue>)和[文档预览 demos](<../.vitepress/theme/demos/>)；最后一种有 DOM 垫片/源码别名，不能直接作为消费者范例。

例如修改按钮，先读[按钮实现](<../../packages/ui/src/primitives/wd-button/wd-button.vue>)与[类型](<../../packages/ui/src/primitives/wd-button/types.ts>)，而不是从业务根猜目录。组件名清单仍由源码目录生成，本页不维护第二份 106 项列表。

## 3. 写入前记录现状

所有命令从仓库根执行。先确认已有改动、目标范围、生成物和验证层级：

```bash
git status --short
pnpm check:index
pnpm check:deps
pnpm check:meta
pnpm check:docs
pnpm check:snapshot
```

这些检查用于区分已有漂移与本次回归，不会修复内容。`check:docs` 仅查侧边栏；架构快照还依赖本地生成物存在状态和已有依赖基线，不能把它当完整架构语义证明。若检查失败，读报错及实现，不直接重置源码、覆盖用户改动或重建所有基线。

依赖已安装时不要重新安装/升级。新克隆按锁定依赖安装；缺少外部工具、浏览器或真机时记录前提，不宣称验收完成。

## 4. 哪些产物该生成

| 改动 | 正确上游与命令 | 产物/注意事项 |
|---|---|---|
| 组件样式或主题 | 修改 SCSS；`pnpm build:css` | CSS 入库且强制校验，禁止手改；不要生成无关 API 变更 |
| 新增/删除/迁移组件 | 改目录/源码；`pnpm gen:index` | 双根 barrel 是目录的函数，不从 meta 生成 |
| props/events/slots 或其说明 | 改源码/注释；`pnpm gen:meta` | meta 入库，保留真实代码优先的推导结果，不手填 |
| API 文档格式或 meta 已改变 | 改生成器/上游；`pnpm gen:docs` | 组件 Markdown 不入库；侧边栏入库；中文名称表缺项会报错 |
| 源码/测试规模发生变化 | `node scripts/gen-snapshot.mjs` | 生成快照再 `pnpm check:snapshot`；不能手改数字 |
| 分发入口或发布验证 | `pnpm build:ui` | 生成 dist 桥接层和 CSS；再检查 built exports |
| 用户指南/AI 指引文字 | 修改对应 Markdown | 不需要 `gen:meta`、重生成 CSS 或更新 API 基线 |

[gitignore](<../../.gitignore>)定义入库边界；[生成 meta 决策](<../adr/017-meta-derived-from-source.md>)及[生成文档决策](<../adr/018-docs-generated-from-meta.md>)解释来源。依赖/视觉/lint 基线是审查过的例外，不是“生成一次就通过”的按钮。

## 5. 常见任务的操作流程

### A. 修复组件行为

读局部指引与相关源码 → 先补或确认回归 → 小范围修复 → 按上表生成必要下游 → 跑目标测试及规范/类型检查。覆盖再次操作、状态翻转、迟到回调、卸载、降级，不只断言调用次数。

```bash
pnpm lint:conventions
pnpm typecheck
# 示例：单个组件 project 回归
pnpm --filter wot-lynx-ui exec vitest run --project component test/regression/overlay-tap-regression.test.ts
```

事件改动另外核对[父级 tap](<../../packages/ui/test/component/event-tap-registry.test.ts>)、[监听合并](<../../packages/ui/test/component/event-merge-props.test.ts>)和[全组件矩阵](<../../packages/ui/test/component/event-registry-all-components.test.ts>)；不能把组件公开 `click` 事件一律改名为 `tap`。

### B. 修改 API

```bash
pnpm gen:meta
pnpm gen:docs
pnpm check:meta
pnpm check:docs
pnpm api:diff
pnpm --filter wot-lynx-ui exec vitest run --project unit test/unit/meta-generated.test.ts
```

`api:diff` 不自动生成 meta；默认比较 HEAD 与工作区，已提交到 HEAD 的变更不在这个 diff 中。需要相对主分支或历史版本时显式传基准。破坏性变更、改名和适配差异需要理由，不让 codemod 猜迁移。

### C. 新增组件

```bash
# 先检查即将创建的位置，不覆盖已有组件
pnpm gen:component wd-xxx --title="中文名" --dry-run
# 确认目标后再创建；基础件显式加 --root=primitives
pnpm gen:component wd-xxx --title="中文名"
```

脚手架创建源码/测试并生成 CSS、barrel，**不代表组件、meta、文档和 Demo 已全部完成**。替换占位 props/模板，补中文名称表、可运行演示和设备覆盖，再生成 meta/文档/快照，运行依赖、导出与对应测试。官方参考中不存在的扩展不冒充官方兼容覆盖。

### D. 修改样式或主题

```bash
pnpm build:css
pnpm check:theme-mirror
pnpm --filter wot-lynx-ui exec vitest run --project unit test/unit/style-funnel.test.ts test/unit/theme-token-parity.test.ts
pnpm --filter wot-lynx-ui exec vitest run --project component test/regression/inline-style-regression.test.ts
pnpm docs:build
pnpm visual:check
```

视觉基线按平台、本机生成；新环境缺基线是“未比较”，不是通过。只有确认差异有意并得到对应设计批准，才更新基线。DOM 截图不能证明真机布局、闭态绘制或原生输入已正确。

### E. 修改线程、导出或宿主能力

除针对性测试外，需要真实双端构建：

```bash
pnpm check:exports
pnpm check:deps
pnpm build:ui
node scripts/check-exports.mjs --built
pnpm build:demo
pnpm check:worklets
```

宿主能力额外覆盖“支持/不支持/后注册/卸载”。MTS 先验证构建中 BG 引用与 MT 注册，不用 Vitest 的 worklet 模拟层证明生产 bundle 已包含 worklet。

### F. 仅修改用户指南或 AI 指引

核对所有路径、示例命名导出与配置事实，跑 `pnpm check:meta`、`pnpm check:docs`、`pnpm docs:build`。无需为文字变更生成 API meta、CSS 或迁移计划；仍应报告已有检查失败及是否与本次相关。

## 6. 测试层级与最终报告

- [unit project](<../../packages/ui/vitest.config.ts>)是纯函数/静态测试；新增文件放 unit 并登记 PURE_TESTS，不把依赖双线程的测试塞进去。
- component project 经[setup](<../../packages/ui/test/setup.ts>)与双线程 helper；根 `test.isolate: false` 意味着模块状态需复位。不要移到 project 内或清空按模块注册的 worklet。
- [完整 CI](<../../.github/workflows/ci.yml>)包含独立规范 job；`pnpm verify` 没有包含 lint、文档构建、视觉检查或真机验收。
- 完整代码收尾通常运行 `pnpm lint:conventions`、`pnpm verify`；后者会写生成 CSS并构建，不要称只读。文档/视觉/真机按改动另验。
- 按[设备指南](<../guide/device-testing.md>)验证 Android/iOS；没有设备时如实列待验项目，不以 Web 代替。

报告格式建议：

```text
改动范围：目标与修改文件；哪些 API/业务逻辑保持不变。
验证：实际执行的命令、退出状态、关键结果。
已有问题：任务前已失败的检查，与本次是否相关。
未验证：缺基线/浏览器/真机及需要人工确认的项目。
工作区保护：保留哪些已有修改；没有擅自提交、清理或更新豁免。
```

## 7. 下一阶段，不是本阶段前置条件

消费者 AI 文档可复用源码→meta→组件页链，生成短索引与分块 Markdown；必须保留完整类型/参数的源码入口及公开入口验证过的示例。meta schema 只能先验证数据形状，不能机械代替 TypeScript。`llms.txt`、MCP、公开 npm meta、完整 AST 推导或向量检索都应在真实消费需求下另行落地，不需要先训练模型才能开始协作。
