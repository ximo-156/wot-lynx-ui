# wot-lynx-ui

基于 [Vue Lynx](https://vue.lynxjs.org) 的 [wot-ui](https://wot-ui.cn/) 适配组件库。

## 特性

- **wot-ui 同源视觉** — 保留 wot-ui 2.3.2 的 `--wot-*` 设计令牌与默认取值（品牌蓝 `#1C64FD`，同源字号、间距和圆角）
- **原生性能** — Lynx 双线程架构；细线边框使用 `1ppx` 物理像素；内置图标使用原始 TTF 字体渲染
- **API 兼容** — `Wd*` 组件命名（PascalCase 标签）、props、slots、events 与 wot-ui 对齐
- **开箱即用** — 发布预编译 CSS，消费者无需安装 Sass 工具链

## 快速开始

```bash
pnpm add wot-lynx-ui vue-lynx vue
```

```ts
// lynx.config.ts
import { defineConfig } from '@lynx-js/rspeedy'
import { pluginVueLynx } from 'vue-lynx/plugin'

export default defineConfig({
  environments: { lynx: {}, web: {} },
  plugins: [
    pluginVueLynx({
      enableCSSInheritance: true,
      enableCSSInlineVariables: true
    })
  ],
  source: { include: [/wot-lynx-ui/] }
})
```

```ts
// main.ts
import { createApp } from 'vue-lynx'
import 'wot-lynx-ui/theme'
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
    <WdCell title="点击次数" :value="String(count)" />
  </WdCellGroup>
  <WdButton type="primary" @click="count++">点击 +1</WdButton>
</template>
```

## 注意：组件标签使用 PascalCase

Vue Lynx 的编译器将所有 kebab-case 标签视为 Lynx 原生元素，
因此组件必须使用 **PascalCase 标签**（`<WdButton>`）。
props / events / slots / 样式类名与 wot-ui 完全一致。

## 组件列表

共 101 个组件（与 wot-ui 对应），包括：
Button、Cell、Icon、Loading、ConfigProvider、Transition、Overlay、Popup、Dialog、
ActionSheet、Toast、Notify、Input、Textarea、Switch、Radio、Checkbox、Slider、Rate、
Picker、DateTimePicker、Calendar、Cascader、Tabs、Tabbar、Sidebar、Steps、Swiper、
Table、Grid、Collapse、IndexBar、Navbar、Search、Form、Upload、Skeleton、NoticeBar、
Progress、CountDown、Watermark、Tour、Popover、Tooltip、Fab、SwipeAction、
FloatingPanel 等。

完整文档见 <https://wot-lynx-ui.github.io>。

## License

MIT
