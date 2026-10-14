# wot-lynx-ui 组件移植规范（CONVENTIONS）

> 本文档是并行移植 wot-ui 组件到 Vue Lynx 的**唯一权威规范**。所有移植工作必须严格遵守。

## 0. 源与目标

- **源**：`/tmp/wot-ui/src/uni_modules/wot-ui/components/<component>/`（wot-ui 2.3.2）
  - `types.ts` — props 定义（含详细中文注释）
  - `<name>.vue` — 组件实现
  - `index.scss` — 样式（引用 `../../styles/variable.scss` 与 `../../styles/mixin/mixin.scss`）
- **目标**：`packages/ui/src/components/<component>/`（同构三文件 + 生成的 `index.css`）

## 1. 总体原则

1. **API 兼容优先**：props / slots / events / 类名（BEM）与 wot-ui 保持一致，用户无感迁移。
2. **样式保真**：SCSS 原样复制 `index.scss`（仅在必要时做 Lynx 适配改写），CSS 类名、CSS 变量名完全一致。
3. **原生性能**：能用 CSS（`:active`、transition、animation）解决的不用 JS；高频交互（拖动、滑动）在后台线程用响应式实现（禁止 Main Thread Script，见 §9）。
4. **渐进增强**：平台不支持的能力（canvas、伪元素等）给出降级方案并在文件头注释说明。

## 2. 目录与文件规范

```
packages/ui/src/components/wd-xxx/
├── types.ts          # props 定义，import 自 'vue-lynx' 与 '../../common/props'
├── wd-xxx.vue        # 组件实现
└── index.scss        # 样式（从 wot-ui 复制，必要时适配）
```

`index.css` 由 `node scripts/build-css.mjs` 自动生成，**不要手动编辑**。

## 3. .vue 文件模板

```vue
/*
 * wd-xxx — 组件中文名
 *
 * Lynx 适配说明：（如有适配点，逐条说明；没有则省略本块）
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
| import 来源 | 一律 `from 'vue-lynx'`（ref/computed/watch/Transition/Teleport 等均由其再导出） |
| 样式引入 | `import './index.css'` 放在 `<script setup>` 第一行；**禁止** `<style>` 块 |
| 顶层注释 | **禁止在 SFC 顶层注释中出现 `<xxx>` 形式的标签**（如 `<view>`、`<svg>`），Vue 解析器会将其识别为自定义块导致编译失败。写成 "view 元素" 即可 |
| 裸文本 | `<view>` 内的所有文本必须包裹 `<text>`；`{{ }}` 插值同理 |
| 按压缩态 | 用 `:active` 伪类（CSS 实现），**不要**用 touch 事件 + JS state |
| options 块 | 不需要 `<script>` options 块（virtualHost/styleIsolation/addGlobalClass 均为 uni-app 概念） |
| 条件编译 | 删除所有 `// #ifdef` / `// #ifndef` / `// #endif` 注释行及其包裹的平台分支 |

## 4. SCSS 适配规则（index.scss）

1. **默认原样复制** wot-ui 的 `index.scss`。
2. 已由共享 mixin 自动适配的（无需组件处理）：
   - `halfPixelBorder` / `halfPixelBorderSurround` → 已重写为原生 `border` + `1ppx` 物理像素
   - `pixelBorder` / `pixelBorderSurround` → 已重写为原生 `border`
   - `edeep` / `mdeep` → 已重写为普通后代/修饰符选择器（全局样式下无 `:deep` 需求）
   - `multiEllipsis` → 已改为 `overflow:hidden; text-overflow:ellipsis`（组件模板需同步给 `<text>` 加 `text-maxline="N"` 属性）
