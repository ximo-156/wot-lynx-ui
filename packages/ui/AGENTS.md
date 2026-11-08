# UI 组件库 AI 指引

范围：`packages/ui`。先读[根入口](<../../AGENTS.md>)和[组件规范](<../../CONVENTIONS.md>)；本文件只补充组件库定位与检查路径。

## 定位与事实来源

- 基础件在[primitives](<src/primitives/>)，业务组件在[components](<src/components/>)，二者平级。不要仅搜索业务根。
- 属性/完整类型在组件的 `types.ts`，事件/插槽/实例方法在 SFC 或对应类型声明；先看源码再看[生成 meta](<meta.json>)。
- [主入口](<src/index.ts>)、[基础件 barrel](<src/primitives/index.ts>)和[业务 barrel](<src/components/index.ts>)决定实际导出；`Button as WdButton` 的局部别名不等于新增了 `WdButton` 命名导出。
- 依赖族及例外来自[families.json](<../../docs/architecture/families.json>)与[ADR-013](<../../docs/adr/013-declarative-families.md>)，不按命名或当前 import 图猜测。
- 运行时官方兼容由[props fixture](<test/fixtures/wot-ui-2.3.2-props.json>)和[契约守卫](<../../scripts/check-wot-props.mjs>)约束；不证明完整 TypeScript 或所有真机交互一致。

## 写组件时

1. 框架功能和类型来自 `vue-lynx`；组件 SFC 首行代码引入生成 CSS，不新增 `<style>` 块。原生文本必须有明确文字节点/样式，标签型插槽使用[WdTextSlot](<src/common/textSlot.ts>)。
2. 使用 PascalCase 组件标签；原生 view 事件用 `tap`。在 `defineEmits` 声明并转发内部原生事件，避免 `$attrs` 同名监听穿透后合并成数组。
3. 静态可切换样式用 `defineStyleKeys` / `resolveStyle`；动态键用每元素独立的 `createStyleResolver`，见[样式出口](<src/common/style.ts>)。显式空值清除覆盖，不经 `filterStyle` 再剔除。
4. 样式消费 `--wot-*`，原始刻度、品牌、亮暗语义、组件令牌分层；不要把品牌色当作所有语义主色默认值。BEM 的 `m()` / `when()` 必须与实际类名对应。
5. 声明式 MTS 经主线程 ref/元素属性读写；不能命令式派发、读后台响应式闭包或直接调用另一个 worklet。度量缓存，touchmove 不做异步节点查询。已记录的兼容降级需要保留平台证据。
6. 引擎能力走[native](<src/common/native.ts>)，宿主能力走[host](<src/common/host.ts>)，可用性走[platform](<src/common/platform.ts>)。能力是实时派生值，不缓存 setup 快照，不恢复已删除的 uni 层。
7. 基础件不得引业务组件；common/composables 不得反向依赖组件。族内父子契约可互引，不为了“全图零环”重构合法族。
8. 默认图标集合和查找顺序以[registry](<src/icons/registry.ts>)为准。SVG 渲染只用已验证白名单并经安全过滤；导出 SVG 与原生渲染不是同一能力边界。

## 测试入口

- 用[render](<test/render.ts>)与[fire-event](<test/fire-event.ts>)走双线程管线；真机点击回归派发 `tap`，不要用 helper 的合成 click 证明原生点击。
- 按名称读源码/样式用[双根解析 helper](<test/helpers/component-roots.ts>)，不要硬编码全部组件在同一根。
- 纯函数测试放 `test/unit`，同时登记[PURE_TESTS](<vitest.config.ts>)；组件测试放对应 component/mts/parity/regression 目录。
- 文件隔离关闭在根 `test.isolate`；新增模块单例/注册表需在[setup](<test/setup.ts>)或用例 teardown 复位。worklet 注册表按模块注册，不能随便清空。
- 回归同时覆盖状态来回切换、异步旧回调、卸载、降级、重复交互；不能只断言“调用过 API”。

## 生成物与收尾

按[任务流程](<../../docs/ai/README.md>)运行源码→CSS、目录→barrel、源码→meta、meta→组件文档/侧边栏的对应生成器。源码与 meta 不一致时修改源码或生成器并重生成；不手填 meta。

```bash
# 以下均从仓库根执行；具体测试路径按任务选择
pnpm lint:conventions
pnpm typecheck
pnpm --filter wot-lynx-ui exec vitest run --project unit test/unit/style-funnel.test.ts
pnpm check:deps
```

公开 API、导出、组件根或主题分发的改动还需契约检查及双端构建；交互/布局需真机验收。不要扩大任务为全库“清零”、自动更新豁免基线或修改无关生成物。
