# 小米设计美学与 HyperOS 设计语言调研报告

> 用途：重构移动端组件库的设计令牌（Design Tokens）
> 调研方式：直接抓取小米官方站点（hyperos.mi.com、MiSans 字体站、mi.com 全球站）的页面、CSS 与内嵌设计系统代码
> 调研日期：2026-08（数据以官方站点当前版本为准）
> 所有数值均标注来源 URL；无法从官方来源核实的项标注「待核实」。

---

## 0. 来源清单与可信度说明

| 来源 | URL | 内容 |
|---|---|---|
| HyperOS 4 官网 | https://hyperos.mi.com/ | 「生命感美学」官方表述、柔光玻璃/光效系统 |
| HyperOS 2 官网（存档） | http://web.archive.org/web/20250107155401/https://hyperos.mi.com/ | 「生命感美学 2.0」导航结构 |
| HyperOS 全球站 | https://www.mi.com/global/hyperos | 品牌 Logo SVG（#ff6900）、HyperOS 3 动效官方描述 |
| HyperOS 官网样式表 | https://hyperos.mi.com/_next/static/css/83f7d1c9a42a8835.css | **完整设计令牌**（语义色亮/暗、渐变、圆角、动效缓动） |
| HyperOS 官网设计系统代码 | https://hyperos.mi.com/_next/static/chunks/172-a1d28d539d157a49.js | **FIGMA_PRESETS**（字号层级、按钮规范、间距/安全区、调色板）——与小米官方 Figma 设计系统同源 |
| HyperOS 官网页面代码 | https://hyperos.mi.com/_next/static/chunks/app/page-38202d89cac90baa.js | 组件用法（rounded-card、bg-card-mist 等） |
| MiSans 官网 | https://hyperos.mi.com/font | MiSans Global 项目介绍、字重、许可 |
| MiSans 官网-关于 | https://hyperos.mi.com/font/about | 字体发展史、设计原则、排版规范 |
| MiSans 官网-下载 | https://hyperos.mi.com/font/download | 各字库字符数/字重/语言数 |
| MiSans 官网-FAQ | https://hyperos.mi.com/font/faq | 免费商用、可变字体说明 |
| MiSans Latin 官方 Webfont | https://i02.appmifile.com/i18n/fonts/MiSansLatin/index.css | 官方 CSS 字重映射 |
| Mi 全球站主样式 | https://www.mi.com/sgp/spps_files/activity/0.6.69/pc_v4/hyperos-2025/css/main.css | 商城行动色 #ff6700 |

**重要说明**：小米设计规范站 design.mi.com 从本次调研网络环境不可达（连接被拒），未能取其独立发布的规范原文。本报告的全部数值来自 **hyperos.mi.com 官方站点自身实现**——其 CSS/JS 中内嵌了名为 `FIGMA_PRESETS` 的官方设计系统预设（含 Figma 令牌名称、px 原始值），可视为官方设计语言的实现级权威来源。

---

## 1. 官方设计理念关键词（原文表述）

### 1.1 HyperOS 4：「生命感美学」（当前官方主张）
来源：https://hyperos.mi.com/ （首页原文）

- **「生命感美学」营造有温度、鲜活的数字空间**
- **柔光玻璃，会呼吸的材质**：感知环境色，自然融合。「为此回归设计本源，我们从**材质、光影、空间关系**中找到新的表达式」
- **点按有光，操作有回应**：感知交互行为，用灵动光效，生动响应你的操作
- **拖拽有光，流转更自然**：光效跟随拖拽轨迹自然流动
- **柔光玻璃与光效系统**：感知内容自适应通透度，识别更清晰，层次更精致
- **柔性框架**：手机应用小屏顺手、平板应用大屏高效；「更灵活的空间，随你编排」（锁屏时钟/通知、大小文件夹、小部件堆叠）
- 设计三要素：**材质、光影、空间关系**（官方原文归纳）

### 1.2 HyperOS 2：「生命感美学 2.0」
来源：Wayback 存档 http://web.archive.org/web/20250107155401/https://hyperos.mi.com/ （官网导航：`01 生命感美学2.0`）。详细设计正文为客户端渲染、存档未捕获完整文本，**待核实**（建议从「小米设计委员会」微信公众号历史文章《小米澎湃OS 2 设计理念》补充）。