3. 需要组件作者处理的：
   - `::before` / `::after` → 改为模板中的真实元素 + 对应类名（如 `__bar`、`__hairline`）
   - `:nth-child()` / `:nth-of-type()` / `:first-child` / `:last-child` → 改为 `v-for` 中按索引生成类名或内联样式
   - `conic-gradient` / `-webkit-line-clamp` / `-webkit-box` → Lynx 不支持，需替换方案
   - `!important` → Lynx 默认不支持，去掉
   - `:deep(...)` / `::v-deep` → 去掉（全局样式直接写后代选择器）
4. **已知约束（无需规避）**：组件令牌的回退链为三层（组件 → 刻度 → 基础），
   令牌出现在 `calc()` 内时产物含三层嵌套 `var()`
   （如 `calc(var(--a, var(--b, var(--c, 2px))))`）。cssnano 的 postcss-calc
   解析不了该结构，生产构建会输出 `Parse error` 告警——**仅告警**，解析失败时
   原值透传，产物正确。Demo 已通过关闭 cssnano 的 `calc` 转换消除告警
   （见 `packages/demo/lynx.config.ts` 与 README），组件样式保持原样即可。

## 5. 事件映射

| uni-app | Lynx / vue-lynx |
| --- | --- |
| `@click` | `@tap` |
| `@touchstart` `@touchmove` `@touchend` | 同名（Lynx 原生支持） |
| `hover-class="x"` | CSS `:active` + 对应类名样式 |
| `catchtouchmove` | `@touchmove.stop` |

## 6. 已就绪的基础设施（直接 import 使用）

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

import { addUnit, isDef, objToStyle, getRect, getSystemInfo, deepMerge, ... } from '../../common/util'
import { baseProps, makeBooleanProp, makeNumberProp, makeStringProp, makeNumericProp, numericProp } from '../../common/props'
import { callInterceptor } from '../../common/interceptor'
import { formatDate, getMonthDays, getFirstDayOfWeek } from '../../common/formatDate'
import { AbortablePromise } from '../../common/AbortablePromise'

import WdIcon from '../wd-icon/wd-icon.vue'
import WdLoading from '../wd-loading/wd-loading.vue'
import WdTransition from '../wd-transition/wd-transition.vue'
import WdOverlay from '../wd-overlay/wd-overlay.vue'
import WdRootPortal from '../wd-root-portal/wd-root-portal.vue'
import WdButton from '../wd-button/wd-button.vue'
import WdCell from '../wd-cell/wd-cell.vue'
import WdCellGroup from '../wd-cell-group/wd-cell-group.vue'
import WdConfigProvider from '../wd-config-provider/wd-config-provider.vue'
```

注意：`useDeviceInfo` 的 `getSystemInfo()` 基于 Lynx `SystemInfo` 全局对象；安全区数据 Lynx 不提供（置零）。

## 7. wd-icon 的特殊约定

- **不使用 iconfont**。内置图标 = 从 wot-ui iconfont 提取的 SVG path（`src/icons/data.ts`，302 个）。
- `<wd-icon name="close" :size="20" color="#f00" />`：name 命中内置图标时渲染 `<svg :content>`；name 含 `/` 时按图片渲染 `<image>`；`css-icon` 走 CSS 类名模式。
- 默认颜色 `#1D1F29`（`--wot-icon-main` / coolgrey-10）。
- 组件内使用图标时，如需跟随文字色，显式传 `:color`（如 button 按 type 计算）。

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
  `wd-icon` / `wd-loading` / `wd-circle` / `wd-qr-code` / `wd-bar-code` /
  `wd-signature` 的 `:content` 绑定均已接入；导出路径（data URI）不受引擎 SVG
  解析器约束，不过安全网；
- 新增组件生成 SVG 标记时，只允许使用白名单元素；`test/svg-content-safety.test.ts`
  对全部 6 个 svg 产出组件的渲染路径做回归断言，`test/util.test.ts` 对
  `sanitizeSvgContent` 的子树剔除/嵌套匹配/引号切分做单元测试。

## 8. 弹层类组件规范（popup / dialog / action-sheet / toast / notify 等）

