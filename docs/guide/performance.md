# 高性能实践

Lynx 的核心优势是双线程架构：**Vue 运行在后台线程，原生渲染发生在主线程**，Vue 的协调过程永不阻塞主线程。wot-lynx-ui 在这一架构下做了以下性能设计：

## 1. 按压缩态：CSS `:active` 而非 JS

wot-ui 使用 `hover-class` + touch 事件实现按压缩态；wot-lynx-ui 使用 CSS `:active` 伪类，由渲染器原生处理，**零 JS 开销**：

```scss
.wd-button:not(.is-disabled):not(.is-loading):active {
  background: var(--wot-button-bg-pressed);
}
```

## 2. 细线边框：`1ppx` 物理像素

wot-ui 使用 `::after` + `transform: scale(0.5)` 模拟 0.5px 细线；Lynx 无伪元素，wot-lynx-ui 改用原生 `border` + `1ppx`（物理像素）单位，在任何 DPR 的屏幕上都是真正的发丝线，且不产生额外节点。

## 3. 图标：内置 .ttf 字体，无网络请求

wot-ui 的图标依赖 iconfont 字体文件加载；wot-lynx-ui 内置 180 个成套图标
（`src/icons/fonts/iconfont.ttf`，约 40KB），字体随包发布、构建时由 Rspeedy
资产管线产出静态地址，**无网络请求、无 CDN 依赖**。Lynx CSS 不支持
`::before/::after`，`wd-icon` 把码点字形直接作为 `<text>` 子节点渲染，颜色
通过 `color` 实时控制（见[内置图标](./icons)）。需要 SVG path 图标的场景可
经 `registerIconSet` 注册自定义 SVG 集，由原生 `<svg>` 元素 content 渲染。

## 4. 长列表：`<list>` 元素

 Lynx 提供 `<list>` 元素（对应 iOS `UICollectionView` / Android `RecyclerView`），具备懒加载与视图复用能力。渲染长列表时请优先使用 `<list>` + `<list-item>` 而非 `<scroll-view>`：

```vue
<template>
  <list list-type="single" scroll-orientation="vertical">
    <list-item v-for="item in items" :key="item.id" item-key="item.id">
      <WdCell :title="item.title" />
    </list-item>
  </list>
</template>
```

## 5. 高频交互：后台线程响应式

对于拖动、滑动等高频率手势，`WdSlider` / `WdSwipeAction` 将交互状态放在**后台线程**的
`ref` 中，由 Vue 响应式驱动样式更新，避免主线程脚本的跨线程兼容性问题：

- 位移增量经 `useTouch` 在后台线程计算，进度条 / 容器 `transform` 由计算属性输出；
- 跟手阶段通过 `transition: none` 禁用 CSS 过渡，落位时恢复过渡动画；
- 节点度量（轨道宽度、按钮宽度）用 `getRect` 获取，不在每次 touchmove 中重复查询。

> 本组件库不使用 Main Thread Script（`'main thread'` worklet）：主线程运行时只在
> 主线程存在，后台线程无法可靠检测；且 worklet 引用跨线程注水存在时序竞争，
> 曾在真机引发 `1101 main-thread.js exception` 崩溃。详见仓库根目录的
> `CONVENTIONS.md` §9。

## 6. 弹层：`position: fixed` 自动提升

Lynx 会将 `position: fixed` 的节点直接提升到页面根节点下，天然脱离父级裁剪与层叠上下文。wot-lynx-ui 的弹层组件（`WdPopup`、`WdDialog` 等）基于此实现，**无需 teleport、无额外容器**。

## 7. CSS 变量级联

启用 `enableCSSInheritance` 后，CSS 属性（包括自定义属性）会按标准 CSS 行为从父级传递到子级。组件库的主题变量依赖该配置，请在 `pluginVueLynx` 中开启。