### 1.3 HyperOS 3（全球站官方描述）
来源：https://www.mi.com/global/hyperos

- **"Over 100 system-wide animations have been refined for a more fluid look and a seamless visual experience"**（100+ 系统级动画被重新打磨，追求更流畅的一体感）——HyperOS 动效的官方总纲。

### 1.4 MiSans 官网阐述的设计原则
来源：https://hyperos.mi.com/font/about

- 基本原则：**简约/清晰，人文/易读，统一的视觉风格**；构建多语言信息体验一致性
- 排版两原则：**层级清晰、阅读舒适**
- 「通过**人因研究**结合应用场景定义了**字号规范、行长、间距**等，在 Xiaomi HyperOS 中建立了完整的系统排版规范」

---

## 2. 色彩体系

### 2.1 品牌橙（官方色值）

| 令牌 | HEX | RGB | 来源 |
|---|---|---|---|
| **小米品牌橙（Logo/品牌主色）** | **#FF6900** | `rgb(255,105,0)` | 官方 Logo SVG `fill="#ff6900"`，见 https://www.mi.com/global/hyperos 页头 `<svg class="logo__mi" ...><g fill="#ff6900">` |
| 商城行动色（按钮/链接，历史橙） | #FF6700 | `rgb(255,103,0)` | https://www.mi.com/sgp/spps_files/activity/0.6.69/pc_v4/hyperos-2025/css/main.css （`.xm-button{background-color:#ff6700}`） |

> 建议：组件库主品牌色用 **#FF6900**（2021 品牌升级后的官方品牌橙，原研哉新 Logo 同色）；商城场景行动色可保留 #FF6700 作为别名。

### 2.2 HyperOS 语义色令牌（官方，亮/暗双模式）
来源：https://hyperos.mi.com/_next/static/css/83f7d1c9a42a8835.css （`:root` 与 `.theme-dark` 块）

| 语义令牌 | 亮色 | 暗色 (.theme-dark) |
|---|---|---|
| `--c-page` 页面底色 | `#FFFFFF` | `#222222` |
| `--c-surface` 表面/卡片 | `#FFFFFF` | `#2E2E2E` |
| `--c-tint` 浅灰填充 | `#F5F5F7` | `#2B2B2B` |
| `--c-card-mist` 雾面卡片 | `#F2F3F5` | （官方站暗色未覆写，建议 `#2E2E2E`～`#2B2B2B` 区间，**待核实**） |
| `--c-card-pad` | `#F7F8FA` | （同上，待核实） |
| `--c-fg` 主文本 | `#1D1D1F` | `#F5FAFF` |
| `--c-fg-sub` 次级文本 | `#6E6E73` | `#AEB6C2` |
| `--c-fg-mute` 弱化文本 | `#86868B` | `#8A8A8E` |
| `--c-acc` 强调色 | `#0071E3` | `#0A84FF` |
| `--c-acc-h` 强调色 hover | `#0A7CF0` | `#409CFF` |
| `--c-acc-tint` 强调色浅底 | `rgba(0,113,227,.1)` | `rgba(10,132,255,.1)` |
| `--c-line` 分隔线/描边 | `rgba(29,29,31,.08)` | `hsla(0,0%,100%,.1)` |

> 用户提到的「浅灰页面底 #F7F7F7 / 白色卡片」在官方体系中的对应值为 **`--c-tint:#F5F5F7`（页面浅灰底）+ `--c-surface:#FFFFFF`（白色卡片）**；#F7F7F7 未见官方使用，最近似官方值为 #F5F5F7 / #F7F8FA。

### 2.3 中性色阶（官方站点实际用色）
来源：同上 CSS 全量 HEX 提取