- 结构：`wd-root-portal > wd-popup-wrapper > [wd-overlay + wd-transition]`，与 wot-ui 一致。
- Lynx 中 `position: fixed` 节点会被提升到页面根节点，因此**不需要** teleport；wd-root-portal 仅作为携带主题变量的容器。
- 弹出层定位一律 `position: fixed`（center 用 `left/right/top/bottom: 0` + flex 居中；bottom/top/left/right 用对应贴边）。
- 全局单例（toast/notify）用模块级 `ref` + 条件渲染实现，参考 wot-ui 的 `useToast` 模式（`showToast(options)` 返回关闭函数）。

## 9. Main Thread Script（已移除，禁止引入）

**本组件库不使用 Main Thread Script（MTS）。** `wd-slider`、`wd-swipe-action`
等高频交互组件统一运行在**后台线程**（Vue 响应式驱动样式），曾尝试的 MTS
实现已全部移除，原因：

1. **可用性检测不可靠**：主线程运行时 `lynxWorkletImpl` 只存在于主线程，
   而后台线程的 `computed` 里检测该全局恒为 `undefined`，MTS 事件绑定
   （`main-thread-bind*`）永远不会生效，组件实际走的是降级分支——
   双份代码、双份维护成本，性能收益为零。
2. **跨线程注水时序竞争**：`runOnMainThread` 派发的 worklet 在主流成消费
   `useMainThreadRef` 的 `.current`，其值依赖 `INIT_MT_REF` ops 先于
   worklet 应用到主线程；两个通道（`vuePatchUpdate` 与
   `getCoreContext().dispatchEvent`）之间无顺序保证，refMap 未就绪时
   生产构建中 `getFromWorkletRefMap` 返回 `undefined`，直接崩溃：
   `1101 main-thread.js exception: TypeError: cannot read property 'current' of undefined`
   （与早期 `'bind' of undefined` 同属一类真机崩溃）。
3. **消费方配置负担**：MTS 要求 `includeWorkletPackages` 白名单与
   `sideEffects: true` 双重约束，接入复杂且易踩坑。

**替代方案**（移植高频交互组件时遵循）：

- 拖动/滑动状态放在后台线程 `ref`，样式经计算属性输出（参照 `wd-slider`
  的 `lineStyle`、`wd-swipe-action` 的 `wrapperStyle`）；
- 位移动画用 CSS `transition`（跟手时 `transition: none`，落位时恢复）；
- 度量（轨道宽度等）用 `getRect` 一次性获取并缓存，不在 touchmove 里重复查询；
- 按压缩态用 `:active` 伪类，不用 touch 事件 + JS state。

## 10. 验证清单（每个组件完成后必须执行）

```bash
cd packages/ui
npx vue-tsc --noEmit          # 类型必须 0 错误
cd ../demo && pnpm build      # 双端构建必须成功
```

并在 `packages/demo/src/App.vue` 的对应 section 中加入该组件的演示用例（参照现有 Button/Icon/Loading/Cell/Overlay 小节的写法）。

## 11. 明确不做 / 降级的组件

| 组件 | 处理方式 |
| --- | --- |
| `wd-signature`（canvas 手写签名） | Lynx 无 canvas API，跳过或仅留占位（文档标注） |
| `wd-img-cropper`（canvas 裁剪） | 同上 |
| `wd-bar-code` / `wd-qr-code` | 优先用 `<svg>` 绘制二维码/条形码（qrcode 算法可在后台线程用 JS 生成 path） |
| `wd-video-preview` / `wd-upload`（chooseMedia 等） | 依赖 Lynx 宿主能力，做基础版并文档标注 |
| `wd-calendar` / `wd-picker` 系列 | 用原生 `<picker>`？Lynx 无 picker 元素——用 view+scroll-view 自研（参照 wot-ui 逻辑） |

## 12. 父子组件通信的响应式陷阱（移植父组件时必读）

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

