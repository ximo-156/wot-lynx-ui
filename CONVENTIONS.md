# wot-lynx-ui 组件重写规范（CONVENTIONS）

> 本文档是重写 wot-lynx-ui 组件库的**唯一权威规范**。所有重写工作必须严格遵守。
>
> **重写，不是移植**：wot-ui 仅作为 **API 与交互参考**（props / slots / events /
> 组件名与其对齐），不作为源码转换来源。每个组件都是为 Vue Lynx 从零手写的
> 全新实现；视觉与设计令牌按本文档第 3 节的体系重新设计。

## 0. 源与目标

- **API 参考**：wot-ui 2.3.2 源码（`/tmp/wot-ui/src/uni_modules/wot-ui/components/<component>/`）
  - `types.ts` — props 定义（含详细中文注释），重写时保持 props 名称/类型/默认值一致
  - `<name>.vue` — 交互逻辑参考（事件、状态机、边界处理），**不复制代码**
- **目标**：`packages/ui/src/components/<component>/`（三文件 + 生成的 `index.css`）
  - `types.ts` — props 定义，import 自 `vue-lynx` 与 `../../common/props`
  - `wd-xxx.vue` — 全新实现
  - `index.scss` — 全新样式，消费 `--wot-*` 设计令牌（与 wot-ui 2.3.2 同源）

## 1. 总体原则

1. **API 兼容优先**：props / slots / events / 组件名 / BEM 类名与 wot-ui 保持一致，用户无感迁移。
2. **视觉重新设计**：不再沿用 wot-ui 的 `--wot-*` 令牌与视觉取值，按第 3 节的新设计系统实现。
3. **原生性能**：能用 CSS（`:active`、transition、animation）解决的不用 JS；高频交互（拖动、滑动）在后台线程用响应式实现（禁止 Main Thread Script，见 §9）。
4. **为 Lynx 而写**：不是"把 Web 代码改到能跑"，而是按 Lynx 渲染引擎的约束与能力设计实现（文本必须 `<text>`、无伪元素、linear 布局等，见 §4/§5/§14）。
5. **渐进增强**：平台不支持的能力（canvas、渐变 SVG 等）给出降级方案并在文件头注释说明。
6. **成熟方案优先**：通用能力（时间格式化、过渡动画状态机等）优先使用市面成熟方案
   （dayjs、vue-lynx 内置 Transition 等），不自研通用逻辑；自研只用于 Lynx 平台特化
   适配层（如 wd-transition 对框架 Transition 的显隐契约 / 事件映射）。

## 2. 目录与文件规范

```
packages/ui/src/components/wd-xxx/
├── types.ts          # props 定义，import 自 'vue-lynx' 与 '../../common/props'
├── wd-xxx.vue        # 组件实现（全新手写）
└── index.scss        # 样式（消费 --wot-* 令牌）
```

`index.css` 由 `node scripts/build-css.mjs` 自动生成，**不要手动编辑**。

## 3. 设计系统（与 wot-ui 2.3.2 同源的 --wot-* 体系）

**令牌体系直接采用 wot-ui 2.3.2 的设计规范**（`--wot-*` 命名空间，与官方源码逐值一致）——
消费方从 wot-ui 迁移时，既有主题定制（`themeVars` 键、CSS 变量覆盖）零改动可用：

| 层 | 文件 | 内容 | 示例 |
| --- | --- | --- | --- |
| 原始刻度 | `styles/theme/base/*.scss` | 色阶/数值/圆角/字体/排版/透明度/描边/间距，主题无关 | `--wot-blue-6`、`--wot-n-16` |
| 语义令牌 | `styles/theme/light.scss` / `dark.scss` | 亮/暗双主题语义别名 | `--wot-primary-6`、`--wot-text-main` |
| 组件令牌 | 各组件 `index.scss` | 组件私有变量，回退到语义/原始刻度 | `--wot-button-primary-bg` |
| SCSS 映射 | `styles/variable.scss` | SCSS 变量 → CSS 变量（含字面量回退），组件样式经它消费令牌 | `$primary-6: var(--wot-primary-6, #1C64FDFF)` |

**主题机制**：`import 'wot-lynx-ui/theme'` 引入全部令牌；`WdConfigProvider`
的 `theme="dark"` 给根 view 挂 `wot-theme-dark` 类切换语义令牌；
`themeVars` prop 将 camelCase 键映射为 `--wot-<kebab>` 内联变量
（完整键集合见 `composables/theme-vars.ts`，与 wot-ui 的 theme-vars 生成物一致）。
`position: fixed` 弹层被提升到页面根节点后会脱离主题子树，因此
`.wd-root-portal` 容器内镜像同名变量（见 `styles/theme/index.scss` 选择器）。

**JS 镜像**：需要"用 JS 算颜色"的场景（如 svg content 不继承 currentColor），
用 `common/theme.ts` 的色板常量，与 `styles/theme/base/color.scss` 保持一致
（`test/unit/theme-token-parity.test.ts` 机器守护两侧不漂移）。

## 4. .vue 文件模板

```vue
/*
 * wd-xxx — 组件中文名
 *
 * Lynx 实现说明：（如有适配点，逐条说明；没有则省略本块）
 */
<script lang="ts" setup>
import './index.css'

import { computed, ref } from 'vue-lynx'
import { xxxProps } from './types'
// ... 其余 import 一律从 'vue-lynx'，禁止从 'vue'

defineProps(xxxProps)
// ...
</script>

<template>
  <!-- 所有文本必须在 <text> 中 -->
</template>
```

**强制规则：**

