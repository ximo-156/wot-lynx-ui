# wot-lynx-ui

> 基于 [Vue Lynx](https://vue.lynxjs.org) 的 [wot-ui](https://wot-ui.cn/) API 兼容组件库 —— 原生性能、保留官方布局与尺寸规范，采用**紫色品牌主题**。

`wot-lynx-ui` 参照 wot-ui 2.3.2 的 **API、交互与组件结构**，为 **Vue Lynx** 框架从零重写：使用 Lynx 的双线程架构与原生渲染管线。保留 `--wot-*` 令牌名称、官方原始色阶及字号、间距、圆角等度量；默认主色与文字色通过独立品牌令牌定制，不宣称默认视觉逐像素一致。

## 特性

- **🎨 同源令牌，独立品牌** — 主色 `#755FFE`、次主题色 `#9A89FF`、亮色主文字 `#2D273D`、次文字 `#979797`；原始 `--wot-blue-*` 色阶保持官方值，成功 / 危险 / 警告语义不改色（见[主题与设计令牌](<docs/guide/theme.md>)）
- **⚡ 原生性能** — Lynx 双线程架构：Vue 运行在后台线程，渲染在主线程；拖动/滑动等高频交互使用声明式 Main Thread Script，跟手时段禁用 CSS transition、落位时恢复；细线边框使用 `1ppx` 物理像素；图标使用原生字体渲染
- **🧩 API 兼容** — 主入口公开 106 个组件：100 个有实际功能的官方对应组件 + 6 个本地扩展；官方空占位 `wot-ui` 不作为主入口公开组件计数
- **📦 开箱即用** — 发布预编译 CSS，消费者无需安装 Sass 工具链；组件以源码分发，由 Rspeedy 直接编译，天然支持 Tree-shaking
- **🌗 主题系统** — CSS 变量驱动亮色/暗色主题，`WdConfigProvider` 全局配置（`wot-theme-light` / `wot-theme-dark`）；暗色文字使用适配深色背景的中性色
- **🧰 命令式 API** — `useToast` / `useDialog` / `useNotify` / `useImagePreview` 等弹层命令式调用；`uni` 兼容层支持宿主经 `configureUniAdapter` 注入路由等能力
- **🧪 可测试** — 纯函数守卫与基于 @lynx-js/testing-environment 的 Vue Lynx 双线程测试，覆盖组件渲染、交互回归与构建约束；全量状态以实际校验结果为准

## API 对照范围

离线 wot-ui 2.3.2 参考含 **101 个顶层组件目录**（包括空占位 `wot-ui`）和 **5 个内部 props 模块**，不能与主入口公开组件数混用。运行时 props 守卫覆盖 98 个类型文件导出 + 3 个 SFC 推导（RootPortal、StickyBox、空占位），共 **1,462 个 prop 契约**；当前对照无未豁免的运行时差异。

仅有两项明确豁免：`customStyle` 从官方 `String` 扩展为 `[String, Object]`，以及 `WdCircle.color` 默认值从 `#1C64FD` 改为品牌色 `#755FFE`。守卫检查 prop 名称、运行时构造器、required、默认值/工厂与 validator；**不证明 TypeScript 泛型、类型别名或联合类型全部一致，也不证明全部交互或真机行为一致**。6 个本地扩展（AddressEdit、BarCode、Coupon、PullRefresh、ShareSheet、SubmitBar）在该官方离线包中没有对应定义，明确不计入官方覆盖。

运行时守卫见 [check-wot-props.mjs](<scripts/check-wot-props.mjs>)、[官方 props fixture](<packages/ui/test/fixtures/wot-ui-2.3.2-props.json>) 与 [props 回归测试](<packages/ui/test/wot-parity-props.test.ts>)。

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

export default defineConfig({
  environments: {
    lynx: {},
    web: {}
  },
  plugins: [
    pluginQRCode(),
    pluginVueLynx({
      // 设计令牌依赖 CSS 变量级联
      enableCSSInheritance: true,
      enableCSSInlineVariables: true
    })
  ],
  source: {
    // 保证 pnpm workspace 链接的组件库源码被编译
    include: [/wot-lynx-ui/]
  }
})
```

### 引入主题与组件

```ts
// main.ts
import { createApp } from 'vue-lynx'
import 'wot-lynx-ui/theme' // --wot-* 设计令牌（与 wot-ui 2.3.2 同源）
import App from './App.vue'

createApp(App).mount()
```

```vue
<script setup lang="ts">
import { ref } from 'vue-lynx'
import { WdButton, WdCell, WdCellGroup } from 'wot-lynx-ui'

const count = ref(0)
</script>

<template>
  <WdCellGroup border>
    <WdCell title="按钮点击次数" :value="String(count)" />
  </WdCellGroup>
  <WdButton type="primary" @click="count++">点击 +1</WdButton>
</template>
```

也支持全局注册：

```ts
import wotLynxUI from 'wot-lynx-ui'
createApp(App).use(wotLynxUI)
```

> **注意**：Vue Lynx 的编译器将所有 kebab-case 标签视为 Lynx 原生元素，
> 组件默认使用 **PascalCase 标签**（`<WdButton>`）。
> 如需沿用 wot-ui 的 `<wd-button>` 写法，安装标签兼容插件：
>
> ```ts
> import { pluginWotLynxTags } from 'wot-lynx-ui/plugin'
> export default defineConfig({ plugins: [pluginWotLynxTags()] })
> ```
>
> props / events / slots / 样式类名以 wot-ui 2.3.2 为兼容参考；已验证范围与适配说明见上文及[与 wot-ui 的差异](<docs/guide/differences.md>)。

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
- 指南：
  [快速开始](./docs/guide/quick-start.md) ·
  [主题与设计令牌](./docs/guide/theme.md) ·
  [内置图标](./docs/guide/icons.md) ·
  [高性能实践](./docs/guide/performance.md) ·
  [与 wot-ui 的差异](./docs/guide/differences.md) ·
  [真机测试指南](./docs/guide/device-testing.md) ·
  [设计美学研究](./docs/guide/design-research.md)
- [Demo 应用](<packages/demo/>)（`pnpm dev:demo`，包含组件演示与真机验收入口）
- [重写规范](./CONVENTIONS.md)（为 Lynx 重写的完整约定）

## 真机测试

仓库内置**真机测试 Demo**（8 个分组 / 35 个测试项的清单页），支持 Lynx Explorer 扫码直接在真机验证：

```bash
pnpm dev:device-test   # 启动后扫描终端中的 device-test 二维码
```

测试页按清单逐项验证：按钮按压缩态、Slider/SwipeAction 拖动跟手、弹层、表单键盘、长列表滚动、亮暗主题等，勾选后顶部实时显示完成进度。
详见[真机测试指南](./docs/guide/device-testing.md)。

## 开发

```bash
pnpm install          # 安装依赖（Node.js >= 20）
pnpm build:css        # 编译 SCSS → CSS（组件样式）
pnpm dev:demo         # 启动 Demo（Rspeedy dev server）
pnpm build:demo       # 构建 Demo（web + lynx 双端）
pnpm typecheck        # 类型检查
pnpm test             # 单元测试（Vue Lynx 双线程环境）
pnpm docs:dev         # 文档站
pnpm verify           # 一键校验：CSS 编译 + 类型检查 + 测试 + Demo 构建
```

## 目录结构

```
wot-lynx-ui/
├── packages/
│   ├── ui/                       # wot-lynx-ui 组件库（源码分发）
│   │   ├── src/
│   │   │   ├── components/       # 106 个主入口组件 + 官方空占位 / 内部模块
│   │   │   ├── composables/      # 组合式函数（useParent/useChildren/useTouch...）
│   │   │   ├── common/           # 工具函数 / props / 日期格式化（dayjs）/ vue-lynx Transition 兼容层 / uni 兼容层
│   │   │   ├── icons/            # 官方与兼容字体集 / registry 注册表 / TTF
│   │   │   ├── locale/           # 16 种语言
│   │   │   └── styles/           # 原始刻度 / 独立品牌 / 亮暗语义 / mixin / BEM
│   │   ├── plugin/               # Rspeedy 标签兼容插件（wd-* → PascalCase）
│   │   ├── test/                 # 运行时契约守卫 / 纯函数与双线程回归（vitest）
│   │   └── vitest.config.ts
│   └── demo/                     # Vue Lynx Demo 应用（Rspeedy，双端构建，含 device-test 真机测试入口）
├── docs/                         # VitePress 文档站（指南与组件说明）
├── scripts/                      # CSS 编译 / 图标生成 / 文档生成
├── CONVENTIONS.md                # Lynx 重写规范
└── README.md
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
| 圆环/二维码/条形码/签名/水印 | canvas 2D | SVG（path / rect / polyline / data URI） |
| 页面跳转 | `uni.navigateTo` | `uni` 兼容层降级，宿主可经 `configureUniAdapter` 注入路由 |
| 安全区 | `uni.getSystemInfoSync` | Lynx `SystemInfo`（安全区置零，可由宿主注入） |

## 致谢

- [wot-ui](https://wot-ui.cn/) — 组件 API、交互与布局度量参考
- [Vue Lynx](https://vue.lynxjs.org) — Vue 3 的 Lynx 自定义渲染器
- [Lynx](https://lynxjs.org) — 跨平台原生渲染引擎

## License

MIT
