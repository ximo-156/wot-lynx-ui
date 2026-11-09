# wot-lynx-ui

> 基于 [Vue Lynx](https://vue.lynxjs.org) 的 [wot-ui](https://wot-ui.cn/) API 兼容组件库 —— 原生性能、保留官方布局与尺寸规范，采用**紫色品牌主题**。

`wot-lynx-ui` 参照 wot-ui 2.3.2 的 **API、交互与组件结构**，为 **Vue Lynx** 框架从零重写：使用 Lynx 的双线程架构与原生渲染管线。保留 `--wot-*` 令牌名称、官方原始色阶及字号、间距、圆角等度量；默认主色与文字色通过独立品牌令牌定制，不宣称默认视觉逐像素一致。

## 特性

- **🎨 同源令牌，独立品牌** — 品牌原色 `#755FFE`、次色 `#9A89FF` 与官方原始 `--wot-blue-*` 色阶分离；组件主色、文字及成功/危险/警告语义的实际亮暗映射以[亮色主题](<packages/ui/src/styles/theme/light.scss>)、[暗色主题](<packages/ui/src/styles/theme/dark.scss>)和[JS 镜像](<packages/ui/src/common/theme.ts>)为准，不宣称所有语义值与官方逐值一致
- **⚡ 原生性能** — Lynx 双线程架构：Vue 运行在后台线程，渲染在主线程；拖动/滑动等高频交互使用声明式 Main Thread Script，跟手时段禁用 CSS transition、落位时恢复；细线边框使用 `1ppx` 物理像素；图标使用原生字体渲染
- **🧩 API 兼容** — 主入口公开 106 个组件：100 个有实际功能的官方对应组件 + 6 个本地扩展；官方空占位 `wot-ui` 不作为主入口公开组件计数
- **📦 源码分发与预编译 CSS** — 消费者无需安装 Sass 工具链；组件源码由 Rspeedy 编译，按需导入及 worklet 保留遵守下方构建配置
- **🌗 主题系统** — CSS 变量驱动亮色/暗色主题，`WdConfigProvider` 全局配置（`wot-theme-light` / `wot-theme-dark`）；暗色文字使用适配深色背景的中性色
- **🧰 命令式 API** — `useToast` / `useDialog` / `useNotify` / `useImagePreview` 等弹层命令式调用；宿主专属能力按 Lynx 原生模块契约（`NativeModules.WotLynxUI` / `lynx.getJSModule` / `configureHost`）接入，**不含 uni-app 兼容层**
- **🧪 可测试** — 纯函数守卫与基于 @lynx-js/testing-environment 的 Vue Lynx 双线程测试，覆盖组件渲染、交互回归与构建约束；全量状态以实际校验结果为准

## API 对照范围

离线 wot-ui 2.3.2 参考含 **101 个顶层组件目录**（包括空占位 `wot-ui`）和 **5 个内部 props 模块**，不能与主入口公开组件数混用。运行时 props 守卫覆盖 98 个类型文件导出 + 3 个 SFC 推导（RootPortal、StickyBox、空占位），共 **1,462 个 prop 契约**；当前对照无未豁免的运行时差异。

仅有两项明确豁免：`customStyle` 从官方 `String` 扩展为 `[String, Object]`，以及 `WdCircle.color` 默认值从 `#1C64FD` 改为品牌色 `#755FFE`。守卫检查 prop 名称、运行时构造器、required、默认值/工厂与 validator；**不证明 TypeScript 泛型、类型别名或联合类型全部一致，也不证明全部交互或真机行为一致**。6 个本地扩展（AddressEdit、BarCode、Coupon、PullRefresh、ShareSheet、SubmitBar）在该官方离线包中没有对应定义，明确不计入官方覆盖。

运行时守卫见 [check-wot-props.mjs](<scripts/check-wot-props.mjs>)、[官方 props fixture](<packages/ui/test/fixtures/wot-ui-2.3.2-props.json>) 与 [props 回归测试](<packages/ui/test/parity/wot-parity-props.test.ts>)。

## 快速开始

### 安装

```bash
pnpm add wot-lynx-ui vue-lynx vue
```

### 配置 lynx.config.ts

```ts
import { defineConfig } from '@lynx-js/rspeedy'
import { pluginQRCode } from '@lynx-js/qrcode-rsbuild-plugin'
import { pluginVueLynx } from 'vue-lynx/plugin'
import { pluginWotLynxWebFonts, pluginWotLynxWebViewport } from 'wot-lynx-ui/plugin'

export default defineConfig({
  environments: { lynx: {}, web: {} },
  plugins: [
    pluginWotLynxWebFonts(),
    pluginWotLynxWebViewport(),
    pluginQRCode(),
    pluginVueLynx({
      optionsApi: false,
      enableElementTemplates: false,
      enableCSSInheritance: true,
      enableCSSInlineVariables: true,
      // npm 安装的包也必须进入主线程 worklet 依赖图
      includeWorkletPackages: ['wot-lynx-ui']
    })
  ],
  source: { include: [/wot-lynx-ui/] },
  tools: {
    rspack(config, utils) {
      const envName = String((utils as any)?.environment?.name ?? '')
      if (envName.startsWith('lynx') || envName.startsWith('web')) {
        // 当前工具链的 MT bare import 需保留，否则注册 worklet 会被剪掉
        config.optimization = config.optimization ?? {}
        config.optimization.sideEffects = false
      }
    }
  }
})
```

以上面向 npm 发布包的默认 `import` 分支，主题解析到预编译 CSS。worklet 包白名单解决 loader 剔除，应用级 `optimization.sideEffects: false` 解决当前工具链的 MT bare import 剪枝；后者可能增大后台包体，但不要因此把库的 CSS/SCSS/TTF sideEffects 白名单改成 `true`。

工作区源码直连不触发第一道 loader 闸门，但仍需保住 MT import。本仓库 Demo 显式启用 `source` 条件并将主题映射为生成 CSS，见[实际配置](<packages/demo/lynx.config.ts>)；新工作区若走默认 dist 分支需先 `pnpm build:ui`，不要仅复制源码 alias 绕过 exports。配置/包体优化后需重新验证 BG 引用与 MT 注册契约，详见[组件规范 §10](<CONVENTIONS.md>)。

### 引入主题与组件

```ts
// main.ts
import { createApp } from 'vue-lynx'
import 'wot-lynx-ui/theme' // --wot-* 设计令牌（与 wot-ui 2.3.2 同源）
import App from './App.vue'

createApp(App).mount()
```

> **预设主题按需引入**（ADR-016）：`brand-a` / `compact` / `high-contrast` 不进主包。
> 需要时额外 `import 'wot-lynx-ui/theme/presets/brand-a'`（或 `/theme/presets` 全量），
> 再用 `<WdConfigProvider theme="brand-a">` 或 `class="wot-theme-brand-a"` 启用。
> 未引入对应 CSS 时不会报错，只是主题不生效。

```vue
<script setup lang="ts">
import { ref } from 'vue-lynx'
import { Button as WdButton, Cell as WdCell, CellGroup as WdCellGroup } from 'wot-lynx-ui'

const count = ref(0)
</script>

<template>
  <WdCellGroup border>
    <WdCell title="按钮点击次数" :value="String(count)" />
  </WdCellGroup>
  <WdButton type="primary" @click="count++">点击 +1</WdButton>
</template>
```

当前命名导出为 `Button`、`Cell`、`CellGroup`；上例的 `Wd*` 是局部 `as` 别名，也可直接使用 `<Button>` 等导入绑定。它们不等于包新增了 `WdButton` 命名导出。

也支持全局注册（插件注册 `WdButton` 等 PascalCase 标签，无需逐个 import）：

```ts
import wotLynxUI from 'wot-lynx-ui'
createApp(App).use(wotLynxUI).mount()
```

> **注意**：Vue Lynx 的编译器将所有 kebab-case 标签视为 Lynx 原生元素，
> 组件默认使用 **PascalCase 标签**（`<WdButton>`）。
> 如需沿用 wot-ui 的 `<wd-button>` 写法，安装标签兼容插件：
>
> ```ts
> import { pluginWotLynxTags } from 'wot-lynx-ui/plugin'
> // 在上方 plugins 数组加入 pluginWotLynxTags()，保留其他插件和 tools 配置。
> ```
>
> 转换只改标签；仍需局部 `Wd*` 绑定或全局插件注册，不自动新增组件 import。
>
> props / events / slots / 样式类名以 wot-ui 2.3.2 为兼容参考；已验证范围与适配说明见上文及[「与 wot-ui 的差异」](#与-wot-ui-的差异)一节。

> **关于 CSS 压缩告警**：设计令牌采用多级 `var()` 回退链（组件令牌 → 刻度令牌 →
> 基础令牌 → 默认值），令牌出现在 `calc()` 内时会形成三层嵌套 `var()`
> （如 `calc(var(--a, var(--b, var(--c, 2px))))`）。cssnano 内置的 postcss-calc
> 解析不了该结构，生产构建会刷出大量 `Parse error` 告警——**不影响产物**
> （解析失败时原值透传，浏览器/Lynx 均正常解析）。Rspeedy 默认用 cssnano
> 压缩 CSS，如需消除告警，可参照 Demo 的做法显式注册 CSS 压缩插件并关闭
> `calc` 转换：
>
> ```ts
> import { pluginCssMinimizer } from '@rsbuild/plugin-css-minimizer'
> plugins: [
>   pluginCssMinimizer({
>     pluginOptions: {
>       minimizerOptions: { preset: ['default', { mergeLonghand: false, calc: false }] }
>     }
>   })
> ]
> ```

## 文档

- [组件文档](<docs/components/>)（VitePress，按组件说明 API 与适配范围）
- [Demo 应用](<packages/demo/>)（`pnpm dev:demo`，包含组件演示与真机验收入口）
- [重写规范](<CONVENTIONS.md>)（当前组件开发约定）

## AI 协作

- 从[AGENTS.md](<AGENTS.md>)开始，再读取所修改目录的局部指引；规则随 Git 共享，不依赖本机 AI 记忆。
- [AI 开发指南](<docs/ai/README.md>)提供目录/组件定位、事实来源、生成物规则、任务验证命令和验收报告格式。
- 这些指引面向仓库维护；消费者的分块 API / `llms.txt` 等属于后续阶段，不把现有有损 meta 当完整类型/事件语义。工具不自动识别 AGENTS 时，显式要求它先读取入口。

## 真机测试

仓库内置**真机测试 Demo**（106 个组件逐页验收 + 8 组交互验收，共 145 项），支持 Lynx Explorer 扫码直接在真机验证：

```bash
pnpm dev:device-test   # 启动后扫描终端中的 device-test 二维码
```

打开页面即进入组件目录：**一个组件一页**（与 wot-ui demo 一样逐页点看），每页渲染该组件的真实演示并附带「真机检查」项，逐页勾选后顶部实时显示完成进度；顶部可切换到 8 组交互验收卡（按钮按压缩态、Slider/SwipeAction 拖动跟手、弹层、表单键盘、长列表滚动、亮暗主题等），亮/暗主题在头部切换。

## 开发

```bash
pnpm install          # 安装依赖（Node.js >= 20）
pnpm build:css        # 编译 SCSS → CSS（组件样式）
pnpm dev:demo         # 启动 Demo（Rspeedy dev server）
pnpm build:demo       # 构建 Demo（web + lynx 双端）
pnpm typecheck        # 类型检查
pnpm test             # 全部测试（node + jsdom 双 project，耗时随套件/环境变化）
pnpm test:shard --index=1 --count=4   # 只跑 1/4 分片（CI 用，按实测耗时均衡）
pnpm test:shard:plan  # 只看分片负载，不跑
pnpm docs:dev         # 文档站
pnpm verify           # 生成物/契约 + CSS + 类型 + 全量测试 + Demo/worklet（会写产物）
```

### 测试结构

`vitest.config.ts` 把测试分成两个 project：

| project | 环境 | 内容 | 特点 |
|---|---|---|---|
| `unit` | node | 纯函数 / 静态数据（`PURE_TESTS` 精确清单） | 不搭双线程环境，单文件约 20ms |
| `component` | jsdom | 其余全部（组件渲染、交互回归） | 环境按 worker 复用 |

文件隔离在**根 `test`** 上关闭（`test.isolate: false`），两个 project 都受益：JSDOM +
`LynxTestingEnv` 每文件重建约 3s，比单文件真正要验的逻辑（中位数 < 300ms）大一个数量级。
全量因此从 110s 降到 33s。

> ⚠️ 这一行**必须写在根 `test` 上**。写在 project 内部会被静默忽略（不报错、不警告），
> 只有量耗时能发现：实测 project 内写 `isolate: false` 是 113.88s，根层才是 33.35s。

代价是模块级状态不再随文件结束而消失。**新增「测试会写、生产不撤销」的全局注册表时，
必须在 `packages/ui/test/setup.ts` 的 `beforeEach` 里复位**，否则结果依赖文件执行顺序。
验证方法：

```bash
cd packages/ui
npx vitest run --sequence.shuffle.files --sequence.seed=7   # 换几个 seed，失败数应恒等于基线
```

（注意用 `--sequence.shuffle.files`，不要用 `--sequence.shuffle`——后者会连文件内的用例
一起打乱，把「文件内顺序依赖」误判成「跨文件泄漏」。）

新增测试文件后建议跑 `pnpm test:shard:update` 刷新耗时缓存，让 CI 分片保持均衡
（不刷新只会不均，不会漏跑）。详见 [ADR-021](./docs/adr/021-test-isolation-and-sharding.md)。

### 改组件 API 时

组件的 props / events / slots 由源码推导到 `packages/ui/meta.json`（`pnpm gen:meta`），
文档与侧边栏从 meta 生成（`pnpm gen:docs`）。改完跑：

```bash
pnpm gen:meta                                   # 重新推导契约
pnpm api:diff                                   # 默认比较 HEAD 与工作区契约
pnpm api:diff --base main --md api-changes.md --plan codemod-plan.json  # 指定基准并导出清单、迁移计划
pnpm codemod --plan codemod-plan.json --dir .     # 按迁移计划改写调用方（默认 dry-run）
```

`--base` 可省略，默认 `HEAD`（最近一次提交），只比较该提交与当前工作区的契约快照；
它不会自动生成 meta，也不会显示已经提交进 `HEAD` 的改动。查看相对其他提交、分支或
快照的差异时，请显式指定 `--base <git-ref|file>`，如 `main`、`HEAD~1` 或历史快照路径。

`api:diff` 把差异分成 major / minor / patch / docs 四级；`codemod` 只自动改写**能证明
等价**的 prop 改名，其余变更输出人工指引。详见 [ADR-019](./docs/adr/019-api-diff-and-codemod.md)。

### 改样式时

```bash
pnpm docs:build       # 视觉回归拍的是文档站的组件预览
pnpm visual:check     # 与基线比较，有差异会指出区域并生成差异图
pnpm visual:baseline  # 差异是有意的 → 更新基线；换平台后也要先跑一次
```

基线按平台隔离（字体光栅化不同），位于 `visual/baseline/<platform>/`，为工具生成的本机留档、不入库——新克隆先跑 `pnpm visual:baseline` 生成。首次在新平台
运行 `visual:check` 会提示「缺基线」而不是判失败。详见 [ADR-020](./docs/adr/020-visual-regression.md)。

## 目录结构

```
wot-lynx-ui/
├── AGENTS.md                      # 共享 AI 协作入口（子目录另有局部指引）
├── packages/
│   ├── ui/                        # 组件库：源码分发 + 预编译 CSS
│   │   ├── src/
│   │   │   ├── primitives/       # L3.5 基础件，与业务根平级
│   │   │   ├── components/       # L4 业务组件 + 官方空占位/内部模块
│   │   │   ├── composables/      # 父子通信、触摸、弹层、表单、上传等
│   │   │   ├── common/           # 工具/props/style/native/host/platform/日期/过渡
│   │   │   ├── icons/            # 官方与兼容字体集、registry、TTF
│   │   │   ├── locale/           # 多语言资源
│   │   │   └── styles/           # 原始刻度、独立品牌、亮暗语义、mixin、BEM
│   │   ├── plugin/               # Rspeedy 标签/按需导入/Web 宿主插件
│   │   ├── test/                 # unit、component、parity、mts、regression 等
│   │   ├── meta.json             # 源码推导的 API 目录，不手改
│   │   └── vitest.config.ts
│   └── demo/                     # Rspeedy 双端 Demo，showcase 与 device-test
├── docs/                          # VitePress：手写指南 + 生成组件文档
│   ├── ai/                       # 按任务读取与验证的仓库开发指南
│   └── adr/                      # 现行/历史架构决策记录
├── scripts/                       # 生成、构建、检查、迁移工具
├── CONVENTIONS.md                 # 当前组件开发规范
└── ARCHITECTURE.md                # 当前规则、历史评审与后续方向
```

## 性能实现

| 交互 | 实现 |
|---|---|
| `WdSlider` 拖动 | 声明式 Main Thread Script 跟手，主线程直接更新轨道 / 滑块；落定值经组件事件回传后台线程 |
| `WdSwipeAction` 横滑 | 声明式 Main Thread Script 更新容器位移；方向判定、吸附阈值与落定状态由组件协调 |
| 按压缩态 | CSS `:active`（渲染器原生处理） |
| 细线边框 | `1ppx` 物理像素 |
| 图标 | 官方与兼容 TTF 字体集，经 `<text>` 字形渲染，随包发布无网络请求；可 `registerIconSet` 注册扩展集合 |
| 弹层 | `position: fixed` 自动提升至根节点 |

## 与 wot-ui 的差异

Lynx 是原生渲染引擎，与 Web/小程序运行时有本质差异，以下能力有适配或降级（详见 [CONVENTIONS.md](./CONVENTIONS.md)）：

| 能力 | wot-ui | wot-lynx-ui |
| --- | --- | --- |
| 图标 | iconfont 字体 | 官方与兼容 TTF 字体集，经 `<text>` 字形渲染，随包发布无网络请求；可 `registerIconSet` 注册扩展集合 |
| 按压缩态 | `hover-class` | CSS `:active` 伪类（渲染器原生处理） |
| 细线边框 | `::after` + scale(0.5) | 原生 `border` + `1ppx` 物理像素 |
| 伪元素装饰 | `::before` / `::after` | 模板真实元素（`__bar` / `__hairline` 等类名） |
| 弹层传送 | `root-portal` / teleport | `position: fixed` 节点自动提升至根节点 |
| 圆环/二维码/条形码/水印 | canvas 2D | SVG（安全渲染路径与导出 data URI 的能力边界分开） |
| 签名笔迹 | canvas 2D | 声明式 MTS + 原生 view 保留笔迹；SVG / 可选宿主 Canvas 2D 导出 |
| 页面跳转 | `uni.navigateTo` | 原生 `navigate` 事件 + 宿主模块（`configureHost({ navigateTo })` 等），无宿主时只抛事件 |
| 安全区 | `uni.getSystemInfoSync` | 保留宿主 `SystemInfo` 数据；`useDeviceInfo` 使用 `safeArea` 矩形，缺失回退全屏，不假设所有宿主提供安全区 |

## 致谢

- [wot-ui](https://wot-ui.cn/) — 组件 API、交互与布局度量参考
- [Vue Lynx](https://vue.lynxjs.org) — Vue 3 的 Lynx 自定义渲染器
- [Lynx](https://lynxjs.org) — 跨平台原生渲染引擎

## License

MIT
