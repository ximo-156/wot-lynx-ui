# 主题与设计令牌

wot-lynx-ui 保留 **wot-ui 2.3.2 的设计令牌命名与度量体系**（`--wot-*`）：字号、间距、圆角、描边以及原始色阶继续使用官方刻度。默认品牌色和文字色使用独立 `--wot-brand-*` 令牌，由亮 / 暗语义层引用；这不是官方蓝色默认主题，也不代表逐像素视觉一致。现有 `themeVars` 键和 CSS 变量名继续保留。

亮色默认品牌：**主色 `#755FFE`、次主题色 `#9A89FF`、主文字 `#2D273D`、次文字 `#979797`**。成功 / 危险 / 警告语义保持原有绿 / 红 / 橙色，不因品牌定制而改色。

## 令牌体系

| 层 | 文件 | 内容 | 示例 |
| --- | --- | --- | --- |
| 原始刻度 | `packages/ui/src/styles/theme/base/` | 色阶 / 数值 / 圆角 / 字体 / 排版 / 透明度 / 描边 / 间距，主题无关 | `--wot-blue-6`、`--wot-n-16` |
| 独立品牌 | `packages/ui/src/styles/theme/base/color.scss` | 单独追加品牌紫色与亮色文字令牌，不覆盖原始刻度 | `--wot-brand-6`、`--wot-brand-text-main` |
| 语义令牌 | `packages/ui/src/styles/theme/light.scss` / `dark.scss` | 亮 / 暗双主题语义别名 | `--wot-primary-6`、`--wot-text-main` |
| 组件令牌 | `packages/ui/src/components/` | 组件私有变量，回退到语义/原始刻度 | `--wot-button-primary-bg` |

主题入口：`import 'wot-lynx-ui/theme'`。需要自行编译时使用包内发布的 SCSS 源码，见下文；不要将 `wot-lynx-ui/theme/scss` 当作已声明的包导出。

## 语义色

| 角色 | 亮色令牌 | 亮色值 |
| --- | --- | --- |
| 主色 | `--wot-primary-1` ~ `--wot-primary-10` / `--wot-primary-main` | 独立品牌紫色阶（6 档 `#755FFE`） |
| 次主题色 | `--wot-primary-secondary` | `#9A89FF` |
| 危险 | `--wot-danger-main` / `-hover` / `-clicked` / `-disabled` / `-particular` / `-surface` | 红色阶 |
| 成功 | `--wot-success-main` 等 | 绿色阶 |
| 警告 | `--wot-warning-main` 等 | 橙色阶 |
| 文字 | `--wot-text-main` / `-secondary` / `-auxiliary` / `-disabled` / `-placeholder` | 主文字 `#2D273D`、次文字 `#979797`；其余保留 coolgrey 阶 |
| 图标 | `--wot-icon-main` 等（同文字阶梯） | 主 / 次图标跟随品牌文字色，其余保留 coolgrey 阶 |
| 边框 | `--wot-border-extra-strong` / `-strong` / `-main` / `-light` / `-white` / `-zero` | coolgrey 阶 |
| 填充 | `--wot-filled-extra-strong` / `-strong` / `-content` / `-bottom` / `-oppo` / `-zero` | coolgrey 阶 |
| 分割线 | `--wot-divider-main` / `-light` / `-strong` | 黑色透明度阶 |
| 反馈 | `--wot-feedback-hover` / `-active` / `-accent` | hover / active 为黑色透明度阶，accent 为品牌紫色透明色 |

## 原始刻度

