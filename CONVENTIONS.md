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
  - `index.scss` — 全新样式，消费 `--wd-*` 设计令牌

## 1. 总体原则

1. **API 兼容优先**：props / slots / events / 组件名 / BEM 类名与 wot-ui 保持一致，用户无感迁移。
2. **视觉重新设计**：不再沿用 wot-ui 的 `--wot-*` 令牌与视觉取值，按第 3 节的新设计系统实现。
3. **原生性能**：能用 CSS（`:active`、transition、animation）解决的不用 JS；高频交互（拖动、滑动）在后台线程用响应式实现（禁止 Main Thread Script，见 §9）。
4. **为 Lynx 而写**：不是"把 Web 代码改到能跑"，而是按 Lynx 渲染引擎的约束与能力设计实现（文本必须 `<text>`、无伪元素、linear 布局等，见 §4/§5/§14）。
5. **渐进增强**：平台不支持的能力（canvas、渐变 SVG 等）给出降级方案并在文件头注释说明。

## 2. 目录与文件规范

```
packages/ui/src/components/wd-xxx/
├── types.ts          # props 定义，import 自 'vue-lynx' 与 '../../common/props'
├── wd-xxx.vue        # 组件实现（全新手写）
└── index.scss        # 样式（消费 --wd-* 令牌）
```

`index.css` 由 `node scripts/build-css.mjs` 自动生成，**不要手动编辑**。

## 3. 设计系统（全新，替代 wot-ui 的 --wot-* 体系）

三层令牌体系，命名空间 `--wd-*`：

| 层 | 文件 | 内容 | 示例 |
| --- | --- | --- | --- |
| 原始刻度 | `styles/tokens/_primitive.scss` | 色阶/间距/圆角/字号/动效，主题无关 | `--wd-blue-6`、`--wd-space-4` |
| 语义令牌 | `styles/tokens/_semantic.scss` | 亮/暗双主题语义别名 | `--wd-color-primary`、`--wd-text-1` |
| 组件令牌 | 各组件 `index.scss` | 组件私有变量，回退到语义令牌 | `--wd-button-primary-bg` |

**视觉方向**（重写时的设计基准）：

- 品牌色：indigo 蓝 `--wd-blue-6`（#4A6DF0），中性冷灰 `--wd-gray-*`；
- 语义色：成功绿 / 警告琥珀 / 危险红，各 10 档色阶；
- 圆角偏大（按钮/卡片 8–16px，弹层 16px），传达现代移动端质感；
- 文字层级 `--wd-text-1..4` + disabled，图标层级 `--wd-icon-1..4`；
- 表面层级：`--wd-bg-page`（页面）→ `--wd-bg-container`（卡片）→ `--wd-bg-elevated`（弹层）；
- **不用 box-shadow**（Lynx 各端表现不一致），层级靠表面色 + `--wd-border-1/2` 描边表达；
- 动效三档：`--wd-duration-fast/base/slow` + `--wd-ease-out/in-out/spring`。

**主题机制**：`import 'wot-lynx-ui/theme'` 引入全部令牌；`WdConfigProvider`
的 `theme="dark"` 给根 view 挂 `.wd-theme-dark` 类切换语义令牌；
`themeVars`  prop 将 camelCase 键映射为 `--wd-<kebab>` 内联变量。
`position: fixed` 弹层被提升到页面根节点后会脱离主题子树，因此
`.wd-root-portal` 容器内镜像同名变量（见 `_semantic.scss` 选择器）。

**JS 镜像**：需要"用 JS 算颜色"的场景（如 svg content 不继承 currentColor），
用 `common/theme.ts` 的色板常量，与 `_primitive.scss` 保持一致。

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
| 组件标签 | 模板内组件一律 PascalCase（`<WdButton>`）；kebab-case 会被 Lynx 编译器判为原生元素 |
| 横向布局 | 依赖横向排列的容器必须显式 `display: flex`（见 §14） |

## 5. SCSS 规范（index.scss）

1. 只消费 `--wd-*` 令牌（语义令牌优先），**禁止**引用已删除的 `--wot-*` 体系。
2. 共享 mixin（`styles/mixin/mixin.scss`）：BEM 的 `b/e/m/when/me`、
   `halfPixelBorder` / `pixelBorder` 系列（原生 border + 1ppx）、`lineEllipsis`。
3. 组件私有令牌定义在文件头部，回退到语义令牌：
   `$button-primary-bg: var(--wd-button-primary-bg, var(--wd-color-primary)) !default;`
4. 需要作者处理的 Lynx 限制：
   - `::before` / `::after` → 模板中的真实元素 + 对应类名（如 `__bar`、`__hairline`）
   - `:nth-child()` / `:first-child` / `:last-child` → `v-for` 中按索引生成类名或内联样式
   - `conic-gradient` / `-webkit-line-clamp` / `-webkit-box` → Lynx 不支持，需替换方案
   - `!important` → Lynx 默认不支持，去掉
   - `:deep(...)` / `::v-deep` → 去掉（全局样式直接写后代选择器）
   - `display: inline-flex` / `inline-block` → 改为 `display: flex` + `flex-direction: row`
5. 多行省略：CSS 保留 `overflow:hidden; text-overflow:ellipsis`，模板同步给
   `<text>` 加 `text-maxline="N"` 属性。