- **亮色中性阶**：`#FFFFFF` → `#FAFAFB` → `#F5F5F7` → `#F2F3F5` → `#F0F0F0` → `#E3E3E6` → `#E7E9EF` → `#EAEAEF` → `#E1E4EA` → `#F5F7FA` → `#FBFBFD`
- **暗色中性阶**：`#010101` → `#0A0A0A` → `#0E1015` → `#101513` → `#141519` → `#14161C` → `#171819` → `#191C24` → `#1D1D1F` → `#222222` → `#26282C` → `#2B2B2B` → `#2B2F3A` → `#2E2E2E`
- **文本灰阶**（亮）：`#85888D` `#929298` `#9A9AA0` `#9A9CA3` `#A5A7AD` `#6E6E73` `#86868B`；（暗）：`#AEB6C2` `#8A8A8E`

### 2.4 渐变体系（官方）
来源：https://hyperos.mi.com/_next/static/css/83f7d1c9a42a8835.css

**语义渐变令牌**：
| 令牌 | 亮色 | 暗色 |
|---|---|---|
| `--g-card-face` 卡片面 | `linear-gradient(165deg,#FBFBFD,#EAEAEF)` | `linear-gradient(165deg,#191C24,#0E1015)` |
| `--g-cover-face` 封面/大表面 | `linear-gradient(165deg,#F2F3F5,#E1E4EA)` | `linear-gradient(165deg,#26282C,#141519)` |
| 附加亮面渐变 | `linear-gradient(180deg,#FFF,#E7E9EF)` | `linear-gradient(160deg,#2B2F3A,#14161C)` |

**HyperOS 4 品牌渐变（官网签名渐变）**：
```
linear-gradient(90deg, #FE652E 0%, #E5AFED 50%, #3765FF 100%)
```
（橙 → 粉 → 蓝，对应「生命感美学」的光色语言）

### 2.5 功能色（官方调色板）
来源：https://hyperos.mi.com/_next/static/chunks/172-a1d28d539d157a49.js （Tailwind theme colors）

| 名称 | HEX |
|---|---|
| blue（主行动色/按钮） | `#0D84FF` |
| green | `#05C575` |
| yellow | `#FFA83F` |
| red | `#F22424` |
| dark | `#1D1D1F` |
| gray | `#F5F5F5` |

按钮状态色见 §6.1。

---

## 3. 形状与圆角（官方）

来源：https://hyperos.mi.com/_next/static/css/83f7d1c9a42a8835.css + chunks/172-a1d28d539d157a49.js

### 3.1 圆角标尺
| 令牌/类 | 值 | 用途 |
|---|---|---|
| `rounded-[6px]` | 6px | 小元素（标签、小按钮） |
| `rounded-[12px]` | 12px | 小卡片/输入框 |
| `rounded-[16px]` | 16px | 标准卡片 |
| `rounded-[20px]` | 20px | 官网卡片主力值 |
| `rounded-[22px]` | 22px | 官网卡片主力值 |
| `rounded-[24px]` | 24px | 大卡片 |
| `rounded-[30px]` / `.rounded-card` | 30px | **卡片专用令牌**（`.rounded-card{border-radius:30px}`） |
| `--responsive-border-radius` | 16px（移动端）/ 24px（≥tablet 810px） | **响应式默认圆角**（Tailwind `rounded` = var(--responsive-border-radius)） |
| `rounded-full` / 按钮 | **9999px**（按钮规范写 99999px） | **胶囊形按钮** |
| `50%` | 50% | 圆形图标按钮/头像 |
| `980px` | 980px | 超大全屏圆角容器 |

### 3.2 组件圆角速查
- **按钮：全胶囊（9999px）** ← HyperOS 标志性形状
- **图标按钮：圆形（50%）**，36×36px
- **卡片：`.rounded-card` = 30px**（移动端默认圆角 16px 由 `--responsive-border-radius` 控制，平板+ 24px）
- **底部弹层/浮层圆角：待核实**（官方站未直接暴露；建议按 30px 卡片令牌 + 顶部 30px 应用，待用真机截图核对）

---

## 4. 字体排印（MiSans）

### 4.1 MiSans 家族与字重（官方 10 字重）
来源：https://hyperos.mi.com/font （官网可变字重滑块数据）+ https://i02.appmifile.com/i18n/fonts/MiSansLatin/index.css

**MiSans 实际字重值（可变字体轴，官方滑块 150–700）**：

