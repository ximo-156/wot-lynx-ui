# 文档站 AI 指引

范围：`docs`。先读[根入口](<../AGENTS.md>)与[任务流程](<ai/README.md>)。

## 文档类型与维护位置

- [用户指南](<guide/>)是手写、入库的长期内容；真实消费方式、平台差异和示例要与公开源码一致。
- 组件页 `docs/components/*.md` 由[gen-docs](<../scripts/gen-docs.mjs>)读取[meta](<../packages/ui/meta.json>)生成，不手改；要改属性说明时修改源码注释/类型，要改渲染格式时修改生成器。
- [组件侧边栏](<.vitepress/components-sidebar.ts>)是入库生成物；`check:docs` 只验证它，不能证明文档 API 语义或示例正确。
- [ADR 索引](<adr/README.md>)给出决策现行状态；历史原文保留，修订说明/取代关系明确。不能将旧目标或撤销方案当当前强制规则。
- [架构快照](<architecture/SNAPSHOT.md>)由脚本生成；历史研究稿/本地评审稿不是长期用户指南。文档与入库边界见[gitignore](<../.gitignore>)。

## VitePress 与真实 Lynx 的区别

1. 文档站使用 Vue；[配置](<.vitepress/config.ts>)将 `vue-lynx` 映射为[DOM 垫片](<.vitepress/theme/lynx-dom.ts>)。这里的 `from 'vue'` 不应被全局替换成 `vue-lynx`。
2. [预览 demo](<.vitepress/theme/demos/>)经[registry](<.vitepress/theme/demo-registry.ts>)自动发现；它们使用文档站源码别名，不能直接当作 npm/Lynx 通过的范例。
3. 消费者示例明确区分命名导出（如 `Button`）、局部别名（如 `WdButton`）、全局注册及标签转换插件；先核对[包 exports](<../packages/ui/package.json>)和[主入口](<../packages/ui/src/index.ts>)。
4. 元数据的 `array`、事件名、插槽名不表达完整类型/参数；未收录 `defineExpose` 或组合式 API不等于没有该功能。补说明时引用源码，不编造 payload、泛型、默认值或支持平台。
5. 保留原生能力、宿主能力与降级说明；不得写“完全兼容”“真机无差异”或把 DOM 预览绿灯当证据。

## 文档修改后的检查

```bash
# 从仓库根执行
pnpm check:meta
pnpm check:docs
pnpm docs:build
```

`docs:build` 的前置步骤会生成组件 Markdown 和侧边栏，产物不是纯只读。仅修改指南无需重生成 meta。涉及预览样式时还需视觉检查；视觉基线按平台、本机生成，不能为了通过自动更新。涉及真实交互要回到 Demo/真机验收。

## AI 文档的后续边界

当前[AI 开发指南](<ai/README.md>)面向仓库维护者。将来生成消费者 AI 文档时，只选现行用户指南、可追溯 API 和经过公开入口验证的短例；不要拼入所有历史 ADR、调研稿、本地记忆或整库源码。`llms.txt` 是可读入口，不保证所有工具自动加载；schema/MCP/公开 npm meta 应在有实际消费需求后另行设计。
