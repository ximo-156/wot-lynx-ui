# 快速开始

## 环境要求

- Node.js 18 及以上
- 基于 [Vue Lynx](https://vue.lynxjs.org)（vue-lynx >= 0.5）与 [Rspeedy](https://lynxjs.org/rspeedy) 的应用

## 安装

```bash
pnpm add wot-lynx-ui vue-lynx vue
```

## 配置 lynx.config.ts

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

::: tip 组件标签使用 PascalCase
Vue Lynx 的编译器将所有 kebab-case 标签视为 Lynx 原生元素，因此组件必须使用 **PascalCase 标签**（`<WdButton>`）。这与 wot-ui 的 `<wd-button>` 写法不同，是 Vue Lynx 生态的统一约定（props / events / slots / 样式类名与 wot-ui 完全一致）。
:::

## 全局注册

```ts
import wotLynxUI from 'wot-lynx-ui'

createApp(App).use(wotLynxUI)
```

全局注册后可直接使用 `<WdButton>` 等标签，无需逐个 import。

## 沿用 wot-ui 的 kebab-case 标签写法（可选）

安装 `pluginWotLlynxTags` 插件后，业务模板中的 `<wd-xxx>` 会在构建时被自动改写为
`<WdXxx>`，无需修改现有代码：

```ts
// lynx.config.ts
import { defineConfig } from '@lynx-js/rspeedy'
import { pluginVueLynx } from 'vue-lynx/plugin'
import { pluginWotLynxTags } from 'wot-lynx-ui/plugin'

export default defineConfig({
  environments: { lynx: {}, web: {} },
  plugins: [
    pluginWotLynxTags(),
    pluginVueLynx({
      enableCSSInheritance: true,
      enableCSSInlineVariables: true
    })
  ]
})
```

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

export default defineConfig({
  environments: { lynx: {}, web: {} },
  plugins: [
    pluginWotLynxWebFonts(),
    pluginWotLynxWebViewport(),
    pluginVueLynx({ enableCSSInheritance: true, enableCSSInlineVariables: true })
  ]
})
```

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

## 注入宿主能力（uni 兼容层）

Lynx 环境没有 `uni` 全局对象。组件库内部通过 `common/uni.ts` 兼容层安全降级；
涉及宿主能力的 API（页面跳转、媒体选择、Toast、canvas 裁剪等）可通过
`configureUniAdapter` 注入真实实现：

```ts
import { configureUniAdapter } from 'wot-lynx-ui'

configureUniAdapter({
  // 页面跳转（WdCell 的 url / replaceUrl、WdGridItem 的 url 等）
  navigateTo: (options) => router.push(options.url),
  redirectTo: (options) => router.replace(options.url),
  // 上传（WdUpload 依赖）
  chooseMedia: (options) => myPicker.pick(options),
  uploadFile: (options) => myUploader.upload(options),
  // 图片裁剪（WdImgCropper 的像素裁剪依赖 canvas 能力）
  createCanvasContext: (id) => myCanvas.create(id),
  canvasToTempFilePath: (options) => myCanvas.export(options)
})
```

未注入时相关 API 仅 warning 降级（不会崩溃），详见[与 wot-ui 的差异](./differences.md)。

## 已知构建提示（不影响使用）

使用 Rspeedy 构建时，CSS 压缩插件（css-minimizer-webpack-plugin 的
postcss-calc）可能对组件库中 `calc(var(--a, var(--b, ...)))` 形式的设计令牌
表达式输出 `Parse error` **警告**：这是 Lynx CSS 管线的中间表示与该插件解析器
不兼容所致，**最终产物的 CSS 声明完整保留**（可在构建输出的 CSS 中核对），
不影响样式渲染，可安全忽略。