| # | 名称 | 字重值 | 标准 CSS 映射 |
|---|---|---|---|
| 1 | Thin | 150 | ~100 |
| 2 | ExtraLight | 200 | 200 |
| 3 | Light | 250 | 300 |
| 4 | Normal | 305 | ~350 |
| 5 | **Regular** | **330** | 400 |
| 6 | Medium | 380 | 500 |
| 7 | DemiBold | 450 | ~600 |
| 8 | SemiBold | 520 | 600 |
| 9 | Bold | 630 | 700 |
| 10 | Heavy | 700 | 900 |

- 官方 Webfont CSS 使用的标准映射：`100 / 300 / 400 / 500 / 700 / 900`（目录名 black=900、bold=700、medium=500、regular=400、light=300、thin=100）
- 可变字体：OpenType 1.8 规范，一个文件覆盖 150–700 全轴；MiSans L3（生僻字 GB18030-2022 三级，60,340 字符）仅 Regular 一字重
- 字库规模（https://hyperos.mi.com/font/download）：MiSans 29,608 字符/10 字重+VF/11 语言；MiSans TC 15,116；MiSans L3 60,340；Latin 1,350；Arabic 876；Devanagari 989；Thai 153；Lao 135；Myanmar 171；Khmer 339；Tibetan 1,944；Gurmukhi 693
- **字体家族名**：`MiSans`（中文）、`MiSans Latin`（西文，VF 名 `MiSans Latin VF`）、`MiSans TC`、`MiSans L3`；官方 fallback 栈：`"MiSans, system-ui, '微软雅黑', sans-serif"`
- OpenType 高级排版特性（官方）：等宽数字、汉字等高数字、小字面数字、数字上下标、单位小上/下标、数字专用标点、西文式标点、竖排标点、拨号盘专用符号、大写形态
- 许可：全球免费商用；须注明使用 MiSans；不得对字体文件二次开发/单独分发（https://hyperos.mi.com/font/download）
- 沿革：2016 小米兰亭（MIUI 8）→ 2019 兰亭Pro（10 字重、全球首家手机系统可变字体）→ 2021 MiSans（MIUI 13、免费商用）→ 2023 MiSans Global（HyperOS，20+ 书写系统、600+ 语言、10 万+ 字符）；合作方 Monotype（泰/老/印地等）、汉仪（繁体/阿拉伯/藏/缅/高棉）；获 Red Dot 2019、iF 2023、HiiiBrand 2023

### 4.2 官方字号层级（FIGMA_PRESETS，px 原始值）
来源：https://hyperos.mi.com/_next/static/chunks/172-a1d28d539d157a49.js

**移动端（Mobile）——组件库主参考**：

| 令牌 | 字号 | 行高 | 字重 |
|---|---|---|---|
| t1（超大展示） | 46px | 1.04 | 600 |
| h1 | 32px | 1.1 | 600 |
| h1_s | 32px | 1.1 | 600 |
| h2 | 28px | 1.18 | 600 |
| h3 | 22px | 1.18 | 600 |
| h4 | 20px | 1.15 | 600 |
| h5 | 19px | 1.15 | 600 |
| body | 17px | 1.5 | 400 |
| body_s | 14px | 140% | 400 |
| caption | 16px | 1.6 | 400 |
| caption_s | 14px | 1.55 | 400 |
| slidebar（侧栏/导航） | 16px | normal | 600 |
| publish | 24px | 32px | 500 |

**桌面端（Desktop）**：t1 84/1.04/600；h1 48/1.1/600；h1_s 40/1.1/600；h2 36/1.18/600；h3 28/1.18/600；h4 26/1.15/600；h5 22/1.15/600；h5_s 24/normal/500；slidebar 24/normal/600；body 20/1.5/400；body_s 18/normal/400；caption 16/1.6/400；caption_s 14/1.55/400；publish 36/normal/500

**平板端（Tablet）**：t1 60/1.04/600；h1 40/1.1/600；h1_s 36/1.1/600；h2 32/1.18/600；h3 25/1.18/600；h4 23/1.15/600；h5 20/1.15/600；body 18/1.5/400；caption 16/1.6/400；caption_s 14/1.55/400；slidebar 20/140%/600；publish 24/normal/500；body_s 16/normal/400