| 规则 | 说明 |
| --- | --- |
| import 来源 | 一律 `from 'vue-lynx'`（ref/computed/watch/Transition 等均由其再导出） |
| 样式引入 | `import './index.css'` 放在 `<script setup>` 第一行；**禁止** `<style>` 块 |
| 顶层注释 | **禁止在 SFC 顶层注释中出现 `<xxx>` 形式的标签**（如 `<view>`、`<svg>`），Vue 解析器会将其识别为自定义块导致编译失败。写成 "view 元素" 即可 |
| 裸文本 | `<view>` 内的所有文本必须包裹 `<text>`；`{{ }}` 插值同理 |
| 按压缩态 | 用 `:active` 伪类（CSS 实现），**不要**用 touch 事件 + JS state |
| options 块 | 不需要 `<script>` options 块 |
| 条件编译 | 禁止 `// #ifdef` / `// #ifndef` / `// #endif` 等 uni-app 条件编译残留 |
| 组件标签 | 模板内组件一律 PascalCase（`<WdButton>`）；kebab-case 会被 Lynx 编译器判为原生元素。业务代码若沿用 wot-ui 的 `<wd-button>` 写法，必须启用 `pluginWotLynxTags()`（构建期改写，见 `plugin/tag-transform-loader.cjs`） |
| 原生元素 | 只允许 Lynx 内置元素（view / text / image / scroll-view / list / list-item / swiper / swiper-item / input / textarea / switch / checkbox / radio / slider / form / label / svg / video / web-view / page）。**禁止 uni-app 的 `<block>`**（用 `<template v-else>` 做无渲染占位）；误用会触发 603 sub_code 60301 "Can't find ui tag" 并白屏。守卫测试：`test/component/native-tag-whitelist.test.ts`。⚠️ `video` 是 XElement——宿主引擎未注册 video 原生组件时创建节点抛引擎级 990200「No BehaviorController defined for class video」，随后属性更新再抛 60301（2026-10-25 真机实测）；挂载 `<video>` 前必须以 `capabilities.videoContext`（宿主注入 `createVideoContext`）门控，无能力时降级（见 wd-video-preview 的封面占位） |
| 横向布局 | 依赖横向排列的容器必须显式 `display: flex`（见 §14） |

## 5. SCSS 规范（index.scss）

1. 只消费 `--wot-*` 令牌（语义令牌优先，原始刻度次之）；组件私有令牌以
   `--wot-<component>-*` 命名（即 wot-ui 文档 cssVars 表中的定制点，消费者按名覆盖）。
2. 共享 mixin（`styles/mixin/mixin.scss`）：BEM 的 `b/e/m/when/me`、
   `halfPixelBorder` / `pixelBorder` 系列（原生 border + 1ppx）、`lineEllipsis`。
3. 组件私有令牌定义在文件头部，回退到语义令牌：
   `$button-primary-bg: var(--wot-button-primary-bg, $primary-6) !default;`
4. 需要作者处理的 Lynx 限制：
   - `::before` / `::after` → 模板中的真实元素 + 对应类名（如 `__bar`、`__hairline`）
   - `:nth-child()` / `:first-child` / `:last-child` → `v-for` 中按索引生成类名或内联样式
   - `conic-gradient` / `-webkit-line-clamp` / `-webkit-box` → Lynx 不支持，需替换方案
   - `!important` → Lynx 默认不支持，去掉
   - `:deep(...)` / `::v-deep` → 去掉（全局样式直接写后代选择器）
   - `display: inline-flex` / `inline-block` → 改为 `display: flex` + `flex-direction: row`
5. **`m()` 与 `when()` 必须与 DOM 实际类名一致（静默丢样式的头号根源）**：
   `m(size)` 生成 `.wd-xxx--size`，`when(size)` 生成 `.wd-xxx.is-size`。
   与 Vue 侧 `rootClass` 推送的类名（`is-${size}` 或 `--${size}`）**任一方
   写错都不报错**——CSS 规则 simply 不匹配，整组声明（height / padding /
   font-size / background…）被静默丢弃，表现为「内边距一直不显示、按钮塌成
   内容高度」。wd-button 尺寸类即为此 bug（SCSS 用 `m()` 生成 `--medium`，
   DOM 推 `is-medium`，按钮全部丢失高度与内边距）。
   **规则**：新增/修改状态类时，先确认 DOM 推的类名形式再选 mixin；嵌套
   写法（如 `when(icon)` 内的 `&.is-mini`）与外层尺寸类必须同源。
   **验证**：`pnpm build:css` 后 grep 生成的 `index.css`，确认选择器与
   模板类名一致（如 CSS 的 `.wd-button.is-medium` ↔ DOM 的 `is-medium`）。
6. 多行省略：CSS 保留 `overflow:hidden; text-overflow:ellipsis`，模板同步给
   `<text>` 加 `text-maxline="N"` 属性。
7. 已知约束：令牌回退链多层嵌套 `var()` 出现在 `calc()` 内时，cssnano 的
   postcss-calc 会输出 `Parse error` 告警——仅告警，产物正确。Demo 已通过
   关闭 cssnano 的 `calc` 转换消除告警，组件样式保持原样即可。

## 6. 事件映射

| uni-app | Lynx / vue-lynx |
| --- | --- |
| `@click` | `@tap` |
| `@touchstart` `@touchmove` `@touchend` | 同名（Lynx 原生支持） |
| `hover-class="x"` | CSS `:active` + 对应类名样式 |
| `catchtouchmove` | `@touchmove.stop` |

## 7. 已就绪的基础设施（直接 import 使用）

