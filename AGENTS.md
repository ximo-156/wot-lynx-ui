# AGENTS.md — wot-lynx-ui AI 协作入口

适用于整个仓库；进入子目录时，同时读取该目录的指引。本文件是导航和工作约定，不是第二份 API 清单。

## 1. 开始任务前

1. 确认工作目录，检查 `git status --short`，识别已有修改；只做与当前任务相关的改动。
2. 读取本文件，再按[任务阅读与验证流程](<docs/ai/README.md>)选择上下文；不要默认把全库文档塞进上下文。
3. 修改前读目标文件及相关测试，找到相似实现；涉及 API、线程、主题或宿主能力时先核对对应决策。
4. 不覆盖已有修改，不擅自切换分支、提交、清理文件或更新豁免基线。

## 2. 这个项目是什么

- pnpm monorepo：Vue Lynx 原生组件库、Rspeedy 双端 Demo、VitePress 文档站。
- wot-ui 2.3.2 是 API/交互参考，不是可直接复制的实现；兼容范围见[项目说明](<README.md>)和[差异指南](<docs/guide/differences.md>)。
- 仓库开发要求 Node.js >= 20；pnpm 版本和依赖锁定以[根配置](<package.json>)与[锁文件](<pnpm-lock.yaml>)为准，不自行升级。
- 主包是源码分发；`dist` 是入口桥接层，不代表可以在裸 Node/SSR 中运行 Vue SFC。

| 工作范围 | 先读 | 核心职责 |
|---|---|---|
| 组件库 | [UI 指引](<packages/ui/AGENTS.md>) | 基础件、业务组件、组合式函数、平台能力与主题 |
| 双端 Demo | [Demo 指引](<packages/demo/AGENTS.md>) | 真实 Lynx/Web 构建与真机验收入口 |
| 文档站 | [文档指引](<docs/AGENTS.md>) | API 文档生成与浏览器预览，不等同真机 |
| 工程脚本 | [脚本指引](<scripts/AGENTS.md>) | 确定性生成、只读检查、迁移与构建契约 |

## 3. 事实来源与冲突处理

- **公开 API/导出**：当前源码、[包 exports/files](<packages/ui/package.json>)和[主入口](<packages/ui/src/index.ts>)；不要根据组件标签猜命名导出。
- **编码/平台约束**：[CONVENTIONS](<CONVENTIONS.md>)；**系统组织**：[ARCHITECTURE](<ARCHITECTURE.md>)；**决策状态**：[ADR 索引](<docs/adr/README.md>)。
- **组件族**：[families.json](<docs/architecture/families.json>)是声明式来源；不能按名字相似或双向 import 自动猜族。
- **规模与依赖**：[架构快照](<docs/architecture/SNAPSHOT.md>)及生成/检查脚本；历史评审数字、路线图和旧测试结果不是当前状态。
- **API 元数据**：[meta.json](<packages/ui/meta.json>)由源码推导，是生成物；缺少详细类型、事件参数或实例方法不等于组件没有这些能力。
- `.workbuddy-ai/` 等本地记忆、忽略的评审稿不是共享规则；有用且仍有效的结论应沉淀到现行指南/ADR。
- 若文档、源码与门禁冲突，核对现行 ADR 和实际路径并报告差异；不通过修改 API、改线程方案或放宽测试来“消除冲突”。

## 4. 必须记住的项目约束

1. 库源码使用 `vue-lynx`；文档站是 Vue DOM 预览，有自己的适配规则，不能全仓库机械替换 import。
2. 两个组件根是 `src/primitives` 与 `src/components`；按名称定位时必须同时考虑两个根。
3. 命名导出目前是 `Button`、`Cell` 等；局部可 `import { Button as WdButton }`，全局插件注册 `WdButton`。这三种名字不要混用。
4. Lynx 原生节点点击使用 `tap`；组件对外的 `click` API可保留并转发。不要把原生 `@click` 或测试合成的 click 当成真机行为。
5. 跟手交互的正常实现使用声明式 MTS；禁止命令式 `runOnMainThread` / `runOnBackground` / `lynxWorkletImpl` 探测，worklet 不可互相闭包引用。已有明确记录的兼容降级先读实现与回归，不擅自换线程。
6. 原生内联样式使用对象；可切换键必须显式复位，动态 `customStyle` 使用每元素独立的 Style Funnel。不能靠删键、剔空值或省略属性清除旧样式。
7. 文本用原生 `text`；标签型插槽复用文字出口。横向容器显式 `display: flex`，不假设 DOM、伪元素、Web 继承或布局语义可直接用于 Lynx。
8. `common`/`composables` 不反向依赖组件；基础件不依赖业务组件。声明的族内互引允许，跨族环禁止，不强行解掉合法父子环。
9. 原生能力与宿主能力经既有适配层，不能重新引入 uni-app 兼容层或在组件里直接读浏览器 DOM/宿主全局。
10. 保留源码分发与样式 sideEffects 契约；不得手改生成的 CSS、barrel、API meta、侧边栏和快照。

## 5. 命令与验收

以下命令均从仓库根运行。首次克隆按[开发说明](<README.md>)安装锁定依赖；已有依赖时不要为文档任务重新安装或升级。

```bash
# 小范围、只读的现状检查
pnpm check:index
pnpm check:deps
pnpm check:meta
pnpm check:docs
pnpm check:snapshot
pnpm lint:conventions

# 针对性测试示例（路径相对于 packages/ui）
pnpm --filter wot-lynx-ui exec vitest run --project unit test/unit/meta-generated.test.ts
```

- 修改后按[任务流程](<docs/ai/README.md>)更新必要生成物、补回归、运行对应检查，不无差别重生成全库。
- 完整收尾通常为 `pnpm lint:conventions` 与 `pnpm verify`；后者会重生成 CSS、运行类型/全量测试、构建 Demo，**不是只读命令**，且不包含文档站构建、视觉检查或真机验收。
- `check:docs` 只验证生成侧边栏与 meta 一致，不证明文档示例、类型语义或真机可用。
- Web/jsdom、生产双端构建、Android/iOS 真机是不同证据；未执行的层级必须标“未验证”。
- 收尾报告：改了什么、执行了哪些命令及结果、已有失败是否与本次相关、哪些真机/视觉步骤仍待完成。不能用历史“全绿”或跳过来冒充通过。

## 6. 上下文范围

默认不整树扫描 `node_modules/`、`.pnpm-store/`、`.git/`、`dist/`、缓存、字体和生成截图。确需核对框架行为时，只读具体依赖文件并说明依据。官方运行时契约有[入库 fixture](<packages/ui/test/fixtures/wot-ui-2.3.2-props.json>)；不要假设另一台机器也存在 `/tmp` 或本地参考包。

如所用 AI 工具不自动识别 `AGENTS.md`，在任务开始显式要求它读取本入口和对应子目录指引；本仓库不假设所有工具都会自动加载规则。