**简化 5 级规范（SPEC_PRESETS，MiSans Semibold/Regular 具名字重）**：

| 端 | h1 | h2 | h3 | body | caption |
|---|---|---|---|---|---|
| Mobile | 44/58 Semibold | 32/42 Semibold | 20/27 Regular | 16/26 Regular | 12/19 Regular |
| Tablet | 48/64 Semibold | 32/42 Semibold | 24/32 Regular | 16/26 Regular | 12/19 Regular |
| Desktop | 72/95 Semibold | 40/53 Semibold | 24/32 Regular | 20/30 Regular | 16/26 Regular |

**官网展示级特例字号**（同源代码）：h-hero 34px/1.08/-0.017em/600；hero-num 200px/0.82/-0.02em；hero-word 30px/-0.01em；hero-slogan 28px/normal/-0.02em/380

> 说明：官方站 HTML 根字号 `zh = 20px`、`en = 18px`（MiSans 官网 CSS）；Tailwind 基准 1rem = 16px。组件库建议：移动端正文 17px/1.5，标题 600 字重（DemiBold 450–SemiBold 520 区间）。

---

## 5. 间距与留白、网格系统

来源：https://hyperos.mi.com/_next/static/chunks/172-a1d28d539d157a49.js （spacing/safeArea/screens）

### 5.1 间距标尺
- **4px 基数制**：`n[4e] = 0.25e rem`，即 4/8/12/16/20/24/28/32/…/400px 全量 4px 步进（Tailwind spacing）
- 官网实际高频间距：`8 / 12 / 16 / 20 / 24 / 40 / 48 / 56 / 60 / 80 / 96px`（区块级）

### 5.2 安全区/页面边距（safeArea 令牌）
| 令牌 | Mobile | Tablet | Desktop | DesktopMax |
|---|---|---|---|---|
| safe-area | 8vw | 24px | 24px | 1252px |
| safe-area-extend | 24px | 72px | 24px | 1140px |
| safe-area-common | 24px | 48px | 94px | 1250px |

### 5.3 断点（screens）
`320 / 360 / 420 / 480 / 680 / 810(tablet) / 968(md) / 1150(lg) / 1200(desktop) / 1440(xl) / 1920(2xl)`

### 5.4 行长/网格
- MiSans 官网明确「通过人因研究定义字号规范、**行长、间距**」（https://hyperos.mi.com/font/about），但具体行长数值未在官网公开，**待核实**（建议参考 20–40 个西文字符的中文段落宽度惯例并结合真机核对）

---

## 6. 组件级设计特征

### 6.1 按钮（官方 button.btn 规范）
来源：https://hyperos.mi.com/_next/static/chunks/172-a1d28d539d157a49.js

```
button.btn {
  border-radius: 99999px;      /* 全胶囊 */
  font-weight: 450;            /* DemiBold 区间 */
  color: #fff;
  font-size: 1rem;             /* 16px（desktop 1.25rem=20px）*/
  padding: 0 1.5rem;           /* 左右 24px（desktop 0 2.25rem=36px）*/
  height: 2.75rem;             /* 44px（desktop 4rem=64px）*/
  background-color: #0D84FF;
  transition-duration/timing: 主题默认 330ms / cubic-bezier(0.25,0.46,0.45,0.94)
}
hover:   #4EA5FF
active:  #0B6FD6
disabled:#9ECEFF
```

**深色按钮 .btn-dark**：bg `#1D1D1F` → hover `#343435` → active `#000000` → disabled `#BBBBBC`

**图标按钮（官方 HTML 实例，https://hyperos.mi.com/）**：
- 常规：`36×36px`、`rounded-full`、`bg-black/[0.08]`、hover `bg-black/[0.14]`、disabled `opacity 0.32`
- 玻璃悬浮按钮（柔光玻璃实例）：
  ```
  h-40 w-40 rounded-full
  bg-black/[0.42]
  backdrop-blur: 8px; backdrop-saturate: 160%
  hover: bg-black/0.6
  transition: transform, background-color 200ms cubic-bezier(0.28,0.11,0.32,1)
  motion-reduce: transition-none
  ```

