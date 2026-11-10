# 真机测试指南

本指南介绍如何在**真实设备**（iOS / Android / HarmonyOS）上运行和测试 wot-lynx-ui，以及配套的**设备测试 Demo**（`device-test` 入口）使用方法。

## 方式一：Lynx Explorer 扫码（推荐，无需原生工程）

Lynx Explorer 是 Lynx 团队预构建的真机调试 App，内置 Lynx 引擎，可直接加载开发服务器的 bundle。

### 1. 启动测试 Demo

```bash
pnpm install
pnpm dev:device-test
```

终端会输出 device-test 单入口的地址与二维码：

```
➜  Lynx      http://<你的IP>:3000/device-test.lynx.bundle   # 真机测试清单页
➜  Web Preview http://<你的IP>:3000/__web_preview?casename=device-test.web.bundle
```

> `dev:device-test` 通过 `-c lynx.config.device-test.ts` 只编译 device-test 单入口
> （rspeedy CLI 无 `--entry` 参数）；不带 `:device-test` 的 `pnpm dev:demo` 才会启动全部入口。
> 电脑与手机需在同一局域网。

### 2. 安装 Lynx Explorer

| 平台 | 获取方式 |
| --- | --- |
| iOS Simulator | 下载 [LynxExplorer-arm64.app.tar.gz](https://github.com/lynx-family/lynx-explorer/releases)（Apple Silicon）拖入 Simulator |
| iOS 真机 | App Store 搜索 "Lynx Explorer"（社区维护版） |
| Android | [GitHub Releases](https://github.com/lynx-family/lynx-explorer/releases) 下载 APK 安装 |

### 3. 扫码加载

- 直接扫描终端中 `device-test.lynx.bundle` 对应的二维码；或
- 打开 Lynx Explorer → "Enter Card URL" → 粘贴 `http://<你的IP>:3000/device-test.lynx.bundle?fullscreen=true`

### 4. 按清单逐项验证

测试页分两种模式（顶部切换，默认落地**组件目录**），合计 **145 个测试项**（106 项组件检查 + 39 项交互检查），默认按项挂载。选择目录或上一项/下一项后只运行当前项目；其它项目不会在屏幕外继续建树、动画或查询。勾选进度和父层绑定值在切换时保留，子组件的内部动画与临时状态重新初始化。两种模式同时只挂载一个，切走即卸载，弹层不会跨模式残留。

**A. 组件目录（106 页，默认落地，与主 demo 共用同一份 `Showcase`）**

打开页面即进入组件目录：**一个组件一页**（目录项即组件，如 `Button 按钮`、`Slider 滑块`），共 106 页覆盖全部组件——与 wot-ui demo 一样逐页点看，不再把多个组件塞进同一节。每页渲染该组件的真实演示，演示下方有一张「真机检查」卡，写着这个组件最可能翻车的真机行为（来自 `component-checks.ts`），验完点一下即计入进度。

全量覆盖的含义是**全部可以打开测试**，不是全部同时挂载。需要检查同屏交互/全库压力时，可显式点击「全量压力模式」；该模式会恢复全部挂载，标题提示可能卡顿，不能把它当作单组件性能成绩。

**B. 交互验收（8 组 / 39 项，手写卡片）**

「必须动手操作」的场景（拖动跟手、弹层级联、键盘、长列表、亮暗主题）不在组件页里，单独点顶部「交互验收」进入：

| 分组 | 验证重点 |
| --- | --- |
| 1. Button | 类型/变体/`:active` 按压缩态/禁用/加载/圆角发丝线 |
| 2. Slider | **拖动跟手**（核心）：拖动流畅、气泡、步长、双滑块 |
| 3. SwipeAction | **横滑跟手**（核心）：跟手、纵向不冲突、阈值、互斥 |
| 4. 弹层 | 遮罩/动画/回调/层级/贴边定位 |
| 5. 表单 | 键盘/受控回显/清除/单选多选/评分 |
| 6. Cell 列表 | 样式/分割线/长列表滚动流畅度 |
| 7. 展示组件 | SVG 图标/4 种 Loading/进度/通知栏/轮播/选项卡 |
| 8. 主题 | 亮暗切换/rpx 适配/底部安全区 |

亮/暗切换在页面头部，两种模式都生效——组件目录页同样需要验暗色令牌，不必为了切主题退回交互验收。

页面首屏构建标记为 **`R20 · iOS / Android 上下安全区`**。重新打开手机页面确认标记，避免仍在测旧 bundle。

### R20：上下安全区与日历确认按钮留白

- 主 Demo 和真机清单都从**未加 padding 的根节点**读取原生 `layoutchange`，将实际 LynxView 宽高交给共享视口。屏幕高不再被无条件当作弹层高；页面上下普通间距叠加安全区，但不会用减去 padding 的内容尺寸反复缩小视口。
- Popup 默认避让顶部安全区（`safeAreaInsetTop=false` 可关闭），其最大高度同步扣除顶部距离；`safeAreaInsetBottom` 保留原默认值和显式关闭语义。日历、Picker、键盘等已有底部开关的弹层复用同一来源；Notify 已有手动 `safeHeight` 时不重复加顶部。
- 日历确认行上下保留 **16px 普通 UI 间距**，底部系统安全区由 Popup 单独追加。16px 不是任何机型的手势区高度，关闭系统补偿也不会删除普通按钮间距。
- 首屏额外显示实际视口和安全区来源。显示“原生 env（宿主未上报数值）”表示**仍未知**，不是测出了零安全区。

**宿主几何契约**：`WotLynxHost.getSafeAreaInsets()` 可同步返回最近一次原生布局得到的 `{ top, right, bottom, left }` 快照（四边均为逻辑 px，可部分返回）。iOS 取已经挂载的目标 LynxView 的 `safeAreaInsets`；Android 取目标视图的系统栏／刘海 `WindowInsets`，除以 density，并扣除宿主已消费的部分。已完全避让的边必须明确返回 `0`，不应返回整个屏幕的 inset。系统栏或旋转更新快照后，通过已有 `onWindowResize` 回调通知；即使宽高没有变化也要通知。库支持通过 `configureHost`、原生模块或 JS 模块接入，不在组件内探测宿主全局。

已有 `SystemInfo.safeAreaInsets` 视为视口相对值；旧 `safeArea` 矩形视为屏幕坐标，必须同时提供正确的窗口原点/尺寸，以计算剩余交集。`getSystemInfo` 的 `windowTopKnown/windowLeftKnown` 区分真实原点与兼容默认零；缺失原点时不将矩形换算为“精确 inset”。[官方 SystemInfo](https://lynxjs.org/api/lynx-api/global/system-info.md) 本身不保证这些字段。缺失时使用裸 `env(safe-area-inset-*)`，不用原生不支持的逗号 fallback；[原生求值实现](https://github.com/lynx-family/lynx/blob/a57f701cc91da83314ef3b9de0688a1519eafe1e/core/renderer/css/css_style_utils.cc)并不意味着两端宿主都提供了正确数值。

**限制必须实测**：iOS 环境值可能是窗口级而不是当前 LynxView 的剩余距离；Android Explorer 未必向 CSS 填充系统 inset。缺失真实上报时，普通留白和 env 只能渐进改善，不能保证所有全面屏／三键导航设备都已避让。不要按机型或屏幕比例猜数值；Android 全屏仍被系统栏遮挡时，需要接入真实 WindowInsets，或在宿主已避让的非 fullscreen 模式下复验。

**真机复验（Android / iOS 都执行）**：

1. 确认 **R20**；记录手机型号、Explorer/SDK 版本、屏幕与实际视口、顶部/底部来源。
2. 打开 Calendar：确认按钮完整、可点击，下方普通留白存在；有手势区时还应有对应系统补偿。确认、取消、重开均不累加距离。
3. 检查顶部 Popup / Notify / Navbar 不进入状态栏或刘海，底部 Picker / Keyboard / Tabbar / SubmitBar 不被系统导航区遮住。
4. 覆盖 fullscreen 与宿主已避让模式，后者返回明确 `0` 时不得再次加入系统距离；普通 UI padding 仍保留。
5. 两端冷启动与横竖屏切换；Android 再切换手势／三键导航，确认同尺寸的安全区更新也生效。记录过矮视口中内容和确认按钮是否均可达，不能以构建或 jsdom 样式断言替代真机结果。

### R19：真机验收按组件分页（一个组件一页）

真机反馈：「真机测试是要把每一个组件都显示出来，按页分，效果要和 wot-ui 一样」。此前的结构有两个问题：54 个演示节把多个组件塞进同一节（一个「表单体系」节里十几件），目录按节走，单个组件没有自己的页面；R18 又把 106 条组件检查项从页面上删掉，真机上「很多组件显示不出来」，没法逐项验收。

本轮改动：

- **`Showcase.vue` 重切为 106 个 DemoSection，一个组件一节**：节名即组件标签（`name="wd-button"`），标题与检查项同名。目录逐页浏览与 wot-ui demo 的组件列表一致；普通浏览仍只挂载当前页（未选中的 slot 不求值）。
- **检查项回到页面，但不再重复**：每个组件页渲染自己的真实演示，「真机检查」卡（`ShowcaseLayout` 的 `checkMap`）把 `component-checks.ts` 的对应检查项挂在同一页——文字与它描述的组件同页出现，而不是 R18 之前那种与演示分离的纯文字清单。勾选进度与 8 组交互卡共用（`totalItems = 145`）。
- **device-test 收敛为两种模式**：顶部切换「组件目录（106 页）」/「交互验收（8 组）」，默认落地组件目录；`v-if` 保证同时只挂载一个，切走即卸载。R18 的「目录里再嵌一层 Showcase」双层导航取消。
- 主 demo 与 device-test 仍共用同一份 `Showcase`（同一份组件代码），主 demo 不传 `checkMap`，行为与此前一致。

**真机复验**：① 首屏标记是 `R19`；② 打开即见组件目录，「目录（106 项）」里每个组件都在，逐页打开都有可见渲染（不是空白占位）；③ 组件页的「真机检查」卡可勾选，顶部进度按 145 项实时累计；④ 切到「交互验收」8 组卡照旧可勾选，进度不清零；⑤ 头部亮/暗切换在两种模式下都生效；⑥ 需要同屏压力时仍可显式进入「全量压力模式」，验收完毕退回逐项模式。

### R17：级联选择器选中区县、指示线仍贴最左边

截图里“西湖区”已激活，但紫线不在该标签下面。旧实现只验证了 `translateX(...)` 字符串，未证明原生实际居中；定位还依赖标签宽度累加和两次横向平移（其中一次为 `-50%`），同数量的标题变更也没有触发重新度量。

修复在共享 Tabs，不是在 demo 上覆盖位置：

- 独立原生定位锚点与当前标签等宽等高，以标签矩形相对导航容器矩形的差值作**单次像素平移**；导航容器用实例唯一 id 度量，避免复杂选择器及同页多实例串台。
- 线条本身不再平移，交由原生 flex 水平居中，纵向用 spacer 定位；保留正常、文本、整项下划线、圆点的主题尺寸及自定义线宽/线高。
- 同层级数的标签文案变化、布局变化会更新定位；尺寸无效时隐藏且有界重试，旧请求不能把指示线拉回先前标签，触摸移动不重复查布局。

自动化覆盖“请选择 → 浙江省 → 杭州市 → 西湖区”、返回前一级、更换省份、提交后重新回显、不同标题长度、同页多实例与吸顶分支。浏览器预览也检查标签和短线的实际中心，不能仅检查样式字符串。该预览不是 Android/iOS 真机；请在 R17 逐项打开 Cascader，确认省、市、区切换及重新打开时紫线始终位于当前标签下方。

### R16：真机 demo 卡顿的负载排查

旧入口把 8 组交互卡、整个 Showcase 和 106 条清单放进一个普通 scroll-view。scroll-view 不会自动卸载离屏组件：日历一次创建默认范围的全部月份，签名预建 512 个笔迹线段，4 个 CountTo 在首 2–3 秒动画，CountDown 的秒级显示也经逐帧调度推进；Tabs 首帧度量为零时还会最多重试 10 次。

同一 Vue Lynx 双线程测试环境、同一默认配置的前后对比（2026-11-08）：

| 指标 | 修改前（e563fc2） | R16 默认按项模式 |
| --- | ---: | ---: |
| 主 demo 挂载节点 | 6,678 | 122 |
| device-test 挂载节点 | 8,372 | 133 |
| device-test 挂载后 400ms 内 SelectorQuery 调用 | 163 | 0 |
| 挂载后 1.4–4.4s 内 timeout 新调度（含查询 mock，不含探针） | 78 | 0 |

其中 CalendarView 一节为 3,440 节点，约占原主 demo 的 51.5%。新入口不挂载未选择的节，弹层也随所属测试项挂载；不是用 `display:none` 或 KeepAlive 藏起整页。手势诊断关闭时不注册额外的 touchmove 采样监听。

**测量边界**：这些数字不是手机 FPS、CPU 或绘制耗时。测试环境的矩形为零、没有原生 rAF，所以轮播的自动播放门禁不会打开、CSS 动画开销也不在统计内。节点数可比较，不能把 JS timeout 或测试耗时换算为设备帧率。Tabs 重试是有上限的首帧放大因素，不是永久轮询；此轮没有撤销原来的指示线正确性修复。

**真机复测**：

1. 确认 R16，先逐项检查 Button、Slider、SwipeAction、弹层、输入与清单切换；切回后父层绑定值和已勾项目保留，旧项目无计时器/观察器继续运行。
2. 使用同一设备和同一构建，对比普通模式与显式全量压力模式；正常功能验收不要一直停在压力模式。
3. 区分开发调试包和生产包；关闭远程断点/大量控制台日志后再测，避免把调试开销当作组件耗时。生产包可用下面的现有脚本构建与预览，设备访问终端实际输出的局域网地址。
4. 若独立打开 CalendarView 等项目仍卡，记录设备型号、SDK/Explorer 版本、发生卡顿的具体动作，以及性能 trace 中 JS/布局/绘制/GC 的占比。按项挂载不改变单组件内部的月份范围，也不能代替这一步测量。

```bash
pnpm build:device-test
pnpm --filter wot-lynx-demo preview
# 回归：真实组件是否可访问、节点预算、切页卸载、值/检查状态保留
pnpm --filter wot-lynx-ui exec vitest run test/regression/demo-workload.test.ts
```

### R14：关闭后日期标题 / Loading 文案残留在左上角

2026-11-07 用户再次反馈左上角残留：背景已经恢复正常，时间选择器标题等文字却仍悬浮在原点。这与“打开时整块面板位置错误”必须分开排查，不能再仅凭增加窗口宽高、调整 flex 对齐就认定已解决。

**已核实的遗漏**：[Lynx 官方 display 文档](https://lynxjs.org/api/css/properties/display.md) 明确说明 `display:none` 把元素及后代缩成 **0×0**，但内部 `text` 仍可能绘制，需要对应父级 `overflow:hidden`。日期时间选择器的 `hideWhenClose=false` 保留滚轮/标题；Toast 的 `close()` 只修改 `show`，默认 Transition 也保留上次 Loading/消息子树。此前共享过渡根只有 `display:none`，没有闭态裁剪，正好漏掉此原生约束。

修复在共享 `WdTransition`，不改日期计算、滚轮取值或 Loading 图形：

- 初始关闭及退场完成时，在真正显隐的根节点同时下发 `display:none` 和两轴裁剪；调用方定制的 `overflow:visible` 不能覆盖关闭保护。
- 入场前显式清除保护、恢复用户/类样式，退场中不提前裁剪；避免可见圆角内容被裁空或动画中途消失。
- 保留原有保活/懒渲染/销毁契约；快速重开不会被旧退场回调重新裁掉，模态滚动锁仍在退场完成后释放。

**真机复验（本地协议测试不代替这一步）**：

1. 确认首屏 **R14**，记录系统、Explorer/SDK 版本；冷启动且未开弹层时左上角应无残字。
2. 在原「时间选择器」打开并滚动列，分别用取消、确认、遮罩关闭。等退场结束后上下滚页，检查原点无标题/按钮/滚轮残留；取消重开回到已提交值，确认重开保留新值。
3. 点原「Toast 加载」，等两秒自动关闭及退场结束：原点无“加载中”或图形，页面恢复滚动；连续重复五次，再在退场中重新打开。
4. 检查显示态未回归：时间选择器仍贴底、Dialog 仍居中、动画完整；四类内联 Loading 在自己的演示区域随页面滚动。
5. 若**打开期间**仍整体错位，请同时保留面板、harness、遮罩的 DevTool 样式与实际矩形，以及完整截图/录像。这属于显示态定位问题，不能用“闭态已裁剪”代替验证。

自动化回归直接检查真实 Vue Lynx 双线程的主线程样式与绘制批次，覆盖初始隐藏、保活内容更新、四种关闭通道、Loading 手动/定时关闭和快速重开。测试宿主不实现原生文字绘制，`display:none` 或矩形为 0 本身不能证明屏幕无残留，仍需以上 Android/iOS 像素验收。

### R11：滑动验证没有滑块、也永远判不过（首屏度量补测）

真机 2026-11-05 用户反馈（R10 之后，截图）：**「向右滑动验证」那条只有提示文字，左侧没有白色滑块按钮；能拖动的地方也没有正常效果**（拖了不跟手、松手不通过）。同一屏里按钮 / 选择器 / 签名 / 上传都正常，Web 预览也完全正常。

根因：容器尺寸**只在 `onMounted` 经 `getRect` 度量一次**，而真机首帧布局未完成时该度量拿到 0（`wd-slider` 2026-11-05 同款缺陷，当时靠 `layoutchange` + 落定前补测修掉）。尺寸一旦为 0，两个后果叠加：

1. 轨道内联宽度 = `当前位置 0 + 容器高 0` = **0px**——轨道带 `overflow: hidden`，40×40 的滑块被整块裁掉 → **没有滑动按钮**；
2. `maxPosition = 容器宽 - 容器高 = 0`——fail-closed 守界永远判不过，落定时 `updatePosition` 还把终值钳回 0 → **没有正常的效果**。

修法（四层兜底，任一层生效都能自愈）：

- 根节点挂**原生 `layoutchange`**，布局完成后补度量（`wd-slider` 同款路径，0 矩形被忽略、不冲掉已度量尺寸）；
- 手势**开始即补测**（`ensureSize`，尺寸缺失时才发查询），落定前拿到真实容器尺寸；
- **落定时尺寸仍缺失则先补测再提交**，避免把本可通过的手势误判成 fail；
- 轨道 CSS `min-width` 兜底滑块尺寸（真实宽度恒 ≥ 滑块尺寸，不改变任何已度量状态下的布局），度量缺失时滑块也不被裁掉。

顺带两条收敛：主线程几何改由后台经 `container-width` / `container-height` **属性同步下发**（`wd-slider` 的 `gesture-size` 同款，同步可取、无 Promise 时序），属性缺失才回退 `MainThread.Element.invoke`；`layoutchange` 同时**声明为 emit 并转发**（CONVENTIONS §14）——否则消费方的 `@layoutchange` 监听会穿透 `$attrs` 与根元素自身监听被 `mergeProps` 合并成数组，设备上事件到达即抛 registry TypeError。

真机验收：① 首屏标记是 `R11`；② 拖到「SlideVerify / Signature / Upload」那节 → 灰色条**左侧有白色圆角滑块**（双箭头图标）、条内提示文字居中；③ 按住滑块拖到最右松手 → 轨道变绿、显示成功文案、`success` 事件触发（demo 上方「验证通过」类状态随动）；④ 拖到一半松手 → 轨道回弹到起点并发 `fail`；⑤ 刷新页面后立刻拖动（不等停留）也要能正常通过——首帧度量不再依赖时序。

### R9：滑块松手后整页卡死、气泡常驻（拖动收尾重建）

真机 2026-11-05 复现：**拖动滑块再松手，整个页面就不能滚动了**（像卡死），气泡与按压态一直挂着，之后滑块也不再响应；有时值还会弹回起点。

根因是拖动的结束信号**只绑在圆点**上。圆点只有 24px，手指沿轨道滑出去再松手时，原生按落点派发事件就收不到 `touchend`，`isDragging` 从此永久为 true，连带三个后果：

1. `useLockScroll` 一直持有租约 → 页面 `scroll-view` 的 `scroll-enable` 被关死 = 整页不能滚；
2. 气泡显隐依赖 `isDragging` → 气泡与按压态常驻（看起来像「回弹一直在」）；
3. `onTouchStart` 开头的 `isDragging` 早退 → 滑块彻底不再响应。

另一条独立的回弹路径：原生 `start` 的触点带 `identifier`、`end` 的 `changedTouches` 却不带，旧实现按 id 找不到就当成「另一根手指」丢帧，最后一帧不提交，值停在开始的位置。

四层修复，任何一层生效都能自愈：

- `touchend` / `touchcancel` 同时绑到**整条轨道**，手指落在滑块任意位置都能收尾；
- end 的归属判断只认「可识别的异号触点」，缺 id 时按单触点兜底取值——宁可收尾，绝不卡住；
- 时间戳只用于拒绝上一手势的迟到 **move**，不再拦截 end（原生两端的时间基准可能不同，一判错就永不结束）；
- 静默兜底：拖动期间只要超过 1.2s 没有任何 move/end，就按 cancel 提交当前值并释放滚动锁。

真机验收：① 首屏标记是 `R9` 或更高（后续批次都包含本修复）；② 按住圆点沿轨道拖到最右再**在轨道上**松手 → 值停在松手位置、气泡收起；③ 松手后立刻上下滑动页面 → 必须能滚；④ 松手后马上再拖一次 → 正常跟手；⑤ 双滑块两枚各自拖动，互不穿越、互不卡死。

### R10：贴边弹层贴在屏幕正中（justify-content 边值失效，改主轴占位）

真机 2026-11-05 用户反馈（R8/R9 之后，截图）：**「底部 Popup」打开后贴在屏幕正中间**，不上不下；在它上面再开 Dialog 确认，Dialog 本身居中正常。同一屏里单元格的标题/取值两端对齐正常——只有弹层的主轴摆位错了。

根因是又一条原生引擎差异（与 R8 的「fixed + flex 收缩」不同源）：harness 按 position 下发的
`justify-content: flex-end / flex-start` **在真机上被按 `center` 处理**（`flex-direction`
两个方向都试过，`center` 本身正常——所以 Dialog / Toast 仍居中，R8 的验收项③ 是被
「歪打正着」满足的）。于是底部 Popup / Picker / 时间选择器 / 侧边抽屉全部贴在屏幕正中。

为什么不用「单边 edge 定位」补：真机对**缺省**边按 0 锚定（CONVENTIONS §19 差异 #2），
`bottom: 0` 会被缺省 `top` 的 0 值顶掉（pre-R8 贴左上角同源）；面板高度由内容决定，
也补不了显式 `top`。

修法：harness 里放一个 **`flex-grow: 1` 的空占位 view**（`.wd-popup-spacer`）吸收主轴
剩余空间，把面板挤到目标边——占位在面板**前** = 挤向末端（bottom / right），在面板**后**
= 挤向起点（top / left）；`center` 不放占位，继续用已验证的 flex 居中。flex-grow 是真机
可用路径（同页 wd-cell 的 `__left` / `__right` 两端对齐即证据）。harness 原有的
`justify-content` 边值保留为兜底：占位正常工作时主轴已无剩余空间可分配，边值不起作用。

真机验收：① 首屏标记是 `R10`；② 「底部 Popup」贴屏幕底部、圆角在上、遮罩可点关；
③ 「时间选择器」「Picker」贴屏幕底部、标题栏完整、轮盘可滚；④ 「Dialog 提示 / 确认」
仍位于屏幕正中；⑤ 「Notify 悬浮」贴顶且左右各缩 12px；⑥ 在弹层上再开 Dialog，
两层层级与回调正常（确认/取消均正确返回）。

### R8：贴边弹层塌到左上角（popup 定位重建）

真机 2026-11-05 复现：**时间选择器、Picker、Dialog、notify 打开后整片贴到屏幕左上角，内容缺失**。Web 预览完全正常，只有真机出现。

根因是原生引擎的一条布局差异（与 `wd-toast` 2026-11-01 那次同源）：`position: fixed` 且 `display: flex` 的节点在真机上按**内容尺寸**收缩，四边 `0px` / `left`+`right` 都撑不开它。`wd-popup` 的过渡根恰好同时满足这两条，于是整片弹层只剩内容大小并被摆在原点。另有两个诱因叠加：面板每帧下发 `left/right/top/bottom: auto`（真机把 `auto` 边按 0 锚定），`center` 用 `left/top: 50%` + `translate3d(-50%,-50%,0)` 居中（本库已明令禁用该写法）。

修法照 `wd-toast` 的真机验收结构，把「定位」与「外观」拆成两层：

- **`.wd-popup-harness`**：`position: fixed` + 四边 `0px` + **显式窗口像素宽高**（`getSystemInfo()` 下发）+ flex 对齐，透明且 `pointer-events: none`，只负责把面板摆到上/下/左/右/正中；
- **`.wd-popup`（过渡根）**：作为 harness 的 flex 子项，只承载背景、圆角与过渡 `transform`，不再自带 `fixed`，也不再写任何 `auto` 边。

动画必须留在面板上——挂到全屏 harness 会整屏位移/缩放。`center` 的缩放改由 flex 居中承担，`transform-origin` 回到 `50% 50%`。

真机验收顺序：① 首屏标记是 `R8` 或更高（R10 已包含本修复）；② 「时间选择器」贴屏幕底部、标题栏完整、轮盘可滚；③ 「Dialog 提示 / 确认」位于屏幕正中；④ 「Notify 悬浮」贴顶且左右各缩 12px；⑤ 点遮罩能关、弹层里的按钮能点（harness 是 `pointer-events: none`，面板为 `auto`）。任何一项仍然贴左上角，请连同构建标记一起反馈。

### R8 续：遮罩没有全屏、点遮罩关不掉（overlay 同款收缩）

真机 2026-11-05 用户反馈（紧随 R8 之后）：「输入面板没有全屏，输入之后文字没有保留到面板上，手指离开面板文字就消失了」。

根因与 R8 是**同一条差异**，只是塌的是遮罩而不是面板：`.wd-overlay` 同样满足「`position: fixed` + `display: flex` + 四边 `0`」，2026-11-02 为让消费方插槽里的 `flex: 1` 内容撑满居中给它补了 `display: flex`，却漏了 R8 那半场「显式窗口像素」修复——空插槽的遮罩在真机上塌成 **0×0** 贴在屏幕左上角：

- 所有带蒙层的弹层（时间选择器 / Picker / Dialog / Calendar…）**没有全屏遮罩**，页面不被压暗；
- 遮罩收不到点击 → 「点遮罩关闭」全线失效。默认数字键盘没有关闭按钮、只靠遮罩关闭，于是被卡在关不掉；用户被迫刷新页面离开，输入的值随之丢失——这就是「文字没有保留 / 一松手就没了」的来处。

修法：四边 `0` 保留在 CSS 类里，宽高经 Style Funnel 按 `getSystemInfo()` 每帧显式下发（与 wd-toast / wd-popup harness 同款），插槽内容的 flex 居中不受影响。顺带把键盘隐形遮罩从 `opacity: 0` 改成 `background-color: transparent`（Lynx 自家 x-overlay 与 wd-toast cover 遮罩的同款写法）——命中测试不依赖 opacity，「不可见但可点」才有保证。

真机验收：① 打开「日期时间」，整个屏幕被压暗（遮罩铺满，不再只有角落）；② 点遮罩能关闭；③ 「弹出键盘」后点面板外任意处，键盘收起，密码框里的圆点与「已输入 N/6 位」回显保持；④ image-preview / video-preview 的全屏底板不再挤在左上角。

### R7：直接检查原组件

1. **Slider**：在原滑块区域连续拖动、快速反向及操作范围右端，手指未离开时进度应持续变化；松手不能被旧 v-model 回写或补发 tap 拉回。
2. **时间选择器 / 弹窗**：打开后拖动滚轮、面板空白和遮罩，背景页面不得跟着滚动；关闭及退场完成后恢复背景滚动。弹层内部自己的 scroll-view 仍可滚动。
3. **Fab**：在原悬浮按钮区域展开菜单、拖动和松手；查询失败不能把按钮拉回左上角，点页面空白可关闭菜单。
4. **文字 / 布局**：检查原单元格、通知、空状态、按钮等文字是否留在自身容器内；底部和居中弹层不得超出手机视口。

### 手机页面滚动锁接入

锁滚必须关闭背景的原生 scroll-view，而不是只设置浏览器 body 或调用触摸 preventDefault。本项目两个原页面入口已经接入；其他消费者也应在背景滚动容器上绑定同一个只读状态，**不要绑到弹窗内的内容滚动容器**：

```vue
<script setup lang="ts">
import { usePageScrollLock } from 'wot-lynx-ui'
const pageScrollLocked = usePageScrollLock()
</script>

<template>
  <scroll-view
    scroll-orientation="vertical"
    :scroll-enable="!pageScrollLocked"
    :enable-scroll="!pageScrollLocked"
  >
    <!-- 原页面内容；保持原有确定高度链路 -->
  </scroll-view>
</template>
```

两个开关名用于覆盖当前原生/预览宿主的属性差异。Popup、Overlay 和正在拖动的 Slider/Fab 共用锁状态；嵌套弹层分别持有租约，不会因关闭其中一层就错误解锁。`lock-scroll="false"` 应使用 Vue 的布尔绑定 `:lock-scroll="false"`。

**验证边界**：本轮优先修复手机原组件，不新增测试或演示文件。现有回归和运行时协议验证不能替代 Android/iOS 对实际触点、滚动仲裁和安全区的验收；若仍异常，请附构建标记、引擎版本及原组件的操作录像。

## 方式二：Web 预览（快速冒烟）

不装 App 时，可直接在浏览器打开 Web Preview URL 做快速冒烟测试（Lynx Web 渲染，样式与交互基本一致，但**原生性能特征无法完整体现**，正式验收请以真机为准）。

## 方式三：构建产物 + 自有宿主 App（生产联调）

```bash
pnpm build:device-test   # 产出 dist/device-test.lynx.bundle
```

将 bundle 托管到 CDN 或本地服务器，在已集成 [Lynx SDK](https://lynxjs.org/guide/start/integrate-with-existing-apps) 的宿主 App 中加载：

```
LynxView.load(bundleUrl)  // bundleUrl 为 device-test.lynx.bundle 的可访问地址
```

## 调试

- **Lynx DevTool**：下载桌面版，USB 连接设备，可查看元素树、日志与线程状态
- **日志过滤**：组件库在能力降级时会打印 `[wot-lynx-ui]` 前缀警告（如 Canvas 相关组件）

## 常见问题

| 现象 | 排查 |
| --- | --- |
| 卡在 `Rspeedy v0.13.5 (… , Rspack …)` 一行不动，几分钟没输出 | 仓库在 iCloud「桌面与文稿」里、`node_modules` 被系统驱逐成占位文件。见下方《启动卡住：iCloud 占位文件》 |
| 二维码扫不出来 / 白屏 | 确认手机与电脑同局域网；确认 `lynx.config.ts` 中 `pluginVueLynx` 已启用 |
| 样式丢失 / 主题色不对 | 确认入口文件 `import 'wot-lynx-ui/theme'`，且 `enableCSSInheritance: true` |
| 组件不渲染（显示为空白原生元素） | 检查是否使用了 kebab-case 标签但未安装 `pluginWotLynxTags()` 插件 |
| 键盘不弹出 | 真机需宿主 App 授权；Explorer 中通常正常 |
| Upload 上传点相机卡片只弹输入法 / 不弹相册 | Lynx [原生 input](https://lynxjs.org/api/elements/built-in/input.md) 不支持 `type="file"`，透明输入框仍会聚焦并弹出键盘。Demo 唤起卡片现在只用 view，一次 tap 交给 Upload 的 `beforeChoose` → 宿主 `chooseMedia` → `beforeUpload` → 入列流程；宿主需通过 Native Module / JS Module 或 `configureHost()` 接入真实相册/拍照。缺失能力会明确提示；`uploadMethod` 演示桩仅模拟网络上传，不提供选图。Web 也需要真正的文件选择适配，x-input 的文本 value/fakepath 不是可上传文件 |

## 启动卡住：iCloud 占位文件

典型现场：`pnpm dev:device-test` 只打印了

```
  Rspeedy v0.13.5 (Rsbuild v1.7.3, Rspack v1.7.12)
```

然后**一直停在这里**，没有任何报错、没有二维码，只有 Ctrl+C 才能退出。它不是设备问题，也不是配置问题——dev server 根本还没起来。

**原因**：macOS「桌面与文稿」开启 iCloud 同步后，`~/Documents` 的底层目录属于 iCloud Drive。长时间没访问的文件会被系统释放为**仅云端占位文件**（`ls -lO` 显示 `dataless` 标志）。rspeedy 冷启动要读上万个文件，每个占位文件都要走一次 iCloud 按需下载：实测单文件 0.5–4.4s，而读取是串行逐文件进行的，于是整体看起来"卡死"。

**确认**：

```bash
ls -lO node_modules/.pnpm/es-abstract@1.24.2/node_modules/es-abstract/2019/IsArray.js
# 输出里带 "dataless" 即为占位文件；带普通权限位且无该标志则是本地文件
```

**修复**（依赖已缓存在本地 pnpm store，重装只是重新落盘，不需要联网）：

```bash
pnpm install --force --prefer-offline
```

**尤其不要**用 `brctl download node_modules` 或 `cat` 全量遍历来"补下载"：前者与后台同步抢带宽、按每个文件几百毫秒推进，`node_modules` 近 3 万个文件要跑几十分钟；后者只能逐个补、还可能与同步冲突。重装后占位文件从 2.5 万个降到个位数，`pnpm dev:device-test` 恢复约 3.5s 就绪。

**长效做法**：把仓库放到非 iCloud 目录（如 `~/dev/`、`~/work/`），或在「系统设置 → Apple 账户 → iCloud → iCloud 云盘」里关闭「桌面与文稿」同步。

> 连带影响：同样的占位文件也会让 `grep -r`、`vitest`、`git status` 等任何遍历 `node_modules` 的命令变得极慢，甚至看起来挂死。

## 测试通过标准

- 145 个测试项全部勾选（106 项组件检查 + 39 项交互检查），无崩溃、无红屏
- 组件目录中 106 个组件逐页打开都有可见渲染结果（不是空白占位）
- Slider / SwipeAction 在真机上拖动跟手、无回弹抖动
- 亮/暗主题切换无样式残留
- 长列表滚动流畅（60fps 观感）