```ts
import { useParent } from '../../composables/useParent'
import { useChildren, flattenVNodes, sortChildren } from '../../composables/useChildren'
import { useQueue } from '../../composables/useQueue'
import { useTouch } from '../../composables/useTouch'
import { useRaf } from '../../composables/useRaf'
import { useCountDown } from '../../composables/useCountDown'
import { useTranslate } from '../../composables/useTranslate'
import { useCell } from '../../composables/useCell'
import { useConfigProvider } from '../../composables/useConfigProvider'
import { useGlobalConfig } from '../../composables/useGlobalConfig'
import { useFormDisabled } from '../../composables/useFormDisabled'
import { useLockScroll } from '../../composables/useLockScroll'
import { useDeviceInfo } from '../../composables/useDeviceInfo'
import { usePopover } from '../../composables/usePopover'
import { useUpload } from '../../composables/useUpload'

import { addUnit, isDef, objToStyle, getRect, getSystemInfo, deepMerge, ... } from '../../common/util'
import { defineStyleKeys, resolveStyle } from '../../common/style'  // Style Funnel（§20）
import { baseProps, makeBooleanProp, makeNumberProp, makeStringProp, makeNumericProp, numericProp } from '../../common/props'
import { callInterceptor } from '../../common/interceptor'
import { formatDate, getMonthDays, getFirstDayOfWeek } from '../../common/formatDate'  // 基于 dayjs
import { AbortablePromise } from '../../common/AbortablePromise'
import { Transition } from '../../common/lynxTransition'  // vue-lynx 内置 Transition（含 props 兼容补齐）
import { BLUE, GRAY, GREEN, AMBER, RED } from '../../common/theme'

// 全局配置契约（composable 层自有，禁止组件反向依赖）
import { CONFIG_PROVIDER_KEY, mergeConfig } from '../../composables/global-config'
```

注意：`useDeviceInfo` 的 `getSystemInfo()` 基于 Lynx `SystemInfo` 全局对象；安全区数据 Lynx 不提供（置零，可由宿主注入）。

**依赖方向**：composable / common 层不得 import 组件目录；组件 import composable。
共享契约（cell-group、form、config-provider 的 provide 类型与 key）定义在
composable 层（`useCell.ts` / `useFormDisabled.ts` / `global-config.ts`）。

## 8. wd-icon 与 SVG 硬约束

- 内置图标经图标注册表 `src/icons/registry.ts` 组织，**单一内置集合**：
  iconfont 集（`src/icons/sets/iconfont.ts`，180 个，移动端成套图标）：
  **.ttf 字体图标**（`src/icons/fonts/iconfont.ttf` + 同目录 `iconfont.css` 的
  `@font-face`，族名 `wd-iconfont`），由 `scripts/generate-iconfont.mjs` 从
  iconfont.cn 导出物生成（码点取自 `iconfont.json` 的 `glyphs[].unicode`，
  `--check` 校验 TS 模块与字体字节）。
- 组件内部用到的图标一律从这 180 个中挑选（navbar / pagination 左箭头取
  `arrow-left-bold`，rate 星星取 `favorite-filling`，empty 默认图取
  `folder-close` 等）；内置集没有对应字形的形态用 CSS 绘制——radio /
  checkbox 的未选中空心圆/方与 dot 选中态圆心点，经边框 + `currentColor`
  实现（见 `wd-radio` / `wd-checkbox`）。
- 字体渲染的 Lynx 约束：CSS 不支持 `::before/::after`，经典
  `.icon-x::before { content: '\e6a3' }` 写法不可用；wd-icon 字体模式把码点
  字形直接作为 `<text>` 子节点渲染，显式设置 `font-family / font-size / color /
  line-height`（Lynx text 不依赖继承）。字体文件由 Rspeedy 资产管线产出静态
  地址，随包发布、无网络请求。
- 寻址规则：name 不带前缀按注册顺序回退查找（内置集优先，存量行为不变）；
  带 `集合键:图标名` 前缀（如 `iconfont:menu`）精确命中指定集合（注册了多套
  集时消歧）。新增一套图标：实现 `IconSet` 接口（`src/icons/types.ts`，
  SVG 集 / 字体集联合类型）并 `registerIconSet()`，wd-icon 无需改动；
  回归见 `test/component/icons-registry.test.ts`。
- `<wd-icon name="close" :size="20" color="#f00" />`：命中内置字体集时渲染
  `<text>` 字形；命中扩展注册的 SVG 集时渲染 `<svg :content>`（多 path 图标
  输出多个 `path`，fill 统一注入）；name 含 `/` 时按图片渲染 `<image>`；
  `css-icon` 走 CSS 类名模式。
- 默认颜色由 `--wot-icon-main`（CSS 继承，需宿主开启 enableCSSInheritance）。组件内使用图标时，如需跟随文字色，显式传 `:color`
  （Lynx 的 svg content 与字体字形均不继承 CSS currentColor，需 JS 侧用
  `common/theme.ts` 常量计算）。

### SVG content 元素白名单（真机硬约束）

`<svg :content>` 的标记由 Lynx 引擎的 SVG 解析器在建树时逐元素插入节点，
**只支持以下元素**（本库已验证真机可用）：`svg` / `g` / `path` / `rect` /
`circle` / `polyline`。content 中一旦出现白名单外元素（`defs` /
`linearGradient` / `radialGradient` / `stop` / `clipPath` / `image` /
`text` / `use` 等），真机 `PaintingContext.insertNode` 会抛
`RuntimeException: Insertion (new) failed due to unknown child signature`
（Lynx 错误码 9902），属于致命异常且 JS 侧无法捕获。

因此：

- 渐变一律降级为纯色（取首个色标），如 `wd-circle` 的颜色对象、`wd-qr-code` 的
  `enableGradient`（导出 data URI 走标准 SVG，可保留渐变）；
- 图片一律用原生 `<image>` 元素叠加，不内嵌进 svg content（如 `wd-qr-code` 的
  `backgroundImage` / `logo`、`wd-bar-code` 的显示文本用原生 `<text>` 叠加）；
- **渲染路径统一过 `sanitizeSvgContent()` 安全网**（`common/util.ts`）：白名单外
  元素连同子树整体剔除，把潜在的白名单违规从"致命崩溃"降级为"忽略该元素"。
- 新增组件生成 SVG 标记时，只允许使用白名单元素。

## 9. 弹层类组件规范（popup / dialog / action-sheet / toast / notify 等）

