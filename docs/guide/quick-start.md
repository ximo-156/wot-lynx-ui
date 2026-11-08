# 快速开始

## 环境要求

- 本仓库开发使用 Node.js >= 20、pnpm 10.24.0，实际版本以[根配置](<../../package.json>)为准。
- 消费应用使用 [Vue Lynx](https://vue.lynxjs.org) 与 [Rspeedy](https://lynxjs.org/rspeedy)；Vue / Vue Lynx 的 peer 范围见[组件包配置](<../../packages/ui/package.json>)，构建工具的 Node 要求以应用依赖为准。
- 组件含 Vue SFC/worklet 源码，由应用工具链编译；预编译 CSS 不表示组件可在裸 Node/SSR 中直接执行。

## 安装

```bash
pnpm add wot-lynx-ui vue-lynx vue
```

## 配置 lynx.config.ts

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

::: warning worklet 构建契约不能省略
这是本仓库当前工具链的完整双端配置示例：`includeWorkletPackages` 防止 npm 包被 MT loader 剔除；应用级 `optimization.sideEffects: false` 保留 MT bare import，避免 worklet 注册被 tree-shaking 剪掉。关闭该级优化可能增加后台包体，库侧仍保留 CSS/SCSS/TTF sideEffects 白名单，不改成 `true`。

npm 使用默认 `import` 分支，主题为预编译 CSS。workspace 源码直连虽不触发 loader 剔除，MT 剪枝仍需处理；本仓库 Demo 另有 `source` 条件及主题 CSS 映射，见[实际配置](<../../packages/demo/lynx.config.ts>)。新工作区走默认 dist 分支时先构建 UI；显式使用 source 时需处理主题 SCSS，不用主入口源码 alias 绕开 exports。构建优化后重新验证 worklet 契约，不能用 jsdom 模拟层证明生产可用。
:::

## 引入主题

```ts
// main.ts
import { createApp } from 'vue-lynx'
import 'wot-lynx-ui/theme' // --wot-* 设计令牌

import App from './App.vue'

createApp(App).mount()
```

## 使用组件

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

::: tip 标签与导出名不是同一件事
当前主入口命名导出为 `Button`、`Cell` 等；示例通过 `as WdButton` 等建立局部别名，因此模板使用 `<WdButton>`。也可以直接使用导入绑定的 `<Button>`，不需要修改组件库导出。

Vue Lynx 把 kebab-case 标签视为原生元素，未启用标签转换插件时必须使用 PascalCase。全局注册的 `WdButton` 是另一种使用方式；API 兼容范围与平台差异见[差异指南](<differences.md>)，并非所有行为完全一致。
:::

## 全局注册

```ts
import wotLynxUI from 'wot-lynx-ui'

createApp(App).use(wotLynxUI).mount()
```

全局注册后可直接使用 `<WdButton>` 等标签，无需逐个 import。

## 沿用 wot-ui 的 kebab-case 标签写法（可选）

将 `pluginWotLynxTags()` 加入上方完整配置的 plugins 数组（放在 `pluginVueLynx()` 前），保留其余宿主、主题、worklet 和 tools 配置：

```ts
import { pluginWotLynxTags } from 'wot-lynx-ui/plugin'
// 上方 plugins 数组追加 pluginWotLynxTags()；不要替换整份配置。
```

它将 `<wd-xxx>` 改为 `<WdXxx>`。仍须保留对应局部 `Wd*` 别名或全局注册；标签转换本身不会自动引入组件。

```vue
<template>
  <!-- 与 wot-ui 完全一致的写法 -->
  <wd-button type="primary" @click="count++">点击 +1</wd-button>
</template>
```

插件只改写 template 块内的组件标签，不影响属性名、事件名与文本内容。

## 运行 Demo

本仓库提供了一个包含全部组件演示的 Vue Lynx 应用：

```bash
pnpm install
pnpm dev:demo
```

启动后可访问 Web Preview 预览，或通过 Lynx Explorer 扫码在真机查看。

## Web 与宽屏适配

组件库同时支持 Lynx 原生渲染和 Lynx Web；宽屏不是把手机界面等比例放大。

- Demo：小于 1024px 为单列，1024px 起为两列，1440px 起为三列；内容最大宽度为 1440px，宽屏居中。
- 弹层：`WdPopup` 默认 `responsive=true`，视口达到 768px 后，底部面板改为限宽的居中模态框（默认最大 480px）。手机端仍为全宽底部面板。
- 对话框：宽屏默认 420px，可用 `--wot-dialog-wide-width` 覆盖；原有 `--wot-dialog-width` 定制仍有效。
- 定位通知、锚定菜单等保持原定位；自定义 `WdPopup` 可设 `:responsive="false"` 保留贴边/通栏行为，`customStyle` 仍可控制面板宽度。
- 文档预览可切换手机与 Web 模式，并选择 768 / 1024 / 1280 / 1440px；窗口不足时会显示实际画布尺寸，不以缩放图片冒充宽屏布局。

### Rspeedy Web 宿主

Lynx Web 的组件逻辑运行在 Worker 中，不能直接读取浏览器 `window`；`SystemInfo` 的屏幕像素也不等于应用视口。启用宿主插件，把实际 `lynx-view` 尺寸传入组件库，并监听尺寸变化：

```ts
import { pluginWotLynxWebFonts, pluginWotLynxWebViewport } from 'wot-lynx-ui/plugin'
// 将这两个插件放入完整配置的 plugins 数组；本页首个配置已经包含它们。
```

不要为启用 Web 插件删除前述主题/worklet 参数或 tools.rspack 配置。

插件处理普通 Web 宿主 HTML 和 Rspeedy 的固定预览页；不修改原生端，也不需要轮询尺寸。

应用布局可共用响应式视口，而不是在每个组件中各自猜测屏幕宽度：

```ts
import { computed } from 'vue-lynx'
import { useViewportSize, isDesktopViewport } from 'wot-lynx-ui'

const { width, height, refresh } = useViewportSize()
const columns = computed(() => isDesktopViewport(width.value) ? 2 : 1)
// 原生宿主没有尺寸通知时，可在宿主窗口变更后调用 refresh()。
```

自定义 Web 宿主应在创建 `lynx-view` 实例前设置 `browserConfig.windowWidth/windowHeight`；Vue Lynx Web 的尺寸消息通过主线程 SDK 的 JSContext 送至 Worker CoreContext：

```ts
view.browserConfig = { ...view.browserConfig, windowWidth: width, windowHeight: height }
// jsContext 为 Web 运行时提供的主线程 lynx.getJSContext()。
jsContext.dispatchEvent({ type: 'wot:viewport-change', data: { width, height } })
```

建议使用插件：它同时处理初始化、渲染就绪后的首次同步及后续尺寸变化；仅调用 `sendGlobalEvent` 在部分 Web SDK 中不足以唤起 Vue Lynx 的接收端。

也可在应用自己的宿主回调中调用 `setViewportOverride({ width, height })`；传 `null` 清除覆盖。媒体选择、真实网络上传、Canvas 等能力仍需按下节的宿主契约接入，不会因启用视口插件而假装可用。

## 注入宿主能力（原生模块契约）

Lynx 没有 `uni` 全局对象，本库也**不再提供任何 uni-app 兼容层**（ADR-022）。
引擎能力通过原生层读取，是否可用由实际运行时与 `getPlatform().capabilities` 决定；例如 video 元素需引擎/宿主支持，安全区需宿主 `SystemInfo` 提供对应数据。只有引擎管不到的能力才由宿主注册，按 Lynx 的标准扩展点：

1. `NativeModules.WotLynxUI`（宿主注册的原生模块）；
2. `lynx.getJSModule('WotLynxUI')`（宿主注册的 JS 模块）；
3. `configureHost({ ... })` 显式注入（Web 预览 / 单测 / 特殊宿主）。

```ts
import { configureHost } from 'wot-lynx-ui'

configureHost({
  // 路由（WdCell / WdGridItem / WdCurtain 的 url）
  navigateTo: (options) => router.push(options.url),
  redirectTo: (options) => router.replace(options.url),
  // 媒体选择与上传（WdUpload 依赖）
  chooseMedia: (options) => myPicker.pick(options),
  uploadFile: (options) => myUploader.upload(options),
  // 图片裁剪的像素导出（Lynx 无内置 canvas，需宿主提供）
  createCanvasContext: (id) => myCanvas.create(id),
  canvasToTempFilePath: (options) => myCanvas.export(options)
})
```

示例中的 `router`、`myPicker`、`myUploader`、`myCanvas` 由应用实现，并需符合对应回调/任务契约，不是库内自动提供的对象。三个注册入口均未提供某项宿主能力时，该能力不可用；引擎自带能力仍按运行时探测，不一并置为 false。组件按各自实现降级，不能将“无宿主”理解为 video 一定不可用或所有平台行为完全一致。完整契约见[host 类型](<../../packages/ui/src/common/host.ts>)和[差异指南](<differences.md>)。

## 已知构建提示（不影响使用）

使用 Rspeedy 构建时，CSS 压缩插件（css-minimizer-webpack-plugin 的
postcss-calc）可能对组件库中 `calc(var(--a, var(--b, ...)))` 形式的设计令牌
表达式输出 `Parse error` **警告**：这是 Lynx CSS 管线的中间表示与该插件解析器
不兼容所致，**最终产物的 CSS 声明完整保留**（可在构建输出的 CSS 中核对），
不影响样式渲染，可安全忽略。
