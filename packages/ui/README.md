# wot-lynx-ui

基于 [Vue Lynx](https://vue.lynxjs.org) 的 [wot-ui](https://wot-ui.cn/) 适配组件库。

## 特性

- **同源令牌，独立品牌** — 保留 wot-ui 2.3.2 的 `--wot-*` 命名、原始色阶及字号、间距、圆角；默认主色 `#755FFE`、次主题色 `#9A89FF`、亮色主文字 `#2D273D`、次文字 `#979797`，品牌色不覆盖官方 `--wot-blue-*` 原始刻度
- **原生性能** — Lynx 双线程架构，跟手交互使用声明式 Main Thread Script；细线边框使用 `1ppx` 物理像素；内置图标使用原始 TTF 字体渲染
- **API 兼容** — 保留官方组件命名（PascalCase 标签）与迁移契约；运行时 props 守卫与适配范围见下文，不宣称全部 TypeScript 类型或交互完全一致
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
以 wot-ui 2.3.2 为兼容参考；宿主能力、品牌默认值与运行时差异需结合具体组件说明，不承诺全部行为完全一致。

## 组件列表

主入口公开 **106 个组件**：100 个有实际功能的官方对应组件 + 6 个本地扩展；官方空占位 `wot-ui` 不作为主入口公开组件计数。主要组件包括：
Button、Cell、Icon、Loading、ConfigProvider、Transition、Overlay、Popup、Dialog、
ActionSheet、Toast、Notify、Input、Textarea、Switch、Radio、Checkbox、Slider、Rate、
Picker、DateTimePicker、Calendar、Cascader、Tabs、Tabbar、Sidebar、Steps、Swiper、
Table、Grid、Collapse、IndexBar、Navbar、Search、Form、Upload、Skeleton、NoticeBar、
Progress、CountDown、Watermark、Tour、Popover、Tooltip、Fab、SwipeAction、
FloatingPanel 等。6 个本地扩展为 AddressEdit、BarCode、Coupon、PullRefresh、ShareSheet、SubmitBar；它们在当前官方离线包中没有对应 props 定义。

## 运行时 props 对照

官方 2.3.2 离线参考含 101 个顶层组件目录（含空占位 `wot-ui`）与 5 个内部 props 模块。守卫从 98 个运行时类型文件与 3 个 SFC 定义生成官方 fixture，覆盖 **1,462 个 prop 契约**，当前没有未豁免的运行时差异。仅允许 `customStyle` 的官方 `String` → 本地 `[String, Object]` 扩展，以及 `WdCircle.color` 默认值 `#1C64FD` → `#755FFE` 的品牌差异。

检查范围是 prop 名称、运行时构造器 / required / 默认值、工厂值及 canonical source、validator source；**TypeScript 泛型、别名与联合类型未由此守卫证明一致**。这也不是全部事件、交互、真机能力或全量测试通过的证明；6 个本地扩展的官方 props 明确未验证。

仓库内守卫：[check-wot-props.mjs](<../../scripts/check-wot-props.mjs>)、[官方 fixture](<test/fixtures/wot-ui-2.3.2-props.json>)、[props 回归测试](<test/wot-parity-props.test.ts>)。

完整文档见 <https://wot-lynx-ui.github.io>。

## License

MIT