- 结构：`wd-root-portal > wd-popup-wrapper > [wd-overlay + wd-transition]`，与 wot-ui 一致。
- Lynx 中 `position: fixed` 节点会被提升到页面根节点，因此**不需要** teleport；wd-root-portal 仅作为携带主题变量的容器。
- 弹出层定位一律 `position: fixed`（center 用 `left/right/top/bottom: 0` + flex 居中；bottom/top/left/right 用对应贴边）。
- **`fixed` 节点必须是动画/显隐节点本身，不能是它的子节点**（2026-10-19 演示页实测）：
  提升后的节点不再受父级 `display:none` 约束——`wd-backtop` 旧实现把 `position: fixed`
  放在 `wd-transition` 的子 view 上，阈值未到时按钮照样常驻屏幕；同理，**弹层插槽内容
  禁止写 `position: fixed`**（演示页的遮罩内容因此「遮罩关不掉、内容常驻、点击不冒泡」），
  需要居中就撑满父级 + flex 居中。新增带显隐的 fixed 组件时，用 `custom-class` /
  `custom-style` 把定位下发到 `wd-transition` 根节点。
- 全局单例（toast/notify）用模块级 `ref` + 条件渲染实现，参考 wot-ui 的 `useToast` 模式（`showToast(options)` 返回关闭函数）。

## 10. Main Thread Script（原生交互性能，声明式唯一形态）

**本组件库的所有跟手交互（拖动 / 滑动 / 缩放 / 手势）必须走 Lynx 官方的声明式
MTS 路径**——这是 Lynx「原生交互性能」的唯一官方形态：事件在主线程直接派发，
worklet 内同步改写节点样式，零线程跨越（后台线程方案每帧两次线程往返，
低端机上手感明显滞后）。

**唯一允许的形态（声明式）**：

```vue
<script lang="ts" setup>
import { useMainThreadRef } from 'vue-lynx'

const trackRef = useMainThreadRef()

// 主线程 worklet：只读事件、算位置、直改节点样式
const onTouchMove = (e: any) => {
  'main thread'
  const el = trackRef.current
  if (!el) return
  const x = e.touches[0].clientX
  el.setStyleProperty('transform', `translateX(${x}px)`)
}
</script>

<template>
  <view :main-thread-ref="trackRef" main-thread-bindtouchmove="onTouchMove" />
</template>
```

规则：

1. worklet 内**只做**跟手计算 + `setStyleProperty` 直改；提交类状态
   （change / confirm / 值落定）才回后台线程，经组件 `emit` 上调；
2. **禁止命令式 `runOnMainThread` / `runOnBackground` 派发**：其 worklet 消费
   `useMainThreadRef` 的 `.current` 依赖 `INIT_MT_REF` ops 先于 worklet 应用，
   两通道无顺序保证，refMap 未就绪时生产构建直接崩溃（真机 1101：
   `cannot read property 'current' of undefined`）。声明式 `main-thread-bind*`
   由框架在建树时注册，不经该竞态路径；
3. **禁止 `lynxWorkletImpl` 可用性检测**（后台线程恒为 undefined，双份代码）；
4. 跟手期间禁用 CSS `transition`（`transition: none`），落位时恢复或用主线程
   `requestAnimationFrame` 做吸附动画；
5. 度量（轨道宽度等）仍遵守 §16：挂载后 `getRect` 一次性获取并缓存；
6. **消费方必须配置 worklet 构建契约（两道闸门，缺一真机白屏 fatal 1101）**：
   BG 线程把 worklet 序列化成 `{ _wkltId }` 对象随元素属性下发，主线程在
   `lynxWorkletImpl._workletMap` 查注册，查不到即抛
   `TypeError: cannot read property 'bind' of undefined`（2026-10-25 真机）。
   - **闸门一（loader 剔除）**：worklet-loader-mt 会把解析后落在 node_modules
     里的 import 从 MT 依赖图中剔除——workspace 源码直连不受影响，**npm 实装
     消费者必须** `pluginVueLynx({ includeWorkletPackages: ['wot-lynx-ui'] })`；
   - **闸门二（tree-shaking 剪树，主因）**：MT 桩里组件依赖只剩 bare import，
     而 wot-lynx-ui 的 `sideEffects` 白名单只有 css/scss/ttf（BG 按需体积的
     正确声明），rspack 会把「无被消费导出」的 bare import 连同组件子树整树
     剪掉。rule 级 `{ issuerLayer: 'vue:main-thread', sideEffects: false }`
     在 rspack 1.7.12 被无视（false 视同未设置），只能对 lynx/web 环境
     `optimization.sideEffects: false`（dev 实测 BG +~600KB，usedExports +
     压缩仍剪未用代码）。参照 `packages/demo/lynx.config.ts` 的 tools.rspack；
   - **守护**：`pnpm check:worklets`（verify 末位）对 build:demo 的中间产物
     断言「BG 序列化的 worklet id ⊆ MT 注册的 id」，任何一侧配置漂移直接红灯。

守卫：`test/unit/no-main-thread-script.test.ts`（禁命令式、放行声明式、防半吊子用法）。
测试环境经 `test/mts-worklet-shim.ts` 模拟 worklet 派发与主线程元素桩，
MTS 交互在单测中可真实执行。

## 11. 验证清单（每个组件完成后必须执行）

```bash
cd packages/ui
npx vue-tsc --noEmit          # 类型必须 0 错误
cd ../demo && pnpm build      # 双端构建必须成功
```

并在 `packages/demo/src/App.vue` 的对应 section 中加入该组件的演示用例
（参照现有小节的写法）。每层（tier）完成后跑 `pnpm test` 与 `pnpm build:css`。

## 12. 明确不做 / 降级的组件