**规则**：父组件读子组件 props 一律走 `toRaw` 非跟踪读取，值仍是每次渲染实时
重读的，只是不建立响应式依赖：

```ts
import { toRaw } from 'vue-lynx'

function rawChildProps(child: any): Record<string, any> {
  const props = child && child.$ && child.$.props
  return (props && toRaw(props)) || {}
}
```

参考实现：`src/components/wd-drop-menu/wd-drop-menu.vue`（`rawChildProps`）。
回归测试：`test/wd-drop-menu.test.ts`（内联 options 字面量不引发无限重渲染）。

同理，`child.$.exposed!` 这类非空断言在渲染路径 / Promise 回调里必须先判空
（子节点可能尚未 expose，或 slot 混入了非约定子节点）——断言落空就是一次
`TypeError`，在 Promise 回调里会变成未处理的 Promise 拒绝。

## 13. 同名 on\* 事件禁止在「父组件 + 子组件根节点」重复绑定（移植时必读）

vue-lynx 把元素上的事件处理器按 sign 存进 `globalThis.__VUE_LYNX_EVENT_REGISTRY__`
的 Map，原生事件到来时由 lynx_core 调 `tt.publishEvent(sign, data)` 取出并**直接
调用**。该实现对注册值只容忍 `null`/`undefined`：

```js
(_getRegistryState_handlers_get = getRegistryState().handlers.get(sign)) === null
  || _getRegistryState_handlers_get === void 0
    ? void 0 : _getRegistryState_handlers_get(data)
```

存进任何**非函数**值，事件一派发就炸（真机 Sentry 原始报错）：

```
TypeError: _getRegistryState_handlers_get is not a function
  at publishEvent (background.js:74679:179)   run_type: lynx_core
```

**成因**：父组件在 `<WdOverlay>`（或任何包裹层组件）上绑 `@touchmove="noop"`，
而 `WdOverlay → WdTransition` 的根 view 在 `lockScroll`/`disableTouchMove` 为真时
**也**绑了自己的 `@touchmove.stop.prevent`。Vue 的 `mergeProps` 会把两个同名 `on*`
监听合并成**数组** `[wrapped, parentHandler]`，数组被原样注册进注册表，touchmove
一到 `publishEvent` 调用数组即抛上述 TypeError。（标准 Vue DOM 下 `patchEvent`
支持监听数组，所以这个 bug 只在 Lynx 运行时暴露，H5/测试环境不报。）

**规则**：

- 锁滚一律走 `:lock-scroll` → `disable-touch-move` 链路（WdOverlay/WdTransition
  已内置 `@touchmove.stop.prevent`），**禁止**再给包裹层组件补绑 `@touchmove="noop"`。
  裸 `noop` 在 Lynx 里既不 stopPropagation 也不 preventDefault，挡不住滚动，
  纯属 uni-app 移植残留。
- 更一般地：给**组件**绑事件前，先确认该事件是目标组件 `defineEmits` 声明过的
  （会作为 emit 消费，不会落到 DOM）；否则它会穿透 `$attrs` 挂到子组件根原生
  元素上，与根元素自身的同名绑定合并成数组。
- 派生前不会抛错的注册表污染只能在**事件到达时**才暴露，因此渲染冒烟测试
  必须校验注册表不变式（见下）。

回归测试：`test/event-registry-integrity.test.ts`（popup / drop-menu 遮罩
touchmove）+ `test/smoke.test.ts` 内每个组件渲染后的注册表不变式断言。
历史修复：`wd-popup.vue`、`wd-drop-menu.vue` 移除遮罩上的 `@touchmove="noop"`。

## 14. Lynx 3.x 新 CSS 引擎：默认 linear 布局，flex 属性必须挂在 `display: flex` 上

**本条目为 2026-10 全库布局修复的核心结论，改动任何组件样式前必读。**

