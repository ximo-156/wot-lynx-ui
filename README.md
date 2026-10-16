# wot-lynx-ui

> 基于 [Vue Lynx](https://vue.lynxjs.org) 的 [wot-ui](https://wot-ui.cn/) API 兼容组件库 —— 原生性能、API 兼容，视觉与设计令牌全新设计。

`wot-lynx-ui` 参照 wot-ui（uni-app 生态最流行的 Vue3 组件库之一）的 **API 与交互**，为 **Vue Lynx** 框架从零重写的组件库：使用 Lynx 的双线程架构与原生渲染管线，在 iOS / Android / HarmonyOS / Web 四端获得接近原生的性能。组件名、props、slots、events、BEM 类名与 wot-ui 对齐，迁移成本低；设计令牌为全新的 `--wd-*` 三层体系（色阶 → 语义 → 组件），亮/暗双主题开箱即用。

## 特性

- **🎨 全新设计系统** — `--wd-*` 三层令牌体系（原始色阶/间距/圆角 → 亮暗语义令牌 → 组件令牌），小米 HyperOS 生命感美学 × 苹果 HIG 合成设计：品牌紫 `#7F5CFF`、Apple systemGray 中性阶梯、大圆角现代质感、base/elevated 暗色海拔；换肤只需覆盖 CSS 变量（设计依据见[设计美学研究](./docs/guide/design-research.md)）
- **⚡ 原生性能** — Lynx 双线程架构：Vue 运行在后台线程，渲染在主线程；拖动/滑动等高频交互在后台线程以响应式实现，跟手时段禁用 CSS transition、落位时恢复；细线边框使用 `1ppx` 物理像素；图标使用原生 SVG 渲染
- **🧩 API 兼容** — `wd-*` 组件名、props、slots、events 与 wot-ui 对齐，迁移成本低
- **📦 开箱即用** — 发布预编译 CSS，消费者无需安装 Sass 工具链；组件以源码分发，由 Rspeedy 直接编译，天然支持 Tree-shaking
- **🌗 主题系统** — CSS 变量驱动的亮色/暗色主题，`wd-config-provider` 全局配置
- **🧪 可测试** — 基于 @lynx-js/testing-environment 的 Vue Lynx 双线程测试环境，组件测试与真实渲染行为一致

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
import 'wot-lynx-ui/theme' // --wd-* 设计令牌
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
  <wd-cell-group border>
    <wd-cell title="按钮点击次数" :value="String(count)" />
  </wd-cell-group>
  <wd-button type="primary" @click="count++">点击 +1</wd-button>
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
> props / events / slots / 样式类名与 wot-ui 完全一致，详见[与 wot-ui 的差异](./docs/guide/differences.md)。

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

- [组件文档](./docs/)（VitePress）
- [Demo 应用](./packages/demo/)（`pnpm dev:demo`）
- [重写规范](./CONVENTIONS.md)（为 Lynx 重写的完整约定）

## 真机测试

仓库内置**真机测试 Demo**（59 个测试项的清单页），支持 Lynx Explorer 扫码直接在真机验证：

```bash
pnpm dev:device-test   # 启动后扫描终端中的 device-test 二维码
```

测试页覆盖：按钮按压缩态、Slider/SwipeAction 拖动跟手、弹层、表单键盘、长列表滚动、亮暗主题等。
详见[真机测试指南](./docs/guide/device-testing.md)。

## 开发

```bash
pnpm install          # 安装依赖
pnpm build:css        # 编译 SCSS → CSS（组件样式）
pnpm dev:demo         # 启动 Demo（Rspeedy dev server）
pnpm build:demo       # 构建 Demo（web + lynx 双端）
pnpm typecheck        # 类型检查
pnpm test             # 单元测试（Vue Lynx 双线程环境）
pnpm docs:dev         # 文档站
```

## 目录结构

```
wot-lynx-ui/
├── packages/
│   ├── ui/                       # wot-lynx-ui 组件库（源码分发）
│   │   ├── src/
│   │   │   ├── components/       # 102 个 wd-* 组件（types.ts + .vue + index.scss + index.css）
│   │   │   ├── composables/      # 组合式函数（useParent/useChildren/useTouch...）
│   │   │   ├── common/           # 工具函数 / props / 日期格式化（dayjs）/ vue-lynx Transition 兼容层
│   │   │   ├── icons/            # 482 个内置图标（registry 注册表：wot SVG 集 302 + iconfont 字体集 180，含 .ttf）
│   │   │   ├── locale/           # 16 种语言
│   │   │   └── styles/           # 主题变量 / mixin / BEM
│   │   ├── test/                 # 双线程测试环境与用例（vitest）
│   │   └── vitest.config.ts
│   └── demo/                     # Vue Lynx Demo 应用（Rspeedy，双端构建）
├── docs/                         # VitePress 文档站（102 个组件文档）
├── scripts/                      # CSS 编译
├── CONVENTIONS.md                # Lynx 重写规范
└── README.md
```

## 性能实现

| 交互 | 实现 |
|---|---|
| `WdSlider` 拖动 | 后台线程响应式：`useTouch` 计算增量，进度条样式经计算属性输出，跟手时段禁用 CSS transition |
| `WdSwipeAction` 横滑 | 后台线程响应式：方向判定后更新容器 `transform`，宽度限制与阈值状态机均在后台线程完成 |
| 按压缩态 | CSS `:active`（渲染器原生处理） |
| 细线边框 | `1ppx` 物理像素 |
| 图标 | SVG path + 原生 `<svg>` |
| 弹层 | `position: fixed` 自动提升至根节点 |

## 与 wot-ui 的差异

Lynx 是原生渲染引擎，与 Web/小程序运行时有本质差异，以下能力有适配或降级（详见 [CONVENTIONS.md](./CONVENTIONS.md)）：

| 能力 | wot-ui | wot-lynx-ui |
| --- | --- | --- |
| 图标 | iconfont 字体 | 双形态：wot 集 302 个走 SVG path + 原生 `<svg>`；iconfont 集 180 个走 .ttf 字体 + `<text>` 字形（482 个内置，可 `registerIconSet` 扩展） |
| 按压缩态 | `hover-class` | CSS `:active` 伪类（渲染器原生处理） |
| 细线边框 | `::after` + scale(0.5) | 原生 `border` + `1ppx` 物理像素 |
| 伪元素装饰 | `::before` / `::after` | 模板真实元素（`__bar` / `__hairline` 等类名） |
| 弹层传送 | `root-portal` / teleport | `position: fixed` 节点自动提升至根节点 |
| 圆环/二维码/条形码/签名/水印 | canvas 2D | SVG（path / rect / polyline / data URI） |
| 页面跳转 | `uni.navigateTo` | `uni` 兼容层降级，宿主可经 `configureUniAdapter` 注入路由 |
| 安全区 | `uni.getSystemInfoSync` | Lynx `SystemInfo`（安全区置零，可由宿主注入） |

## 致谢

- [wot-ui](https://wot-ui.cn/) — 组件库样式与 API 的来源
- [Vue Lynx](https://vue.lynxjs.org) — Vue 3 的 Lynx 自定义渲染器
- [Lynx](https://lynxjs.org) — 跨平台原生渲染引擎

## License

MIT
