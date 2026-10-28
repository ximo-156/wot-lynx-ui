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
