# 与 wot-ui 的差异

wot-lynx-ui 力求在 API、交互与视觉上与 wot-ui 2.3.2 严格对齐（设计令牌同源、props/events/slots 逐条一致、组件样式逐值一致），但 Lynx 是原生渲染引擎，与 Web/小程序运行时有本质差异。以下是完整的差异清单。

## 使用方式差异

> **标签兼容**：安装 [`pluginWotLynxTags`](./quick-start.md#沿用-wot-ui-的-kebab-case-标签写法-可选) 后，
> 业务代码可完全沿用 wot-ui 的 `<wd-button>` 标签写法，插件会在构建时自动改写。

| 项目 | wot-ui | wot-lynx-ui |
| --- | --- | --- |
| 组件标签 | `<wd-button>` | `<WdButton>`（PascalCase）；或安装 `pluginWotLynxTags` 插件后继续使用 `<wd-button>` |
| 引入方式 | `import WdButton from 'wot-ui/components/wd-button/wd-button.vue'` | `import { WdButton } from 'wot-lynx-ui'` |
| 主题引入 | `@import '@/uni_modules/wot-ui/styles/theme/index.scss'` | `import 'wot-lynx-ui/theme'` |
| 样式定制 | SCSS 变量覆盖 | CSS 变量覆盖（`--wot-*` 令牌体系，与 wot-ui 同源同值） |

## 页面滚动（应用骨架必读）

Lynx 页面默认不可滚动，长页面需自建 `scroll-view`，且**高度链路必须逐级确定**：

```
页面根容器（屏幕高，确定）
└─ 包裹 view（height: 100%）   ← 任意中间层（含 WdConfigProvider 根 view）必须是确定高度
   └─ scroll-view（height: 100%）
      └─ 业务内容
```

Lynx 的百分比高度只相对「已确定高度」的父级解析：中间层若为 auto（内容高度），其下
`scroll-view` 的 `height: 100%` 会解析成内容高度而非屏幕高度——滚动容器与内容等高即
无可滚动范围（页面「滚不动」，超出部分被页面根裁剪）。`WdConfigProvider` 的根 view 已内置
`height: 100%`（布局中立化，父级不确定时按 auto 处理，行为不变）；自建包裹层时记得同样
挂上确定高度。

## 实现机制差异

| 能力 | wot-ui | wot-lynx-ui |
| --- | --- | --- |
| 图标 | iconfont 字体 | 内置 .ttf 字体图标（wot-ui 2.3.2 官方 305 字形优先，另保留 180 个历史 iconfont 字形；`<text>` 字形，随包发布无网络请求）；可 `registerIconSet` 注册 SVG path 集 |
| 按压缩态 | `hover-class` | CSS `:active` 伪类（渲染器原生处理） |
| 细线边框 | `::after` + `scale(0.5)` | 原生 `border` + `1ppx` 物理像素 |
| 伪元素装饰 | `::before` / `::after` | 模板中的真实元素（`__bar` / `__hairline` / `__line` 等类名） |
| 多行省略 | `-webkit-line-clamp` | `<text text-maxline="N">` 属性 |
| 弹层传送 | `root-portal` / teleport | `position: fixed` 节点自动提升至根节点 |
| 圆环进度 | canvas 2D | SVG（`stroke-dasharray` / `stroke-dashoffset`） |
| 二维码 / 条形码 | canvas 2D | SVG（矩阵 → `rect` / `circle` / `path`） |
| 手写签名 | canvas 2D | SVG `polyline`（撤销/恢复栈，导出标准 SVG data URI） |
| 水印 | canvas `toDataURL` | 平铺层（重复水印单元 + 旋转文本） |
| 页面跳转 | `uni.navigateTo` | `uni` 兼容层降级，交由宿主注入路由（见下文） |
| 安全区 | `uni.getSystemInfoSync` | Lynx `SystemInfo`（安全区数据置零，可由宿主注入） |
| 小程序标签 | `<block>` / `<rich-text>` / `data-*` 属性 | `<template>` / `<text>`（Lynx `__SetAttribute` 不支持任意 `data-*`） |
| 内联 CSS 变量 | `:style="{ '--x': v }"` 或字符串 | `ev.style[key]` 通道会丢弃 `--x`；主题变量改由**根节点 `style` 属性串**下发（见下节），普通样式仍走对象语法 |
| 主线程 worklet | 无此概念 | 声明式 MTS（`'main thread'`），且 worklet 之间禁止互相引用（真机会 TDZ，见 `CONVENTIONS.md` §21） |

## 主题变量与内联样式通道（已实测）

Lynx 的 `SET_STYLE` 是**逐属性合并**（`Object.assign(el.style, value)` 语义），浏览器
CSSOM 对 `el.style['--custom-property'] = …` 的赋值会**静默丢弃**自定义属性；同理
`@lynx-js/testing-environment` 的 DOM shim 与 jsdom 也丢弃。因此 `WdConfigProvider` /
`WdRootPortal` 把主题变量拼成声明串，直接写到根节点的 `style` 属性上：

```
style="--wot-primary-6:#FF8800;"    ← 变量通道（自定义属性）
:style="{ padding: '12px' }"        ← 对象通道（普通属性，Style Funnel 管理）
```

两条通道按「`--*` / 普通键」分工，互不覆盖；变量被撤回时输出空声明（`--k:;`）以清除
继承值。已在真实 Lynx Web 预览（`__web_preview` + 设备模拟）核实：
`getComputedStyle(provider).getPropertyValue('--wot-primary-6')` 返回 `#FF8800`，
主题按钮背景随之变化。

注意：

- 变量宿主用一次性 `wd-css-vars="<uuid>"` 自定义属性定位（`data-*` 在 vue-lynx 里走
  dataset 专用 PAPI，测试环境会抛错），不要改为 `data-*`；
- 单元测试环境（jsdom）不计算 CSS 变量，断言请读取 `style` 属性字符串，而不是
  `getComputedStyle`；
- 纯原生渲染宿主（无 `document`）跳过属性写入，此时由 `wot-theme-light` /
  `wot-theme-dark` 类提供语义令牌兜底；`themeVars` 的自定义覆盖在该宿主上不生效。

## 布局引擎差异（业务侧必读）

Lynx 3.x 启用新 CSS 引擎后 **view 的默认布局是 Lynx 自研的 `linear` 布局，不是 flex**，
且只识别 `display: flex` / `none` / `linear` 三个取值。业务代码写横向排列时：

- **必须显式 `display: flex`**，`flex-direction: row` 才会生效；否则元素纵向逐行排列
  （web/小程序里"view 默认就是 flex 行容器"的经验在 Lynx 不成立）；
- **不要使用 `display: inline-flex` / `inline-block`**（不被识别，回落纵向堆叠）；
  由 web 语义改写为 `flex` 时，记得补 `flex-direction: row`；
- `align-items` / `justify-content` / `gap` 在 linear 下仍生效——"能居中、有间距、
  但方向错"正是这类问题的典型现象。

```vue
<template>
  <!-- 正确：横向排列的容器显式声明 display:flex -->
  <view style="display: flex; flex-direction: row; flex-wrap: wrap; gap: 10px">
    <wd-button>主要按钮</wd-button>
    <wd-button>成功</wd-button>
  </view>
</template>
```

组件库内部已按同一规则整改（按钮根节点、评分星标、步骤条、开关轨道等）；
详见仓库根目录 `CONVENTIONS.md` §14。

## uni API 兼容层

Lynx 环境不存在 `uni` 全局对象。组件库提供 `common/uni.ts` 兼容层：

- **系统信息**：`uni.getSystemInfoSync` / `getWindowInfo` 等映射到 Lynx `SystemInfo`；
- **节点查询**：`uni.createSelectorQuery` 映射到 `lynx.createSelectorQuery`；
- **媒体选择 / 路由 / Toast 等宿主能力**：默认降级（warning + `fail` 回调），
  宿主可通过 `configureUniAdapter()` 注入真实实现：

```ts
import { configureUniAdapter } from 'wot-lynx-ui'

configureUniAdapter({
  navigateTo: (options) => router.push(options.url),
  chooseMedia: (options) => myMediaPicker.pick(options),
  showToast: (options) => myToast.show(options)
})
```

## 能力降级的组件

| 组件 | 状态 | 说明 |
| --- | --- | --- |
| `WdImgCropper` 图片裁剪 | 接口保留 | Lynx 无 Canvas 2D API，裁剪能力需宿主提供 |
| `WdUpload` 上传 | 基础可用 | 依赖宿主注入 `uni.chooseMedia` / `uni.uploadFile` |
| `WdVideoPreview` | 基础可用 | 依赖 Lynx `<video>` 元素宿主能力 |
| `WdSwiper` / `WdImagePreview` 轮播 | 自研实现 | `swiper` / `swiper-item` 并非 Lynx 引擎内置元素，其 BehaviorController 由宿主链接的 LynxUI 注册；宿主缺失时引擎抛 "No BehaviorController defined for class swiper"（错误码 9902）致命异常且 JS 侧无法捕获。故轮播改用引擎内置元素（scroll-view / view / image）+ scroll-left 分页自研实现，任何宿主均可用；`adjust-height` / `adjust-vertical-height`（支付宝小程序专有能力）随之失效 |
| `WdTour` 富文本内容 | 纯文本 | `rich-text` 节点降级为 `<text>` 展示 |
| `WdWatermark` 文字宽度 | 近似换行 | Lynx 无 `measureText`，按字符宽度估算换行位置 |
| `WdCircle` 渐变色 / `WdQrCode` 渐变 | 降级为纯色 | Lynx 引擎 SVG content 仅支持 `svg`/`g`/`path`/`rect`/`circle`/`polyline`，`linearGradient`/`stop`/`defs` 会触发真机 `PaintingContext.insertNode` "unknown child signature" 致命异常（错误码 9902），渲染路径取首个色标作为纯色（导出 data URI 仍为标准 SVG 渐变） |
| `WdQrCode` / `WdBarCode` | SVG 实现 | 二维码编码器（Byte 模式 / 版本 1-10 / Reed-Solomon 纠错 / 掩码评估）在后台线程运行，产出模块矩阵后以 SVG `rect` 平铺；条形码为 Code128 编码 |

## props 差异

以下 wot-ui 的小程序专有 props **保留类型定义**（API 兼容，传入不报错）但**无实际效果**：

- `WdButton`：`open-type`、`scope`、`lang`、`session-from`、`send-message-*`、`app-parameter`、`show-message-card`、`hover-start-time`、`hover-stay-time`、`hover-stop-propagation`
- `WdCell`：`to`、`replace`（页面跳转请使用 `@click` + 宿主路由）
- `WdSignature`：`fileType`、`quality`（SVG 矢量导出下为位图概念，无意义）

## 已适配保留的能力

- 全部 101 个官方组件的 props / slots / events 定义（含小程序专有 props 的类型兼容；另有 6 个本地扩展组件）
- 16 种语言包（`Locale`）
- `useToast` / `useNotify` 等函数式 API
- BEM 类名结构（`wd-xxx__element--modifier`）
- `--wot-*` 设计令牌完整级联（组件变量 → 语义变量 → 原始刻度 → 字面值）