- **原始色阶**：`blue` / `lightblue` / `pink` / `red` / `volcano` / `orange` / `yellow` / `green` / `cyan` / `grape` / `purple` / `coolgrey` / `neutralgrey` / `warmgrey`，各 10 档 + `-opac` 透明色（如 `--wot-blue-1` ~ `--wot-blue-10`、`--wot-blue-opac`）；透明度阶 `--wot-opac-*` / `--wot-opacwhite-*`。原始 `--wot-blue-6` 仍为官方 `#1C64FD`，不能因为默认品牌改紫就重写这套蓝色刻度。
- **独立品牌色阶**：`--wot-brand-1` ~ `--wot-brand-10` / `--wot-brand-opac`，另有 `--wot-brand-secondary`、`--wot-brand-text-main`、`--wot-brand-text-secondary`；亮色 `--wot-primary-*` 和主 / 次文字语义引用这些令牌。
- **数值**：`--wot-n-0` ~ `--wot-n-248`、`--wot-n-full`（9999px）。
- **圆角**：`--wot-radius-zero` / `-small`(2) / `-main`(4) / `-large`(8) / `-extra-large`(12) / `-super-large`(16) / `-ultra-large`(20) / `-full`。
- **排版**：`--wot-typography-title-*` / `-body-*` / `-label-*`（字号 / 行高 / 字重 / 字体族）。
- **字重**：`--wot-font-weight-ultra-light` ~ `-bold`。
- **间距**：`--wot-padding-*` / `--wot-spacing-*`（ultra-tight 2px ~ ultra-spacious 48px）。
- **描边**：`--wot-stroke-light`(0.5) / `-zero` / `-main`(1) / `-bold`(2)。
- **透明度**：`--wot-opacity-disabled`(0.4) / `-dimmer`(0.6) / `-overlay`(0.75) / `-backdrop`(0.3)。
- **选择器视图遮罩**：`--wot-picker-view-mask-start-color` / `-end-color`。

## 暗色模式

```vue
<template>
  <WdConfigProvider theme="dark">
    <App />
  </WdConfigProvider>
</template>
```

`WdConfigProvider` 给根 view 挂 `wot-theme-light` / `wot-theme-dark` 类切换语义令牌；暗色主色采用较亮的品牌档位（`#9A89FF`），主 / 次文字切换为适合深色背景的浅色 coolgrey，不把亮色主文字 `#2D273D` 直接用于暗色背景。`position: fixed` 弹层被 Lynx 提升到页面根节点后会脱离该子树，由 `.wd-root-portal` 容器镜像同名变量保持亮暗一致。

## 自定义主题变量

```vue
<template>
  <WdConfigProvider :theme-vars="{ primary6: '#7232dd' }">
    <App />
  </WdConfigProvider>
</template>
```

`themeVars` 的键为驼峰形式，内部经 `mapThemeVarsToCSSVars` 转换为 `--wot-<kebab-case>` CSS 变量（键集合见 [theme-vars.ts](<../../packages/ui/src/composables/theme-vars.ts>)）。

这些变量**不是**通过 `:style` 对象通道下发的：Lynx 的 `SET_STYLE` 逐属性写入会丢弃
`--custom-property`（浏览器 CSSOM 与测试环境 jsdom 同语义）。组件把变量拼成声明串写入
根节点的 `style` 属性（`style="--wot-primary-6:#FF8800;"`），普通 `customStyle` 仍走
对象语法，两者按「变量键 / 普通键」分工；变量撤回时补空声明（`--k:;`）覆盖旧值。
该行为已在真实 Lynx Web 预览中实测（`getComputedStyle(...).getPropertyValue()` 返回覆盖值）。

单元测试环境不解析 CSS 变量，断言请直接读取 `style` 属性字符串；纯原生渲染宿主
（无 `document`）跳过属性写入，此时仅 `wot-theme-*` 类令牌生效。详见
[differences.md](./differences.md#主题变量与内联样式通道已实测)。消费者可以选择其他主色，上例的 `#7232dd` 是自定义覆盖，不是库的默认品牌色。直接覆盖语义令牌时使用对象绑定，例如 `:theme-vars="{ primary6: '#755FFE', primarySecondary: '#9A89FF', textMain: '#2D273D', textSecondary: '#979797' }"`。

## 对照范围与品牌例外

运行时 props 对照使用官方 2.3.2 的 101 个顶层组件目录（含空占位）与 5 个内部模块，共 1,402 个 prop 契约（`test/fixtures/wot-ui-2.3.2-props.json`）；当前没有未豁免的运行时差异，另有 6 个本地扩展组件（不对应官方目录）。例外仅为 `customStyle` 接受字符串和对象，以及 `WdCircle.color` 默认 `#1C64FD` → `#755FFE` 的品牌调整。设计令牌的品牌定制不改变官方组件的布局、尺寸或状态色；TypeScript 泛型 / 别名 / 联合类型不由该运行时守卫验证，这也不是全量测试通过或视觉完全一致的声明。

## SCSS 深度定制

组件库同时发布 SCSS 源码（`packages/ui/src/**/*.scss`），需要深度定制的使用者可以自行编译：

```bash
# 组件库仓库内
node scripts/build-css.mjs
```