**按压反馈**：官方按钮使用 active 态深色（#0B6FD6）+ 330ms 标准过渡；玻璃按钮 200ms。系统级按压时长（约 100–150ms）**待核实**。

### 6.2 卡片
来源：https://hyperos.mi.com/_next/static/css/83f7d1c9a42a8835.css、chunks/app/page-38202d89cac90baa.js

- **圆角**：`.rounded-card` = **30px**（移动端默认圆角令牌 16px / 平板+ 24px）
- **样式**：白底无边框 + 渐变面双轨制——平面 `--c-card-mist #F2F3F5`（`bg-card-mist`）或柔光渐变面 `--g-card-face`（165deg #FBFBFD→#EAEAEF）
- **细边框/发丝线**：`inset 0 0 0 1px rgba(29,29,31,0.06)`；语义描边 `--c-line: rgba(29,29,31,.08)`（亮）/ `hsla(0,0%,100%,.1)`（暗）；亦见 `border-black/[0.04]`、`border-black/[0.08]`
- **浮起阴影**：`0 8px 30px rgba(0,0,0,0.1)`
- 官网卡片实例：`rounded-[20px] bg-white`、`rounded-[16px]`、`rounded-[24px]`

### 6.3 列表 / 开关 / 弹层 / 图标
- **列表 cell**：官方站以 safe-area（24px 左右边距）+ `--c-line` 发丝线分隔构成；cell 具体高度/内边距 **待核实**
- **开关、底部弹层圆角**：官方站未暴露系统级组件数值，**待核实**（建议：底部弹层顶部圆角按 30px 卡片令牌；开关按胶囊 9999px 轨道 + 圆形滑块）
- **图标风格**：官网图标按钮为圆形底 + 线性/填充图标混用；系统图标规范（圆角/填充/线性细则）**待核实**

### 6.4 动效（官方时长与缓动）
来源：https://hyperos.mi.com/_next/static/css/83f7d1c9a42a8835.css + chunks/172-a1d28d539d157a49.js

| 用途 | 时长 | 缓动 |
|---|---|---|
| **主题默认过渡** | **330ms** | **cubic-bezier(0.25, 0.46, 0.45, 0.94)** |
| 玻璃按钮（transform/background-color） | 200ms | cubic-bezier(0.28, 0.11, 0.32, 1) |
| 官网 Hero 元素渐显 | 2s（delay 1s） | linear/forwards |
| Hero 背景淡入 | 0.6s（delay 0.3s） | opacity |
| 其他官方缓动 | — | cubic-bezier(0.33,1,0.68,1)、cubic-bezier(0.61,1,0.88,1)、cubic-bezier(0.4,0,0.2,1)、cubic-bezier(0,0,0.2,1) |
| 无障碍 | — | `motion-reduce:transition-none`（尊重减少动效） |

- HyperOS 动效官方总纲：「100+ 系统级动画重新打磨，更流畅、无缝一致的视觉体验」（https://www.mi.com/global/hyperos）
- HyperOS 4 光效语言：「点按有光、拖拽有光」——交互即时光效反馈（https://hyperos.mi.com/）

---

## 7. 暗色模式

来源：https://hyperos.mi.com/_next/static/css/83f7d1c9a42a8835.css `.theme-dark`

- 页面底 `#222222`；表面/卡片 `#2E2E2E`；浅灰填充 `#2B2B2B`
- 主文本 `#F5FAFF`；次级 `#AEB6C2`；弱化 `#8A8A8E`
- 强调色 `#0A84FF`（hover `#409CFF`，浅底 `rgba(10,132,255,.1)`）
- 分隔线 `hsla(0,0%,100%,.1)`
- 卡片渐变面 `linear-gradient(165deg,#191C24,#0E1015)`；封面渐变 `linear-gradient(165deg,#26282C,#141519)`；附加深面 `linear-gradient(160deg,#2B2F3A,#14161C)`
- 官网 body 底色 `#000`（全黑舞台，内容区用上述深灰阶）
- 暗色下文本对比度均 ≥ 4.5:1（#F5FAFF on #222）

