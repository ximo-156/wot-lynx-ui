# 工程脚本 AI 指引

范围：`scripts`。先读[根入口](<../AGENTS.md>)与[任务流程](<../docs/ai/README.md>)。

## 单一事实来源

| 产物/契约 | 上游 | 实现 |
|---|---|---|
| 组件 barrel | primitives/components 目录与公开类型 | [gen-index](<gen-index.mjs>) |
| 组件 CSS/主题入口 | SCSS 与构建入口清单 | [build-css](<build-css.mjs>) |
| dist 入口桥接层 | 源码根、barrel 与包分发契约 | [build-dist](<build-dist.mjs>) |
| 组件 API meta | props 对象/JSDoc、SFC、组件族声明 | [gen-meta](<gen-meta.mjs>) |
| 组件文档/侧边栏 | meta 与中文名称表 | [gen-docs](<gen-docs.mjs>) |
| 依赖规则/基线 | 实际 import 与[families](<../docs/architecture/families.json>) | [analyze-deps](<analyze-deps.mjs>)、[review-lint](<review-lint.mjs>) |
| 架构快照 | 源码统计及已有依赖基线 | [gen-snapshot](<gen-snapshot.mjs>) |

不是所有生成物都从 meta 生成；不能为了复用再引入第二份手写组件清单。

## 修改原则

1. 覆盖 primitives/components 两个根，包括嵌套类型/样式；迁移根目录时核对生成、构建、测试插件和公开子路径，不只改 barrel。
2. 族只读声明及 reason，不按前缀或 import 图自动放行；规则 ID 与现行 lint/依赖分析一致。
3. 保持生成稳定、路径可移植；脚本从自身 URL 定位的根与从 `process.cwd()` 定位的根不同，命令文档必须说明工作目录。
4. `--check` 不落盘；不要新增隐式写基线/生成物。现有行为、只读范围和前提须从源码确认，不能仅看命令名。
5. meta 的类型推导有边界：出现新 props/emits 写法时补解析及独立覆盖测试，不把空结果当成功；不对无法证明的类型/重命名做猜测。
6. 验证 exports 时断言真实文件及通配符条目集合，不只看 resolve 是否返回；构建产物与源码分发入口分别验证。
7. codemod 默认 dry-run，只自动改写能证明等价的变更；先确认执行路径被测试覆盖，不让测试复制实现导致假绿。
8. 删除或清理构建目录前解析并确认目标路径；不扩大为全工作区清理，不覆盖无关用户修改。
9. 不通过更新 lint/依赖/视觉豁免基线把错误消成通过；真实决策变更需要理由、回归和相应记录。

## 验证路径

- 解析/文档改动看[meta 回归](<../packages/ui/test/unit/meta-generated.test.ts>)；API diff/codemod 看对应[diff 测试](<../packages/ui/test/unit/api-diff.test.ts>)和[迁移测试](<../packages/ui/test/unit/codemod.test.ts>)。
- 分发改动看[exports 校验](<check-exports.mjs>)、[sideEffects 测试](<../packages/ui/test/unit/side-effects.test.ts>)及真实 Demo 子路径探针。
- lint 改动做正例/反例，区分已有 baseline 与新违规；“未报错”只有在目标路径确实执行后才是证据。
- 文档、JSON、生成 CSS 是下游，不能手改来满足 checker。

运行相关 `check:*` 和针对性测试后，再按[完整流程](<../docs/ai/README.md>)选择构建；不要为单个文档任务更新耗时缓存、API 迁移计划或全部基线。