6. 已知约束：令牌回退链多层嵌套 `var()` 出现在 `calc()` 内时，cssnano 的
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
import { baseProps, makeBooleanProp, makeNumberProp, makeStringProp, makeNumericProp, numericProp } from '../../common/props'
import { callInterceptor } from '../../common/interceptor'
import { formatDate, getMonthDays, getFirstDayOfWeek } from '../../common/formatDate'
import { AbortablePromise } from '../../common/AbortablePromise'
import { BLUE, GRAY, GREEN, AMBER, RED } from '../../common/theme'

// 全局配置契约（composable 层自有，禁止组件反向依赖）
import { CONFIG_PROVIDER_KEY, mergeConfig } from '../../composables/global-config'
```

注意：`useDeviceInfo` 的 `getSystemInfo()` 基于 Lynx `SystemInfo` 全局对象；安全区数据 Lynx 不提供（置零，可由宿主注入）。

**依赖方向**：composable / common 层不得 import 组件目录；组件 import composable。
共享契约（cell-group、form、config-provider 的 provide 类型与 key）定义在
composable 层（`useCell.ts` / `useFormDisabled.ts` / `global-config.ts`）。

## 8. wd-icon 与 SVG 硬约束

- **不使用 iconfont**。内置图标 = 从 wot-ui iconfont 提取的 SVG path
  （`src/icons/data.ts`，302 个，色板无关的通用字形数据，重写时保留）。
- `<wd-icon name="close" :size="20" color="#f00" />`：name 命中内置图标时渲染
  `<svg :content>`；name 含 `/` 时按图片渲染 `<image>`；`css-icon` 走 CSS 类名模式。
- 默认颜色 `var(--wd-icon-1)`。组件内使用图标时，如需跟随文字色，显式传 `:color`
  （Lynx 的 svg content 不继承 CSS currentColor，需 JS 侧用 `common/theme.ts` 常量计算）。

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
- 全局单例（toast/notify）用模块级 `ref` + 条件渲染实现，参考 wot-ui 的 `useToast` 模式（`showToast(options)` 返回关闭函数）。

## 10. Main Thread Script（禁止引入）

**本组件库不使用 Main Thread Script（MTS）。** `wd-slider`、`wd-swipe-action`
等高频交互组件统一运行在**后台线程**（Vue 响应式驱动样式），原因：

1. **可用性检测不可靠**：主线程运行时 `lynxWorkletImpl` 只存在于主线程，
   而后台线程的 `computed` 里检测该全局恒为 `undefined`，MTS 事件绑定
   （`main-thread-bind*`）永远不会生效，组件实际走的是降级分支——
   双份代码、双份维护成本，性能收益为零。
2. **跨线程注水时序竞争**：`runOnMainThread` 派发的 worklet 在主流成消费
   `useMainThreadRef` 的 `.current`，其值依赖 `INIT_MT_REF` ops 先于
   worklet 应用到主线程；两个通道（`vuePatchUpdate` 与
   `getCoreContext().dispatchEvent`）之间无顺序保证，refMap 未就绪时
   生产构建中 `getFromWorkletRefMap` 返回 `undefined`，直接崩溃：
   `1101 main-thread.js exception: TypeError: cannot read property 'current' of undefined`。
3. **消费方配置负担**：MTS 要求 `includeWorkletPackages` 白名单与
   `sideEffects: true` 双重约束，接入复杂且易踩坑。

**替代方案**（高频交互组件遵循）：

- 拖动/滑动状态放在后台线程 `ref`，样式经计算属性输出（参照 `wd-slider`
  的 `lineStyle`、`wd-swipe-action` 的 `wrapperStyle`）；
- 位移动画用 CSS `transition`（跟手时 `transition: none`，落位时恢复）；
- 度量（轨道宽度等）用 `getRect` 一次性获取并缓存，不在 touchmove 里重复查询；
- 按压缩态用 `:active` 伪类，不用 touch 事件 + JS state。

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
| 0 | 基础设施：删除移植产物、新设计令牌、composable 契约上移、index.ts 裁剪 | 进行中 |
| 1 | 基础组件：config-provider / icon / loading / transition / overlay / root-portal / text / gap / divider / button / cell / cell-group | 待开始 |
| 2 | 表单体系：form / form-item / input / textarea / input-number / search / switch / radio(-group) / checkbox(-group) / slider / rate / segmented / picker(-view) / datetime-picker(-view) / calendar(-view) / upload / signature / img-cropper / password-input / keyboard / slide-verify / select-picker / cascader | 待开始 |
| 3 | 展示反馈：tag / badge / card / img / empty / progress / circle / count-down / count-to / notice-bar / skeleton / watermark / avatar(-group) / table(-column) / steps / step / pagination / swipe(-nav) / collapse(-item) / popover / tooltip / tour / curtain / loadmore / drop-menu(-item) / sort-button / index-bar / index-anchor / sticky(-box) / resize / backtop / floating-panel / swipe-action / sidebar(-item) / navbar(-capsule) / tabbar(-item) / tab / video-preview / image-preview / row / col / grid(-item) / fab | 待开始 |
| 4 | 图形码：qr-code / bar-code / circle / signature 的 SVG 绘制 | 并入 2/3 |
| 5 | 收尾：测试重写、文档重写、Demo 更新、README/differences 同步、全量验证 | 待开始 |
