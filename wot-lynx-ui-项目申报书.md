## wot-lynx-ui 项目申报书

### 基本信息

- 项目名称: wot-lynx-ui
- 参赛者: JY_en_ke_hao
- 联系方式: liufangjin156@163.com
- GitHub 仓库链接: https://github.com/ximo-156/wot-lynx-ui.git
- 项目方向: Vue Lynx 跨平台组件库 / 原生渲染 UI 基础设施
- 是否为移植项目: 否

### 项目简介

wot-lynx-ui 计划将 wot-ui（uni-app 生态最流行的 Vue 3 组件库之一）的核心组件能力重写到 Vue Lynx 生态，借助 Lynx 的双线程架构与原生渲染管线，在 iOS / Android / HarmonyOS / Web 四端获得接近原生的 UI 性能。项目面向使用 Lynx 引擎构建跨端应用的 Vue 开发者、组件库作者和应用团队，提供与 wot-ui 完全一致的 `wd-*` 组件 API、`--wot-*` 设计令牌体系、按小米 HyperOS 4 美学重建的视觉样式、双线程性能实现，以及配套的文档站、Demo、真机测试清单和测试基座。设计令牌沿用 wot-ui 的 `--wot-*` 变量体系，BEM 类名与 wot-ui 一致，已有 wot-ui 项目可低成本迁移。

### 核心功能范围

- 提供 102 个 `wd-*` 组件，覆盖基础、表单、反馈、导航、展示等完整类别，组件名、props、slots、events 与 wot-ui 对齐，迁移成本低；
- 完整保留 wot-ui 的 `--wot-*` 设计令牌体系（颜色 / 字体 / 圆角 / 间距 / 描边 / 阴影），取值按小米 HyperOS 4 美学重建（品牌蓝 `#3482FF`、大圆角、更舒展的字号字重与柔和投影），换肤只需覆盖 CSS 变量；
- 提供统一主题入口 `wot-lynx-ui/theme` 与 `wd-config-provider` 全局配置，CSS 变量驱动的亮色 / 暗色主题；
- 基于 Lynx 双线程架构的原生性能实现：按压缩态使用 CSS `:active`（渲染器原生处理、零 JS 开销），细线边框使用 `1ppx` 物理像素，高频交互（Slider 拖动、SwipeAction 横滑）在后台线程以响应式实现，跟手时段禁用 CSS transition、落位时恢复；
- 提供 302 个图标的原生 SVG 实现（由 iconfont 提取为 path 数据），免字体加载，整个图形作为单个原生视图绘制，颜色通过 `fill` 实时控制；
- 提供弹层与绘制能力：`position: fixed` 节点自动提升至根节点（无需 teleport），圆环 / 二维码 / 条形码 / 签名 / 水印等 canvas 2D 能力以 SVG 方案重建；
- 提供 16 种语言的多语言 locale 与日期格式化工具；
- 提供标签兼容插件 `pluginWotLynxTags`（`wot-lynx-ui/plugin`），支持沿用 `<wd-button>` kebab-case 写法；提供 `wd-dialog` 命令式 API（`useDialog`）；
- 提供可测试基座：基于 `@lynx-js/testing-environment` 的 Vue Lynx 双线程测试环境，共 251 个测试用例，含 101 个组件全量渲染冒烟测试，以及交互、DOM 结构、事件注册表完整性、SVG 内容安全等专项测试；核心回归持续维护（当前 206 个通过，45 个回归待修复，集中于 wd-dialog / wd-cell / wd-popup / wd-notify 等近期改动组件）；
- 发布预编译 CSS，消费者无需安装 Sass 工具链；组件以源码分发，由 Rspeedy 直接编译，天然支持 Tree-shaking；
- 提供 VitePress 文档站（102 个组件文档 + 快速开始 / 主题 / 高性能实践 / 与 wot-ui 的差异指南）、Demo 应用（`pnpm dev:demo`，web + lynx 双端构建）与 59 项真机测试清单页（Lynx Explorer 扫码直接在真机验证按钮按压缩态、拖动跟手、弹层、表单键盘、长列表滚动、亮暗主题等）。

### 参考说明

- 原项目名称: wot-ui（https://wot-ui.cn/）
- 原项目链接: https://github.com/wot-ui/wot-ui（基线版本 2.3.2）
- 原项目许可证: MIT
- 参考框架: Vue Lynx（Vue 3 的 Lynx 自定义渲染器）与 Lynx 跨平台原生渲染引擎