| 组件 | 处理方式 |
| --- | --- |
| `wd-signature`（canvas 手写签名） | Lynx 无 canvas API，用 `<polyline>` SVG 折线实现 |
| `wd-img-cropper`（canvas 裁剪） | 基础版 + 文档标注 |
| `wd-bar-code` / `wd-qr-code` | 用 `<svg>` 绘制（qrcode 算法在后台线程用 JS 生成 path） |
| `wd-video-preview` / `wd-upload`（chooseMedia 等） | 依赖 Lynx 宿主能力，基础版并文档标注 |
| `wd-calendar` / `wd-picker` 系列 | Lynx 无 picker 元素——用 view+scroll-view 自研（参照 wot-ui 逻辑） |

## 13. 父子组件通信的响应式陷阱（父组件必读）

`useParent` / `useChildren` 建立的是「父持有一个 reactive 数组、子在 setup 里 link 自己」
的关系。父组件在**渲染路径**（template / computed / watch）里直接读子组件 props 时，
有一个会崩掉整张卡片的陷阱：

```
Maximum recursive updates exceeded in component <wd-xxx>
```

**成因**：slot 内容每次重渲染都会生成新 vnode，模板里的数组/对象字面量
（`:options="[{…}]"`）随之重新创建，Vue 再把它写回子组件实例的 props。
父组件一旦跟踪了子组件 props，这次写回就会反向触发父组件重渲染 →
再次生成新 vnode → 无限循环，最终被 Vue 的递归更新检测抛出，变成未处理异常。
（仅对象/数组类型的 props 会触发；字符串等原始值写回时值不变，不会 trigger。）

**规则**：父组件读子组件 props 一律走 `toRaw` 非跟踪读取：

```ts
import { toRaw } from 'vue-lynx'

function rawChildProps(child: any): Record<string, any> {
  const props = child && child.$ && child.$.props
  return (props && toRaw(props)) || {}
}
```

同理，`child.$.exposed!` 这类非空断言在渲染路径 / Promise 回调里必须先判空。

## 14. 同名 on\* 事件禁止在「父组件 + 子组件根节点」重复绑定

vue-lynx 把元素上的事件处理器按 sign 存进 `globalThis.__VUE_LYNX_EVENT_REGISTRY__`
的 Map，原生事件到来时由 lynx_core 调 `tt.publishEvent(sign, data)` 取出并**直接
调用**。该实现对注册值只容忍 `null`/`undefined`，存进任何**非函数**值
（如 `mergeProps` 合并出的监听数组），事件一派发就炸（真机 Sentry 原始报错）：

```
TypeError: _getRegistryState_handlers_get is not a function
```

**成因**：父组件在包裹层组件上绑 `@touchmove="noop"`，而包裹层组件的根 view
在 `lockScroll`/`disableTouchMove` 为真时**也**绑了自己的 `@touchmove.stop.prevent`。
Vue 的 `mergeProps` 会把两个同名 `on*` 监听合并成**数组**，数组被原样注册进
注册表，touchmove 一到 `publishEvent` 调用数组即抛上述 TypeError。
（标准 Vue DOM 下 `patchEvent` 支持监听数组，所以这个 bug 只在 Lynx 运行时暴露。）

**规则**：

- 锁滚一律走 `:lock-scroll` → `disable-touch-move` 链路（WdOverlay/WdTransition
  已内置 `@touchmove.stop.prevent`），**禁止**再给包裹层组件补绑 `@touchmove="noop"`。
- 给**组件**绑事件前，先确认该事件是目标组件 `defineEmits` 声明过的；否则它会
  穿透 `$attrs` 挂到子组件根原生元素上，与根元素自身的同名绑定合并成数组。
- **交互组件必须把根 view 上的原生事件名同时声明为 emit 并在自有处理器里转发**
  （`emits: [..., 'tap']` + `emit('tap', event)`）。Lynx 的事件惯用法就是
  `@tap` / `@touchmove`（见 vue.lynxjs.org「不同的事件」），消费方在组件上绑
  原生事件名是自然写法；不声明就会落入上面的合并崩溃。已修复范围：根绑
  `@tap` 的全部交互组件（button / cell / icon / input / switch / checkbox /
  radio / tag / text / img / avatar / backtop / loadmore / notify / popover /
  sidebar-item / sort-button / tabbar-item / tooltip / curtain / grid-item）
  + 根绑 touch 的 rate / fab / swipe-action。
- **WdTransition 家族（overlay / popup / backtop / curtain / image-preview /
  video-preview 等根链最终都落到 transition 根 view）与其余交互组件同法**：
  根 view 的内部点击绑定 `@tap`，并在 emits 声明 `'tap'` 转发；消费方绑
  `@tap` 时作为组件事件被消费，不再穿透到根元素与内部绑定合并。
  **`@click` 在 Lynx 是死事件，严禁在 view 上使用**（2026-10-16 真机订，
  详见下条）。
- **【订正 2026-10-16】Lynx view 不存在 `click` 事件，只派发 `tap`**。
  e2931b8 曾以「Lynx view 原生支持 click」为由，把 WdTransition 根 view 的
  内部点击从 `@tap` 改为 `@click` 来规避合并崩溃——该前提是错误的：引擎
  只派发 `tap`（`bindtap`），`@lynx-js/react` 的 `LynxEventType` 联合类型
  没有 `click`，`@lynx-js/web-core` 的 `W3cEventNameToLynx` 更把 DOM `click`
  映射成 `tap` 再分发。后果是遮罩/弹层点击在真机与 Web 预览**全端失效**
  （遮罩常驻关不掉），且 `fire-event.ts` 的 `fireEvent.click` 会在 jsdom
  里合成 `bindEvent:click` 让测试假绿。现行正确写法：根 view 绑 `@tap` +
  emits 声明转发；WdOverlay 再把 tap 重新 emit 为 `click` / `tap` 双轨
  （`click` 保持 wot-ui API 对齐）。回归：`test/regression/overlay-tap-regression.test.ts`
  按真机语义用 `fireEvent.tap` 断言关闭。同理，其余组件里直接绑在裸 view
  上的 `@click`（pagination / fab / form-item / image-preview 关闭按钮 /
  video-preview 关闭按钮 / swipe-action 选项按钮）均为死链接，应改 `@tap`。
