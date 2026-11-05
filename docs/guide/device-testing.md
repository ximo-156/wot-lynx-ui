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

测试页由两大部分组成，共 **142 个测试项**，每项包含可交互的组件演示与预期结果说明，勾选后顶部实时显示完成进度：

**A. 8 组交互验收（36 项，手写卡片）**

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

**B. 全量组件渲染（106 项，与主 demo 共用同一份 `Showcase`）**

页面在交互卡片之后直接挂载 `packages/demo/src/showcase/Showcase.vue` —— 与电脑端主 demo **完全同一份代码**，因此 106 个组件在真机上都有真实实例，逐项对照下方的《全量渲染清单》勾选即可。

> 2026-11-03 之前的 device-test 页只有 28 个组件实例，其余 78 个在真机上从未渲染过（用户反馈「电脑上有的组件真机上没有」就是这个原因）。现在两个入口共用 Showcase，`scripts/check-device-coverage.mjs` 会从 **device-test 入口**跟随 import 断言 106/106 覆盖，缺一个就报错。

页面首屏构建标记为 **`R8 · 弹层贴左上角修复（popup 定位 harness）`**。重新打开手机页面确认标记，不依赖旧页面缓存或开发热更新。此前额外的顶部复测卡已经移除，所有修复均作用于原组件。

### R8：贴边弹层塌到左上角（popup 定位重建）

真机 2026-11-05 复现：**时间选择器、Picker、Dialog、notify 打开后整片贴到屏幕左上角，内容缺失**。Web 预览完全正常，只有真机出现。

根因是原生引擎的一条布局差异（与 `wd-toast` 2026-11-01 那次同源）：`position: fixed` 且 `display: flex` 的节点在真机上按**内容尺寸**收缩，四边 `0px` / `left`+`right` 都撑不开它。`wd-popup` 的过渡根恰好同时满足这两条，于是整片弹层只剩内容大小并被摆在原点。另有两个诱因叠加：面板每帧下发 `left/right/top/bottom: auto`（真机把 `auto` 边按 0 锚定），`center` 用 `left/top: 50%` + `translate3d(-50%,-50%,0)` 居中（本库已明令禁用该写法）。

修法照 `wd-toast` 的真机验收结构，把「定位」与「外观」拆成两层：

- **`.wd-popup-harness`**：`position: fixed` + 四边 `0px` + **显式窗口像素宽高**（`getSystemInfo()` 下发）+ flex 对齐，透明且 `pointer-events: none`，只负责把面板摆到上/下/左/右/正中；
- **`.wd-popup`（过渡根）**：作为 harness 的 flex 子项，只承载背景、圆角与过渡 `transform`，不再自带 `fixed`，也不再写任何 `auto` 边。

动画必须留在面板上——挂到全屏 harness 会整屏位移/缩放。`center` 的缩放改由 flex 居中承担，`transform-origin` 回到 `50% 50%`。

真机验收顺序：① 首屏标记是 `R8`；② 「时间选择器」贴屏幕底部、标题栏完整、轮盘可滚；③ 「Dialog 提示 / 确认」位于屏幕正中；④ 「Notify 悬浮」贴顶且左右各缩 12px；⑤ 点遮罩能关、弹层里的按钮能点（harness 是 `pointer-events: none`，面板为 `auto`）。任何一项仍然贴左上角，请连同构建标记一起反馈。

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

- 142 个测试项全部勾选，无崩溃、无红屏
- 全量渲染区的 106 个组件都有可见渲染结果（不是空白占位）
- Slider / SwipeAction 在真机上拖动跟手、无回弹抖动
- 亮/暗主题切换无样式残留
- 长列表滚动流畅（60fps 观感）
