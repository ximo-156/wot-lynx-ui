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

测试页按 8 个分组组织，共 **35 个测试项**，每项包含可交互的组件演示与预期结果说明，勾选后顶部实时显示完成进度：

| 分组 | 验证重点 |
| --- | --- |
| 1. Button | 类型/变体/`:active` 按压缩态/禁用/加载/圆角发丝线 |
| 2. Slider | **拖动跟手**（核心）：拖动流畅、气泡、步长、双滑块 |
| 3. SwipeAction | **横滑跟手**（核心）：跟手、纵向不冲突、阈值、互斥 |
| 4. 弹层 | 遮罩/动画/回调/层级 |
| 5. 表单 | 键盘/受控回显/清除/单选多选/评分 |
| 6. Cell 列表 | 样式/分割线/长列表滚动流畅度 |
| 7. 展示组件 | SVG 图标/4 种 Loading/进度/通知栏/轮播/选项卡 |
| 8. 主题 | 亮暗切换/rpx 适配/底部安全区 |

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
| 二维码扫不出来 / 白屏 | 确认手机与电脑同局域网；确认 `lynx.config.ts` 中 `pluginVueLynx` 已启用 |
| 样式丢失 / 主题色不对 | 确认入口文件 `import 'wot-lynx-ui/theme'`，且 `enableCSSInheritance: true` |
| 组件不渲染（显示为空白原生元素） | 检查是否使用了 kebab-case 标签但未安装 `pluginWotLynxTags()` 插件 |
| 键盘不弹出 | 真机需宿主 App 授权；Explorer 中通常正常 |

## 测试通过标准

- 35 个测试项全部勾选，无崩溃、无红屏
- Slider / SwipeAction 在真机上拖动跟手、无回弹抖动
- 亮/暗主题切换无样式残留
- 长列表滚动流畅（60fps 观感）