- **回归测试（四份，改事件相关代码必须全绿）**：
  - `test/component/event-tap-registry.test.ts` — 各组件父级 @tap 不崩溃且父子均触发；
  - `test/component/event-merge-props.test.ts` — 同名监听合并不变量 + touch 事件同类风险；
  - `test/component/event-registry-all-components.test.ts` — **全覆盖矩阵**：每个组件
    × 每个 Lynx 原生事件 × 每个真实元素逐一派发，并对本测试新注册的 sign
    逐一 `publishEvent`（设备路径等价物；注册表残留数组 sign 即失败）。
  - `test/regression/overlay-tap-regression.test.ts` — 遮罩/弹层 **tap** 关闭（真机
    事件语义；`fireEvent.click` 合成事件不构成真机行为，勿用于断言关闭）。

## 15. Lynx 3.x 新 CSS 引擎：默认 linear 布局，flex 属性必须挂在 `display: flex` 上

当前工具链编译出的模板带有 `enable_css_engine: true` 与
`default_display_linear: true`：**view 的默认布局是 Lynx 3.x 新增的 `linear`
布局，不再是 web 意义上的 flex 容器**。后果：

1. **`flex-direction` / `flex-wrap` / `flex-grow` 等弹性属性只对 `display: flex` 的元素生效**。
   只写 `flex-direction: row` 而不写 `display: flex` 时，声明被静默丢弃，元素按
   linear 默认方向**纵向逐行排列**——表现为「一行一个、还没有间距」。
2. **`display: inline-flex` / `inline-block` 不被识别**（引擎只认 `flex` / `none` / `linear`）。
   web 侧这两个值的「行内流式排列 + 内容宽度」语义在 Lynx 一律落空。
3. `align-items` / `justify-content` / `gap` 在 linear 下仍生效，因此
   「能居中、有间距、但方向错」是这类问题典型现象。

**规则**：任何依赖横向排列的容器必须**显式** `display: flex`；由 `inline-flex`
改写而来的容器补 `flex-direction: row`。组件根 `display: inline-flex` →
`display: flex`。验证手段：`rspeedy dev` 起服务后用
`http://localhost:3001/__web_preview?casename=<bundle>` 截图核对。

## 16. 触摸热路径禁止重复 getRect（性能红线）

`getRect` 是经 `createSelectorQuery` 的**异步跨线程节点查询**。在 `touchmove`
里调用它等于每帧两次线程间往返，直接摧毁跟手性。

合规模式：宽度/位置**一次性度量 + 缓存**（挂载后、或尺寸相关 props 变化时），
`touchmove` 热路径只读缓存。参照 `wd-slider`（轨道宽度 `initSlider` 一次性测出）、
`wd-fab`（拖动开始时测一次）、`wd-tabs`（`scrollIntoView` 每次切换一次）。

## 17. 按压缩态统一用 `:active`

所有可点击元素（按钮/单元格/宫格/动作面板/键盘/滑块等）的按压缩态一律用
CSS `:active` 伪类 + 对应类名样式（如 `.wd-button:active`、`.wd-cell.is-link:active`），
零 JS 开销。禁用态、加载态不响应按压需用特异性覆盖。

## 18. 重写计划（tier 与进度）

按依赖顺序分 tier 推进，每 tier 完成后执行 §11 验证并更新进度。

| Tier | 内容 | 状态 |
| --- | --- | --- |
| 0 | 基础设施：删除移植产物、新设计令牌、composable 契约上移、index.ts 裁剪 | ✅ 完成 |
| 1 | 基础组件：config-provider / icon / loading / transition / overlay / root-portal / text / gap / divider / button / cell / cell-group | ✅ 完成（12/12，冒烟测试 21 项全绿）|
| 2 | 表单体系：30 个组件全部完成 ✅（form / form-item / input / textarea / input-number / search / switch / radio(-group) / checkbox(-group) / slider / rate / segmented / toast / popup / picker(-view) / datetime-picker(-view) / select-picker / cascader / keyboard / password-input / slide-verify / signature / img-cropper / calendar(-view) / upload，冒烟测试 41 项全绿）|
| 3 | 展示/布局/导航/弹层：52 个组件全部完成 ✅（Tier 3a 展示反馈 12 + Tier 3b 布局 7 + Tier 3c 导航 9 + Tier 3d 弹层反馈/图形/列表导航 24，含 notify/dialog/action-sheet/popover/tooltip/curtain/loadmore/tour/circle/watermark/table/steps/swiper/collapse/drop-menu/tabbar/fab/floating-panel/swipe-action/video-preview/image-preview/navbar-capsule/sort-button）|
| 4 | 图形码：qr-code（完整 QR 编码器：Byte 模式/版本自适应/RS 纠错/掩码评估）/ bar-code（Code128）/ table-column / wot-ui 内部占位 | ✅ 完成（编码器 9 项结构测试全绿）|
| 5 | 收尾：测试重写、文档重写、Demo 更新、README/differences 同步、全量验证 | ✅ 完成（101/101 组件全部进入 Demo 手机端演示；修复 wd-video-preview 命令式 open() 不显示遮罩、wd-index-bar/anchor 子组件注册失效与锚点跳转、button/progress 字符串样式丢弃、calendar-view 显式行结构等缺陷；新增命令式预览 / 索引栏 / 内联样式回归测试；全量验证 203 项测试 / typecheck / build:css / 双端 build 全绿）|

## 19. 内联样式一律对象语法（字符串 `:style` 会被静默丢弃）

vue-lynx 的 `patchProp`（`runtime/dist/node-ops.js`）对 `style` 只处理
**对象 / 数组**（内部走 `normalizeStyle`）：

