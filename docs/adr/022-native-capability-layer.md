# ADR-022 移除 uni-app 兼容层，改为 Lynx 原生能力层 + 宿主原生模块契约

- **状态**：已采纳
- **日期**：2026-11-07
- **相关**：`packages/ui/src/common/native.ts`、`common/host.ts`、`common/platform.ts`、`packages/ui/test/helpers/native-stubs.ts`、ADR-005、ADR-015（均被本篇取代）
- **取代**：ADR-005（PlatformAdapter 显式契约）、ADR-015（PlatformAdapter 只落地 capabilities）

## 背景

ADR-005 / ADR-015 时期，本库的做法是：把所有平台调用都收拢到 `common/uni.ts`
这一层「uni 门面」，组件统一写 `uni.createSelectorQuery()` / `uni.createVideoContext()`
/ `uni.getSystemInfoSync()`，宿主用 `configureUniAdapter()` 注册真实实现。

这套设计的**前提**是「本库要能跑在 uni-app 宿主里」。但真机验收给出的结论相反：

- **性能不是原生水平**。`uni.*` 是模拟层：`getSystemInfoSync` 每次调用都要做一次
  字段兜底拼装；`createVideoContext` 返回的是后台线程对象，播放/暂停要跨线程下发
  属性 diff，跟手动画期间与 MTS 的直改通道互相抢帧；`createIntersectionObserver`
  在部分宿主上只有空实现，`wd-sticky` 因此退回定时器轮询。
- **能力判定变成「宿主注入了才算有」**。真机引擎明明有 `lynx.createSelectorQuery`
  和 `createIntersectionObserver`，却因为宿主没注册适配器而全部判为不可用，
  组件走降级分支——这是把引擎能力当成了宿主能力。
- **兼容层本身是最大的一层间接**。`uni.ts` + `uniAdapter.ts` + `shime-uni.d.ts`
  三份文件、约 600 行，只服务于一个不存在的宿主；每个组件都要按「有适配器 /
  没有适配器」写两条路径，测试则要按宿主契约注入。

用户反馈（2026-11-07）直接定调：

> 我感觉你这个组件库没有原生的性能，我不需要你去兼容 uniapp 的任何东西，
> 你需要做的就是把这个组件库使用原生的东西写好。

## 决策

### 1. 删除 uni 兼容层，能力只认引擎

删除 `common/uni.ts`、`common/uniAdapter.ts`、`common/shime-uni.d.ts`，主入口不再
导出 `configureUniAdapter` / `uni`。新增两层，边界按「谁提供」划分：

| 层 | 文件 | 只包含 | 判定方式 |
| --- | --- | --- | --- |
| 引擎能力 | `common/native.ts` | `createSelectorQuery` / `createIntersectionObserver` / `invokeNative`（UIMethod）/ `getJSModule` / `NativeModules` / 原生 rAF | 直接探测 `globalThis.lynx` |
| 宿主能力 | `common/host.ts` | 路由、媒体选择、上传、页面滚动、振动、拨号、Canvas 导出、窗口尺寸事件 | `NativeModules.WotLynxUI` → `lynx.getJSModule('WotLynxUI')` → `configureHost()` 显式注入 |

`SystemInfo` 是引擎全局对象，直接读（`getSystemInfo()` 只做字段归一，不再经适配器）。

### 2. 能力是引擎探测的派生值

`platform.ts` 的 4 个能力改为：

```ts
intersectionObserver  // typeof lynx.createIntersectionObserver === 'function'
videoElement          // SystemInfo.engineVersion >= 4，或宿主 supportsVideoElement()
canvas2d              // 宿主 createCanvasContext + canvasToTempFilePath 同时存在
pageScroll            // 宿主 pageScrollTo 存在
```

`mockPlatform()` 保留：它是唯一能强制关闭引擎能力的测试钩子，用来覆盖降级分支。

### 3. 组件按原生通道重写（性能相关）

| 组件 | 旧实现 | 新实现 |
| --- | --- | --- |
| `wd-swiper` 视频播放 | `uni.createVideoContext(id).play()` | `lynx.createSelectorQuery().select('#video-i-uid').invoke({ method: 'play' })`，不经属性 diff |
| `wd-swiper` 视频节点 | 无条件渲染 `<video>` | 引擎 ≥ 4.1 才渲染，否则封面占位（避免 990200 / 60301） |
| `wd-sticky` / `wd-sticky-box` | `uni.createIntersectionObserver`（宿主未注入则轮询） | `lynx.createIntersectionObserver`，无该 API 时纯 CSS `position: sticky` |
| `wd-backtop` | `uni.pageScrollTo` | 宿主 `pageScrollTo`，缺失时只抛事件 |
| `wd-img-cropper` | `uni.getImageInfo` 取原图尺寸 | 原生 `<image>` load 事件的 `detail.width/height` |
| `wd-cell` / `wd-grid-item` / `wd-curtain` | `uni.navigateTo` | 先 emit `navigate`，宿主注册了 `navigateTo` 才实际跳转 |
| `wd-signature` / `wd-qr-code` / `wd-circle` | `uni.createCanvasContext` | 宿主 canvas 能力；缺失时 SVG / data URI 降级 |
| 滚动定位 | `uni.pageScrollTo` + 属性 | `scrollTo` / `scrollIntoView` UIMethod |

顺带删掉了兼容层带来的**降级定时器**：`getRect` 只保留「一次 warning + 零尺寸」
兜底，不再伪造空 SelectorQuery（伪造会让 Promise 永久挂起）。

### 4. 测试桩打在引擎上

`test/helpers/native-stubs.ts` 统一提供 `stubNativeQuery` / `stubNativeObserver` /
`setSystemInfo` / `restoreNativeStubs`。两条约束写进注释：

- 桩必须打在 **background 线程**的 `lynx` 上（组件运行在该线程）；
- `SystemInfo` 必须**原地改对象**——`switchToMainThread()` 会整体替换全局对象，
  直接赋值 `globalThis.SystemInfo = {...}` 会在下一次线程切换时丢失
  （`wd-popup` 安全区用例踩过）。

## 后果

- 组件不再有「有适配器 / 无适配器」两条路径，代码量下降，行为只有一种。
- 真机上 `sticky` / `video` / 手势类交互走引擎原生通道，少一次线程往返。
- **破坏性变更**：`configureUniAdapter` / `uni` 不再导出；宿主必须按
  `WotLynxHost` 契约注册（`NativeModules.WotLynxUI` / `lynx.getJSModule` /
  `configureHost`）。语义上等价，但签名不同。
- 宿主没注册能力时**不再静默成功**：路由只 emit `navigate`，上传回调
  `chooseerror`，canvas 导出返回 `imgloaderror`。
- `SystemInfo` 的安全区、窗口尺寸完全由引擎提供，测试里必须显式桩。

## 推翻条件

- **Lynx 引擎提供官方的跨宿主能力抽象**（例如统一的 router / media API）→
  直接替换 `common/host.ts`，不要重新引入兼容层。
- **出现必须同时跑 uni-app 与 Lynx 的真实需求**（而不是「为了兼容」）→
  在包外做适配器（单独包），不要回到组件内部双路径。
- **`SystemInfo` 被引擎废弃** → `getSystemInfo()` 改为读 `lynx.getSystemInfo()`
  之类的替代 API，`native.ts` 是唯一改动点。
- **测试桩开始绕过 `native.ts` 直接改组件状态** → 说明原生通道被写死了，
  应回到「组件只调用 native.ts」的边界。