当前工具链（`@lynx-js/rspeedy@0.13.5` + `@lynx-js/tasm@0.0.26`，产物引擎版本 3.2）编译出的
模板带有 `enable_css_engine: true` 与 `default_display_linear: true`：**view 的默认布局是
 Lynx 3.x 新增的 `linear` 布局，不再是 web 意义上的 flex 容器**。后果：

1. **`flex-direction` / `flex-wrap` / `flex-grow` 等弹性属性只对 `display: flex` 的元素生效**。
   只写 `flex-direction: row` 而不写 `display: flex` 时，声明被静默丢弃（web 编译管线里
   甚至会被改写成无人消费的 `--flex-direction` CSS 变量），元素按 linear 默认方向
   **纵向逐行排列**——表现为「一行一个、还没有间距」。已复现：demo 页 `.demo-row`
   内的按钮/图标在真机上全部纵向堆叠（`wd-cell__wrapper` 因显式 `display: flex` 而正常）。
2. **`display: inline-flex` / `inline-block` 不被识别**（引擎只认 `flex` / `none` / `linear`）。
   web 侧这两个值的「行内流式排列 + 内容宽度」语义在 Lynx 一律落空：元素回落 linear
   纵向堆叠（多子元素横向容器全坏，如 `wd-rate` 星标、`wd-switch` 轨道、`wd-steps` 步骤条）。
3. `align-items` / `justify-content` / `gap` 在 linear 下仍生效（引擎做了属性映射），
   因此「能居中、有间距、但方向错」是这类问题典型现象，不要被间距正常误导。

**规则**：

- 任何依赖横向排列的容器必须**显式** `display: flex`，并由 `inline-flex` 改写而来的
  容器补 `flex-direction: row`（web 的 inline-flex 默认 row，Lynx 不会默认）。
  示范：`.demo-row`（demo）、`wd-rate`、`wd-steps`、`wd-switch`、`wd-avatar-group`、
  `wd-toast--with-icon`、`wd-drop-menu__option-title`。
- 组件根 `display: inline-flex` → `display: flex`（作为行容器弹性项时两者表现一致：
  按内容尺寸、不撑满；按钮内部纵向排列由其显式 `flex-direction: column` 保证）。
- 验证手段：`rspeedy dev` 起服务后用 `http://localhost:3001/__web_preview?casename=<bundle>`
  （web 运行时与真机同语义）截图核对；真机同理。

## 15. 触摸热路径禁止重复 getRect（性能红线）

`getRect` 是经 `createSelectorQuery` 的**异步跨线程节点查询**。在 `touchmove` 里调用它
等于每帧两次线程间往返，直接摧毁跟手性。历史违规与修复：

| 组件 | 问题 | 修复 |
| --- | --- | --- |
| `wd-swipe-action` | `onDrag` 每帧 `getWidths()`（2 次查询） | 宽度一次性度量 + 缓存，`changeState`（挂载/程序化开合）前失效 |
| `wd-rate` | `onTouchMove` 每帧查询全部评分项 | 矩形缓存，`num`/`space` 变化时失效 |

合规示范：`wd-slider`（轨道宽度 `initSlider` 一次性测出）、`wd-slide-verify`（挂载后测一次）、
`wd-fab`（拖动开始时测一次）、`wd-tabs`（`scrollIntoView` 每次切换一次）。

## 16. 按压缩态：uni-app hover-class 的移植规则

wot-ui 大量使用 uni-app `hover-class` 实现按压缩态，移植时**必须**转换为 Lynx 渲染器原生的
`:active` 伪类（零 JS 开销，见 §5 事件映射表）。只搬 `--active` / `is-hover` 修饰符的 SCSS
而不接 `:active`，会得到永不生效的死代码——按钮/单元格曾因此完全没有按压反馈。

已完成：`wd-button`（含禁用/加载态不响应按压的特异性覆盖）、`wd-cell`（`is-link`/`clickable`
根类 + `:active` 背景）、`wd-grid-item`、`wd-action-sheet`、`wd-keyboard`、`wd-slider`。