```js
} else if ('style' === key) {
  const style = null != nextValue && 'object' == typeof nextValue ? normalizeStyle(nextValue) : {}
```

**字符串值（`` :style="`height: 44px`" ``、`custom-style="color: red"`、
计算属性拼出的 `"top: 1px; left: 2px"`）被静默替换为 `{}`**——不报错、
不告警，只是样式全部消失。这与 §5 的类名错配并称「静默丢样式」两大根源。

**纯静态 `style="height: 100%"` 属性同样失效**（2026-10-25 真机巡检）：
编译器只对「带绑定 / 数组 / 子表达式」的 style prop 包 `normalizeStyle`
（此时字符串才会被解析成对象），纯字符串字面量原样下发 → 运行时整串
丢弃。Web 预览不受影响（DOM 自行解析字符串样式），于是「web 绿灯、
真机塌陷」——demo 页 `style="height: 180px"` 的水印容器就是这样塌掉的。
静态样式也必须写对象：`:style="{ height: '180px' }"`。

**内联键名必须 kebab-case，且内联 `--*` 自定义属性无效**（2026-10-25
真机巡检）：Lynx 原生内联样式通道（`Element.setStyleProperty(s)`）要求
「style names must be in kebab-case」，`zIndex` / `marginLeft` /
`paddingTop` 等 camelCase 键被静默丢弃（web 端 CSSOM 两种都认，同样是
「web 绿灯、真机塌陷」）；内联 CSS 自定义属性（`--wot-*`）被原生侧丢弃
（lynx-family/lynx#8576），跨元素传值不能走这条路——wd-avatar 的层叠
间距因此改为预设尺寸走样式表变量、自定义尺寸直接内联负边距。兜底位于
`common/style.ts` 的 `resolveStyle()`（出口统一 `kebabKey` 归一），裸
`:style` 对象须自行保证 kebab-case。

**内联 `background` 简写按不可用处理**：样式表里的简写可用（按钮等），
内联通道不保证展开，一律写 `'background-color'`（wd-avatar 的
bg-color 头像曾因此整组白底白字不可见）。

**带 class 的 `<text>` 不保证继承祖先 view 的 color / font-size**
（2026-10-25 真机巡检：calendar-view 周表头有显式色号可见、日期文字靠
继承则整月空白；裸 text 的继承可用）。文字要显式拿到颜色/字号：写在
直接父 view 或 text 自身（类或内联），状态色同步写到文字节点，不要
隔着两层以上 view 靠继承。

**已暴露的故障现象**（真机 + Web 预览同现）：

| 组件 | 字符串样式 | 故障表现 |
| --- | --- | --- |
| wd-picker-view（及 picker / datetime-picker / calendar 时间面板） | 列项高度、列内容 `translateY`、指示带/遮罩定高 | 列不滚动（选中项不居中）、行高塌成文本高、指示带消失 |
| wd-config-provider | themeVars 的 `--wot-*` 变量串 | 定制主题整体失效 |
| wd-progress / wd-table / wd-qr-code / wd-bar-code / wd-switch / wd-slider / wd-tabs / wd-popover / wd-tooltip / wd-watermark / wd-backtop / wd-floating-panel / wd-swipe-action / wd-notice-bar … | 各自定位/尺寸计算串 | 进度条宽度、表格列宽、二维码尺寸、滑块位移、气泡定位等全部失效 |

**规则**：

1. 模板内联样式一律对象语法：`:style="{ height: addUnit(itemHeight) }"`；
   带条件的状态用对象展开或 `as Record<string, string>` 消歧义。
2. 消费方传入的 `customStyle`（字符串）先过 `common/util.ts` 的
   **`parseStyle()`** 归一为对象再绑定：`:style="parseStyle(customStyle)"`。
   `baseProps.customStyle` 的类型已放宽为 `[String, Object]`，两种传法都支持。
3. computed 返回样式对象；需要剔空值（`undefined` / `''`）时用
   **`filterStyle()`**，不要再 `objToStyle()` 拼字符串后下发。
4. 组件内拼接的多段样式（如 `${rootStyle}${customStyle}`）改为
   `{ ...rootStyle, ...parseStyle(customStyle) }`。
5. **回归测试**：`test/regression/inline-style-regression.test.ts` 经双线程管线 +
   JSDOM 挂载，直接断言关键元素 `style` 属性非空（列高 / translateY /
   指示带 / customStyle / themeVars 映射）。改样式相关代码必须全绿。

**两个附带的布局陷阱**（同在 picker-view 修复中发现，写组件时注意）：

- **flex 子项默认 `flex-shrink: 1`**：列内容总高（pad + 全部列项）远超
  可视区时，会被容器高度**按比例压缩**（行高塌成 1/4）。定高且不允许
  压缩的 flex 子项必须显式 `flex-shrink: 0`。
- **Web 预览的绘制不遵循 z-index**（疑似按 DOM 逆序绘制）：不透明底色的
  `position: absolute` 装饰元素（如 picker 选中指示带）若排在兄弟节点
  **之前**，会连文字一起盖掉。此类元素须排在内容节点**之后**，并保持
  z-index 低于内容（真机按 z-index 绘制，两个平台才都不出问题）。

## 20. 内联样式出口唯一：Style Funnel（禁止条件写样式）

### 根因

Lynx 的 `SET_STYLE` 经后台线程 `pushOp` → 主线程 `__SetInlineStyles(el, value)`
下发，语义是**逐属性合并**（Object.assign）：新对象里**没有出现的键，不会清除**
元素上已经应用的内联属性。

因此「条件写样式」是本库最容易复发的缺陷类型——只要某个键在某一帧被省略，
上一帧的值就残留。仓库已为此付出 **6 次**代价：