---

## 8. 组件库设计令牌速查表（建议落地）

```css
:root {
  /* 品牌 */
  --mi-orange: #FF6900;            /* rgb(255,105,0) 官方品牌橙 */
  --mi-orange-shop: #FF6700;       /* 商城行动色 */
  --hos-blue: #0D84FF;             /* HyperOS 按钮蓝 */
  --hos-green: #05C575; --hos-yellow: #FFA83F; --hos-red: #F22424;

  /* 语义色-亮 */
  --c-page:#FFFFFF; --c-surface:#FFFFFF; --c-tint:#F5F5F7;
  --c-card-mist:#F2F3F5; --c-card-pad:#F7F8FA;
  --c-fg:#1D1D1F; --c-fg-sub:#6E6E73; --c-fg-mute:#86868B;
  --c-acc:#0071E3; --c-acc-h:#0A7CF0; --c-acc-tint:rgba(0,113,227,.1);
  --c-line:rgba(29,29,31,.08);
  --g-card-face:linear-gradient(165deg,#FBFBFD,#EAEAEF);
  --g-cover-face:linear-gradient(165deg,#F2F3F5,#E1E4EA);
  --g-brand:linear-gradient(90deg,#FE652E 0%,#E5AFED 50%,#3765FF 100%);

  /* 圆角 */
  --radius-responsive:16px;        /* ≥810px: 24px */
  --radius-card:30px; --radius-pill:9999px;
  /* 字号(移动) */
  --text-t1:46px/1.04/600; --text-h1:32px/1.1/600; --text-h2:28px/1.18/600;
  --text-h3:22px/1.18/600; --text-h4:20px/1.15/600; --text-h5:19px/1.15/600;
  --text-body:17px/1.5/400; --text-body-s:14px/1.4/400;
  --text-caption:16px/1.6/400; --text-caption-s:14px/1.55/400;
  /* 间距 */ --space-base:4px; --pad-page:24px;
  /* 动效 */ --motion-duration:330ms;
  --motion-ease:cubic-bezier(0.25,0.46,0.45,0.94);
  --motion-ease-emphasized:cubic-bezier(0.28,0.11,0.32,1);
  /* 字体 */
  --font-mi:"MiSans","MiSans Latin",system-ui,"微软雅黑",sans-serif;
  --weight-regular:330; --weight-medium:380; --weight-demibold:450;
  --weight-semibold:520; --weight-bold:630; /* VF 轴 150–700 */
}
.theme-dark { /* 见 §7 暗色令牌 */ }
```

**按钮规格**：胶囊 9999px；高 44px（桌面 64px）；左右内边距 24px（桌面 36px）；字重 450；16px/20px；默认 #0D84FF / hover #4EA5FF / active #0B6FD6 / disabled #9ECEFF；深色变体 #1D1D1F/#343435/#000/#BBBBBC。

**图标按钮**：36×36 圆形，bg-black/0.08 → hover black/0.14；玻璃悬浮钮 40×40 圆形，bg-black/0.42 + backdrop-blur(8px) saturate(160%)，200ms cubic-bezier(0.28,0.11,0.32,1)。

**卡片**：圆角 30px；白底无边框或 `--g-card-face` 渐变面；发丝线 `inset 0 0 0 1px rgba(29,29,31,.06)`；浮起阴影 `0 8px 30px rgba(0,0,0,.1)`。

---

## 9. 待核实清单

1. **design.mi.com 规范站**（本次网络不可达）：HyperOS 官方规范原文、系统级组件（开关/弹层/cell）精确数值、图标风格细则。
2. **HyperOS 2「生命感美学 2.0」**设计正文（Wayback 存档仅捕获导航）——建议查「小米设计委员会」微信公众号 2024-10 前后文章。
3. 暗色模式 `--c-card-mist / --c-card-pad` 官方暗色值（官方站未覆写）。
4. 底部弹层圆角、列表 cell 高度、按压反馈时长（~100–150ms 为行业惯例推断）。
5. MiSans 官方「行长/行长宽」具体数值。
