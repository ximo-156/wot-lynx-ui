# Demo AI 指引

范围：`packages/demo`。先读[根入口](<../../AGENTS.md>)及[任务流程](<../../docs/ai/README.md>)。

## 入口与用途

- [主应用](<src/App.vue>)负责页面容器、视口和滚动；组件演示集中在[Showcase](<src/showcase/Showcase.vue>)，不是让主应用持续膨胀。
- [真机清单应用](<src/device-test/App.vue>)是独立验收入口；覆盖规则见[检查脚本](<../../scripts/check-device-coverage.mjs>)和[设备指南](<../../docs/guide/device-testing.md>)。
- [构建配置](<lynx.config.ts>)与[Demo 命令](<package.json>)决定真实入口、端口及产物，不假设固定预览 URL。

## 修改约束

1. 这里仍运行 Vue Lynx，不能把浏览器 DOM、Web 点击/布局语义直接当成原生实现。
2. 保留真实包 exports 的 source 解析，不用精确主入口源码 alias 绕过分发契约；深路径验证见[探针](<src/device-test/subpath-contract.ts>)。
3. 当前 Demo 启用了标签兼容插件，已有 kebab-case 组件标签并非所有消费者都可直接照抄；新消费示例明确 PascalCase 与真实导出/别名。
4. Demo 可用自己的 `<style>`，不要把组件库“禁止 style 块”的约束机械套到应用层。
5. 不删 worklet 包包含配置、不放宽样式 sideEffects 白名单；MT bare import 的保留由构建配置保护，BG/MT 配置不可混淆。
6. 更新示例时保留正常浏览、压力模式、设备清单和亮暗主题入口；不要为让测试变绿隐藏真实渲染/交互。
7. 给消费者的示例必须走公开 API；本仓库可工作的内部源码深路径不代表 npm 子路径可用。

## 验证

```bash
# 从仓库根执行
pnpm check:device-coverage
pnpm build:demo
pnpm check:worklets
# 涉及独立设备入口时再运行
pnpm build:device-test
```

开发/真机测试服务按任务需要启动，复用现有服务或说明端口和关闭方式，不随意启动长期后台服务。构建通过、Lynx Web 预览与 Android/iOS 真机验收分别报告；未扫码或未实机交互不能写“真机通过”。