| 组件 | 脏值 | 表现 |
| --- | --- | --- |
| `wd-transition` | `display` | 元素永久 `display:none`，toast / 遮罩全不可见（2026-10-15 真机核实） |
| `wd-swipe-action` | `transition` | 跟手时段未显式写 `none` → 上次落位过渡残留，拖动不跟手 |
| `wd-segmented` | `transform` | `if (left)` 为 0 时省略 → 选中首项滑块不归位 |
| `wd-picker-view` | `transition` | 首次拖动跟手、之后每次拖动都带缓动 |
| `wd-toast` | `top` / `bottom` | position 由 top 切 bottom 时 `top` 残留 → 上下同时存在 |
| `wd-fab` | `transform` | 位移归零时省略 → 旧位移残留 |

### 规则

1. **禁止**在组件里写 `if (cond) { style.x = … }` 或 `if (cond) style.x = …`
   —— 省略键等于保留旧值。
2. 需要「条件切换」的样式，一律经 `common/style.ts` 的
   **`defineStyleKeys` + `resolveStyle`** 输出：先声明该元素**可能被切换的全部键
   及其中性值**，之后任何一帧都输出**完整键集**。

```ts
// ✅ 正确
const LINE_STYLE = defineStyleKeys({ transform: 'translateX(0px)' })

const lineStyle = computed(() =>
  resolveStyle(LINE_STYLE, { transform: `translateX(${offset.value}px)` })
)

// ❌ 错误：offset 为 0 时省略 transform → 旧位移残留
const lineStyle = computed(() => {
  const style: Record<string, string> = {}
  if (offset.value) style.transform = `translateX(${offset.value}px)`
  return style
})
```

3. **中性值必须是「视觉上等同于不设置」的合法取值**：`translateX(0px)` /
   `none` / `flex` / `0px`。
   **不要**用 `inherit` 去兜底可能被 CSS 类声明的属性（如 `font-size`）——
   `inherit` 会把内联值变成父级取值，反而覆盖掉类里的声明。
4. 消费方传入的 `customStyle` 仍按 §19 经 `parseStyle()` 归一，与
   `resolveStyle` 的结果合并：`{ ...resolveStyle(...), ...parseStyle(customStyle) }`。

### 守护

- `scripts/review-lint.mjs` 的 `style/conditional-key-write` 与
  `style/conditional-key-write-inline` 两条规则扫描上述反模式（定级 `warn`，
  存量按 `review-lint.baseline.json` 登记）。
  定级为 `warn` 而非 `error` 是刻意的：该规则命中的是缺陷的**必要条件**，
  `if (a) { style.top = … } else if (b) { style.top = … }` 这类「各分支都写
  同一个键」的安全写法同样会被命中（全库约 5/59 属此类）。按本仓库「宁可漏报
  也不制造噪音」的门禁原则先观察，**待存量组件全部迁移到 Style Funnel 后
  再收紧为 `error`**。
- 纯函数单测见 `test/unit/style-funnel.test.ts`；渲染层回归见
  `test/regression/inline-style-regression.test.ts` 与真机验收清单。

### 迁移状态

- 已完成：`wd-segmented`（参考实现）、`wd-picker-view`、`wd-toast`、`wd-fab`、
  `wd-transition`、`wd-swipe-action`（后五者在此前修复中以「显式写中性值」的
  等价手法处理）。
- 待迁移（存量 59 处，已登记 baseline）：`wd-text` / `wd-icon` / `wd-col` /
  `wd-gap` / `wd-steps` / `wd-divider` / `wd-avatar(-group)` / `wd-badge` /
  `wd-loading` / `wd-curtain` / `wd-tour` / `wd-watermark` / `wd-skeleton` /
  `wd-slider` / `wd-tag` / `wd-progress` / `wd-img` / `wd-img-cropper` /
  `wd-navbar(-capsule)` / `wd-notice-bar` / `wd-notify` / `wd-signature` /
  `wd-slide-verify` 等。
  这些组件的条件写样式目前多为「prop 由有值变为无值」才触发，风险相对低；
  迁移须先有视觉回归兜底（见 ARCHITECTURE.md Phase 1）。

## 21. 主线程 worklet（`'main thread'`）禁止互相引用

Lynx 的 worklet 编译产物会把带 `'main thread'` 指令的函数逐个注册到主线程，
注册发生在模块 `const` 初始化之前。**worklet A 的闭包里引用 worklet B 的标识符**
时，真机（Lynx Web / 原生）会在 `setup` 阶段抛
`ReferenceError: Cannot access 'B' before initialization`，组件被异常兜底替换成
无类名的空节点（表现为样式全丢，但单元测试（Vitest 的编译链）通常仍然通过）。

### 规则

1. 每个 `'main thread'` 函数只依赖：**主线程 ref**（`useMainThreadRef`）、
   **元素属性**、**模块级常量**与自身参数；
2. 多条 worklet 需要共享推进逻辑时，把逻辑**定义在入口 worklet 内部**，挂到共享
   状态对象上（如 `press.step` / `state.write`），由后续 worklet 调用该成员：

```ts
const handleStart = (event: any) => {
  'main thread'
  const state = { /* ... */, step: () => {} }
  const step = () => { /* 推进逻辑 */ }
  state.step = step
  stateRef.current = state
  step()
}
const handleEnd = () => {
  'main thread'
  const state = stateRef.current
  if (!state) return
  state.step()
}
```

3. 反例（真机 TDZ / 单测仍绿）：

```ts
const step = () => { 'main thread' /* ... */ }
const handleStart = () => { 'main thread'; step() } // ❌ step 尚未完成初始化
```

4. 该约束由真实 Lynx Web 预览（`#/__web_preview`）中的控制台验证：
   出现 `[wot-lynx-ui] 组件异常已兜底` + `before initialization` 即命中。
   现有回归：`test/parity/wot-parity-button-additional.test.ts`（hover）、
   `test/mts/signature-mts.test.ts`（线段池）。
