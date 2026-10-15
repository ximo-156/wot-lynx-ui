# 苹果设计美学与设计灵感调研报告
## —— Apple HIG / iOS 设计语言设计令牌（Design Tokens）研究

> 用途：重构移动端组件库（wot-lynx-ui）设计令牌的数值依据。
> 调研方式：直接抓取 developer.apple.com 官方 Human Interface Guidelines 页面（Markdown/JSON 端点）与 UIKit 官方文档，辅以社区实测数据交叉验证。
> 抓取时间：2026 年（HIG 页面版权标注 2026，含 2025-06/2025-09/2025-12 三次 Liquid Glass 相关更新）。
>
> **来源可信度标注约定**：
> - 🟢 **官方** = Apple 官方文档/HIG 明确给出的数值
> - 🟡 **社区实测** = Apple 未公布、但社区广泛一致记录的数值（使用时建议真机复核）
> - 🔴 **待核实** = 本次未取得可靠来源，需二次核实

---

## 目录

1. [设计理念：从 Clarity / Deference / Depth 到 2026 八原则](#一设计理念)
2. [iOS 26 / Liquid Glass 新设计变化](#二ios-26--liquid-glass-新设计变化)
3. [色彩体系](#三色彩体系)
4. [字体排印](#四字体排印)
5. [形状与圆角](#五形状与圆角)
6. [间距与布局](#六间距与布局)
7. [组件级设计特征](#七组件级设计特征)
8. [材质与深度](#八材质与深度)
9. [动效](#九动效)
10. [暗色模式](#十暗色模式)
11. [可直接落地的设计令牌表](#十一可直接落地的设计令牌表)
12. [来源 URL 汇总与待核实清单](#十二来源-url-汇总与待核实清单)

---

## 一、设计理念

### 1.1 经典 iOS 三原则：Clarity（清晰）/ Deference（顺从）/ Depth（深度）

这是 iOS 7 引入、沿用至今的 iOS 设计语言内核。Apple 官方原文（2019 年存档版 iOS HIG "Design Themes"）：

> **Clarity.** Throughout the system, text is legible at every size, icons are precise and lucid, adornments are subtle and appropriate, and a sharpened focus on functionality motivates the design. Negative space, color, fonts, graphics, and interface elements subtly highlight important content and convey interactivity.
>
> **Deference.** Fluid motion and a crisp, beautiful interface help people understand and interact with content while never competing with it. Content typically fills the entire screen, while translucency and blurring often hint at more. **Minimal use of bezels, gradients, and drop shadows** keep the interface light and airy, while ensuring that content is paramount.
>
> **Depth.** Distinct visual layers and realistic motion convey hierarchy, impart vitality, and facilitate understanding. Touch and discoverability heighten delight and enable access to functionality and additional content without losing context.

来源：🟢 https://web.archive.org/web/20190601000000/https://developer.apple.com/design/human-interface-guidelines/ios/overview/themes/

同页还给出六条经典设计原则（Aesthetic Integrity 美学完整性 / Consistency 一致性 / Direct Manipulation 直接操纵 / Feedback 反馈 / Metaphors 隐喻 / User Control 用户控制）。

**对组件库的含义**：
- **克制美学** = 少用 bezels/gradients/drop shadows；内容优先，UI 退后（Deference）；层级靠"视觉层 + 真实动效"而非装饰线（Depth）。
- 清晰 = 每一号字号都可读；装饰微妙恰当；负空间、色彩、字体承担强调职责。

### 1.2 当前 HIG（2026）八原则

现行 HIG "Design principles" 页（2026-06-08 "Reintroduced design principles"）将原则重构为八条，每条含一句箴言：

| 原则 | 箴言 |
|---|---|
| Purpose 意图 | Make something meaningful |
| Agency 自主 | Let people do things their own way |
| Responsibility 责任 | Act in people's best interest |
| Familiarity 熟悉 | Build on what people know |
| Flexibility 灵活 | Adapt to diverse contexts and needs |
| Simplicity 简约 | Be clear and direct（"Simplicity isn't minimalism"——简约不是极简主义，只保留必要） |
| Craft 匠心 | Care about every detail |
| Delight 愉悦 | Make it human（"Don't mistake delight for decoration"——勿把愉悦误当装饰） |

来源：🟢 https://developer.apple.com/design/human-interface-guidelines/design-principles

### 1.3 iOS 平台特征（Designing for iOS）

- 单手/双手持握，视距约 1–2 英尺；控件放在屏幕中下部更易触达；支持滑动返回。
- 次要细节用最小交互暴露（progressive disclosure）。
- 无缝适配方向、暗色模式、Dynamic Type。
来源：🟢 https://developer.apple.com/design/human-interface-guidelines/designing-for-ios

---

## 二、iOS 26 / Liquid Glass 新设计变化

### 2.1 Liquid Glass 材质（2025-06 引入，2025-09/12 更新）

官方定义（HIG > Materials）：

> **Liquid Glass** is a dynamic material that unifies the design language across Apple platforms, allowing you to present controls and navigation without obscuring underlying content.
> Liquid Glass forms a **distinct functional layer** for controls and navigation elements — like tab bars and sidebars — that **floats above the content layer**, establishing a clear visual hierarchy between functional elements and content.

两个变体（官方）：

| 变体 | 行为 | 用途 |
|---|---|---|
| **regular** | 模糊并调节背景内容亮度以保可读性；scroll edge effect 进一步模糊并降低背景不透明度 | 大多数系统组件；文本多的元素（alerts、sidebars、popovers） |
| **clear** | 高度半透明，优先展示底层内容 | 浮于媒体（照片/视频）之上的组件 |

- 若 clear 变体下内容过亮，官方建议加 **35% 不透明度的暗色 dimming 层**（🟢）。
- Liquid Glass 默认**无固有颜色**，取自背后内容；可染色以强调（如主按钮）；小元素（toolbar/tab bar）上符号与文字默认**单色方案**（底色亮则深、暗则浅）。
- **不要**在内容层使用 Liquid Glass；滑块、开关这类瞬时交互控件在激活时会呈现 Liquid Glass 外观（官方例外）。
来源：🟢 https://developer.apple.com/design/human-interface-guidelines/materials

### 2.2 标准材质（standard materials）

iOS/iPadOS 保留四种标准材质：**ultraThin / thin / regular（默认）/ thick**，厚度越大越不透明、对比度越好。Vibrancy 层级：
- Label：`label`(默认) / `secondaryLabel` / `tertiaryLabel` / `quaternaryLabel`（避免在 thin/ultraThin 上用 quaternary）
- Fill：`fill`(默认) / `secondaryFill` / `tertiaryFill`
- Separator：单一默认值
来源：🟢 同上（materials#Standard-materials）

### 2.3 iOS 26 组件与形状变化（Adopting Liquid Glass 技术总览）

- 标准组件（bars、sheets、popovers、controls）**自动采用** Liquid Glass；应移除自定义背景/效果，让系统决定外观。
- **Sheets 圆角半径增大（increased corner radius）**；半高 sheet 从屏幕边缘内缩（half sheets are inset from the edge）。🟢（官方定性描述，未给具体 pt 值 → 具体值见 §5.4）
- **Windows 圆角变大**以容纳控件与导航元素。
- 控件焕新：slider/toggle 的旋钮在交互时变为 Liquid Glass；按钮获得 Liquid Glass 配置（`.glass()` / `.prominentGlass()` / `.clearGlass()` / `.prominentClearGlass()`）。🟢 https://developer.apple.com/documentation/uikit/uibutton/configuration-swift.struct
- App Icon 改为多层、系统自动施加反射/折射/阴影/模糊/高光；提供 default/dark/clear/tinted 外观变体。
- 新增 `UIView.cornerConfiguration`（`UICornerConfiguration`，iOS 26+），见 §5.2。
来源：🟢 https://developer.apple.com/documentation/technologyoverviews/adopting-liquid-glass

---

## 三、色彩体系

### 3.0 总则（官方）

- **避免硬编码系统色值**："Documented color values are for your reference during the app design process. The actual color values may fluctuate from release to release." 🟢（HIG Color）
- 语义色按用途而非外观定义；**不要**把 separator 当文字色、secondaryLabel 当背景色。
- 对比度最低 4.5:1；自定义前景/背景力争 7:1（尤其小字）。🟢（HIG Dark Mode）

### 3.1 系统色（SwiftUI 统一色值，2025-06-09 官方更新）

HIG "Color > Specifications > System colors"（注意：这是 **SwiftUI `Color`** 的值，2025 年统一过；与下方 UIKit 传统值略有差异）：

| 名称 | Light | Dark | Increased Contrast Light | Increased Contrast Dark |
|---|---|---|---|---|
| Red | #FF383C | #FF4245 | #E9152D | #FF6165 |
| Orange | #FF8D28 | #FF9230 | #C55300 | #FFA056 |
| Yellow | #FFCC00 | #FFD600 | #A16A00 | #FEDF43 |
| Green | #34C759 | #30D158 | #008932 | #4AD968 |
| Mint | #00C8B3 | #00DAC3 | #008575 | #54DFCB |
| Teal | #00C3D0 | #00D2E0 | #008198 | #3BDDEC |
| Cyan | #00C0E8 | #3CD3FE | #007EAE | #6DD9FF |
| Blue | #0088FF | #0091FF | #1E6EF4 | #5CB8FF |
| Indigo | #6155F5 | #6D7CFF | #564ADE | #A7AAFF |
| Purple | #CB30E0 | #DB34F2 | #B02FC2 | #EA8DFF |
| Pink | #FF2D55 | #FF375F | #E7124D | #FF8AC4 |
| Brown | #AC7F5E | #B78A66 | #956D51 | #DBA679 |

来源：🟢 https://developer.apple.com/design/human-interface-guidelines/color（Change log: "June 9, 2025 Updated system color values"）

### 3.2 UIKit 传统系统色（UIColor.system*，至今仍为 iOS 控件默认）

| 名称 | Light | Dark |
|---|---|---|
| systemBlue | **#007AFF** | **#0A84FF** |
| systemGreen | #34C759 | #30D158 |
| systemIndigo | #5856D6 | #5E5CE6 |
| systemOrange | #FF9500 | #FF9F0A |
| systemPink | #FF2D55 | #FF375F |
| systemPurple | #AF52DE | #BF5AF2 |
| systemRed | #FF3B30 | #FF453A |
| systemTeal | #5AC8FA | #64D2FF |
| systemYellow | #FFCC00 | #FFD60A |

来源：🟡 https://sarunw.com/posts/dark-color-cheat-sheet/（社区权威 cheat sheet，与 HIG 官方灰阶表完全吻合）

### 3.3 系统灰阶（官方 HIG，UIKit）

| 名称 | Light | Dark | 高对比 Light | 高对比 Dark |
|---|---|---|---|---|
| systemGray | #8E8E93 | #8E8E93 | #6C6C70 | #AEAEB2 |
| systemGray2 | #AEAEB2 | #636366 | #8E8E93 | #7C7C80 |
| systemGray3 | #C7C7CC | #48484A | #AEAEB2 | #545456 |
| systemGray4 | #D1D1D6 | #3A3A3C | #BCBCC0 | #444446 |
| systemGray5 | #E5E5EA | #2C2C2E | #D8D8DC | #363638 |
| systemGray6 | #F2F2F7 | #1C1C1E | #EBEBF0 | #242426 |

来源：🟢 HIG Color 页（iOS, iPadOS system gray colors 表）

### 3.4 语义文字色（Label 四级）

| 语义色 | Light | Dark |
|---|---|---|
| label（主） | #000000 | #FFFFFF |
| secondaryLabel | #3C3C43 @ 60%（#3C3C4399） | #EBEBF5 @ 60%（#EBEBF599） |
| tertiaryLabel | #3C3C43 @ 30%（#3C3C434D） | #EBEBF5 @ 30%（#EBEBF54D） |
| quaternaryLabel | #3C3C43 @ 18%（#3C3C432E） | #EBEBF5 @ 18%（#EBEBF52E） |
| placeholderText | 同 tertiaryLabel | 同 tertiaryLabel |

来源：🟡 https://sarunw.com/posts/dark-color-cheat-sheet/（与 Apple 官方语义定义一致；HIG 只定义用途不给值）

### 3.5 背景色（两级 hierarchy + Dark Mode 升降级）

| 语义色 | Light | Dark |
|---|---|---|
| systemBackground | #FFFFFF | #000000 |
| secondarySystemBackground | #F2F2F7 | #1C1C1E |
| tertiarySystemBackground | #FFFFFF | #2C2C2E |
| systemGroupedBackground | #F2F2F7 | #000000 |
| secondarySystemGroupedBackground | #FFFFFF | #1C1C1E |
| tertiarySystemGroupedBackground | #F2F2F7 | #2C2C2E |

使用规则（🟢 HIG Color）：Primary=整体视图；Secondary=视图内分组；Tertiary=二级分组内的分组。grouped 组用于 grouped table view，否则用 system 组。

### 3.6 分隔线与填充色

| 语义色 | Light | Dark |
|---|---|---|
| separator（允许透出背景） | #3C3C43 @ 29%（#3C3C434A） | #545458 @ 60%（#54545899） |
| opaqueSeparator（不透出） | #C6C6C8 | #38383A |
| link | systemBlue | systemBlue |

来源：🟡 sarunw cheat sheet

**填充色 systemFill 1–4**（🔴 待核实，社区记录值，建议用 iOS 真机/调试器取色复核）：

| 语义色 | Light | Dark |
|---|---|---|
| systemFill | #787880 @ 20% | #787880 @ 36% |
| secondarySystemFill | #787880 @ 16% | #787880 @ 32% |
| tertiarySystemFill | #787880 @ 12% | #787880 @ 24% |
| quaternarySystemFill | #787880 @ 8% | #787880 @ 18% |

### 3.7 tint 浅色底（15% 透明度）做法

- iOS 15+ **tinted 按钮**：背景 = tint 色 @ 15%（如 systemBlue 15% 叠白底 ≈ #E5F0FF），文字 = tint 色。这是 Apple "以低透明度品牌/主题色做浅色底"的标准手法。🟡（UIKit `UIButton.Configuration.tinted()` 语义为官方；15% 为社区实测值，🔴 建议复核）
- SwiftUI 中对应 `.buttonStyle(.bordered)` + `.tint(_:)`。
- 组件库落地建议：定义 `*-tint` 令牌 = 主色 @ 15%，hover = 主色 @ 20–25%，pressed = 主色 @ 30%。

---

## 四、字体排印

### 4.1 字体家族

- **SF Pro**：iOS/iPadOS/macOS/tvOS/visionOS 系统字体（SF Compact 用于 watchOS；另有 SF Arabic/Armenian/Georgian/Hebrew/Mono 与 Rounded 变体）。🟢
- **New York (NY)**：衬线家族，可与 SF 搭配。🟢
- **PingFang SC（苹方）**：Apple 为中文提供的系统字体（iOS 9 / OS X El Capitan 起随系统提供，**不在 HIG Typography 页与字体下载页中**）。Web/跨端落地时：`font-family: -apple-system, "SF Pro Text", "SF Pro Display", "PingFang SC", "Helvetica Neue", sans-serif`；中文场景 PingFang SC 与 SF Pro 混排时注意 baseline 对齐。🟡
- 系统字体为**可变字体**，支持动态光学尺寸（dynamic optical sizes）与 Ultralight→Black 全字重；**避免 Ultralight/Thin/Light**（可读性差）。🟢
- 默认正文字号 **17pt**，最小 **11pt**（iOS/iPadOS）。🟢

### 4.2 字号层级（Dynamic Type，默认 Large 档，官方 HIG 表）

| 文本样式 | 字重 | 字号 | 行高 (Leading) | 强调字重 |
|---|---|---|---|---|
| Large Title | Regular | **34pt** | 41pt | Bold |
| Title 1 | Regular | **28pt** | 34pt | Bold |
| Title 2 | Regular | **22pt** | 28pt | Bold |
| Title 3 | Regular | **20pt** | 25pt | Semibold |
| Headline | **Semibold** | **17pt** | 22pt | Semibold |
| Body | Regular | **17pt** | 22pt | Semibold |
| Callout | Regular | **16pt** | 21pt | Semibold |
| Subhead | Regular | **15pt** | 20pt | Semibold |
| Footnote | Regular | **13pt** | 18pt | Semibold |
| Caption 1 | Regular | **12pt** | 16pt | Semibold |
| Caption 2 | Regular | **11pt** | 13pt | Semibold |

来源：🟢 https://developer.apple.com/design/human-interface-guidelines/typography（"iOS, iPadOS Dynamic Type sizes — Large (default)"）

> 注意：Footnotes 行高现行官方值为 **18pt**（旧资料常记为 16pt）；Caption2 行高 13pt。
> 其他档位（xSmall→xxxLarge、AX1–AX5）同页可查，例如 xSmall：Large Title 31/38、Body 14/19；AX5：Large Title 53/56.5、Body 31/34.5 等。

### 4.3 字距 Tracking（SF Pro，官方 HIG 表）

| 字号 | Tracking (1/1000 em) | Tracking (pt) |
|---|---|---|
| 11pt | +6 | +0.06 |
| 12pt | 0 | 0.00 |
| 13pt | −6 | −0.08 |
| 15pt | −16 | −0.23 |
| 16pt | −20 | −0.31 |
| 17pt | −26 | −0.43 |
| 20pt | −23 | −0.45 |
| 22pt | −12 | −0.26 |
| 28pt | +14 | +0.38 |
| 34pt | +12 | +0.40 |

规律：小字号（<12pt）加宽、12pt 归零、13–20pt 收紧、≥24pt 重新加宽（Display 光学尺寸）。
来源：🟢 HIG Typography > Tracking values（SF Pro 全量表 6–96pt 同页）

### 4.4 Dynamic Type

- 文本样式随系统字号设置**等比缩放**；组件需保证大字号下不裁切、可换行（HIG Layout 明确要求）。
- 按钮等控件可用 symbolic traits（Bold）或调整 leading（loose/tight）应对。
来源：🟢 HIG Typography / Layout

---

## 五、形状与圆角

### 5.1 连续圆角（Continuous Corner / 超椭圆 squircle）

- **概念**：Apple 硬件与 UI 使用"连续曲率"圆角（曲率从圆角到直边平滑过渡，视觉上比等半径圆弧更柔和饱满），社区常称超椭圆/squircle。
- **官方 API**：`CALayer.cornerCurve = .continuous`（iOS 13+，另有 `.circular`）。🟢 https://developer.apple.com/documentation/quartzcore/calayercornercurve
- Web/跨端近似：`border-radius` 无法完美复现 squircle；可用较大半径 + 轻微 `corner-shape`/SVG path 近似，或接受等半径圆角并在视觉规范中注明"连续圆角"。

### 5.2 iOS 26 同心圆角（Concentric Corners）

- 新增 `UIView.cornerConfiguration`（`UICornerConfiguration`，iOS 26+），三种圆角类型：**squared / rounded / rounded-and-concentric-to-container / capsule**。🟢
- API：`.fixed(_:)`（固定半径）、`.containerConcentric(minimum:)`（相对容器同心）、`.capsule(maximumRadius:)`（胶囊）。🟢 https://developer.apple.com/documentation/uikit/uicornerconfiguration-swift.struct
- SwiftUI 对应：`ContainerRelativeShape`（iOS 14+，取容器形状的内缩版本）与 `.rect(corners:isUniform:)`。🟢
- **含义**：嵌套容器（卡片内的按钮、sheet 内的 cell）圆角应"同心"——内层半径 = 外层半径 − 内边距，保持视觉连续。

### 5.3 按钮圆角（胶囊形）

- visionOS 官方指南："In general, prefer circular or capsule-shape buttons… When you need to display a button by itself, prefer a capsule-shape button." watchOS 所有 inline 按钮均用 capsule。🟢
- UIKit 按钮 `UIButton.Configuration.CornerStyle` 官方枚举：**`capsule` / `large` / `medium` / `small` / `fixed` / `dynamic`**（iOS 26 起 large/medium/small 为系统定义档位）。🟢
- iOS 15+ 起系统按钮普遍采用胶囊/大圆角连续圆角趋势（App Store"获取"按钮 = 胶囊，高 28pt、半径 14pt）🟡。

### 5.4 卡片与弹层圆角

| 元素 | 圆角 | 可信度 |
|---|---|---|
| 卡片（自定义内容容器） | **10pt**（紧凑卡片）/ **16pt**（大卡片/分组卡片） | 🟡 社区约定（Apple Design Resources 传统值） |
| Sheet（iOS 15–18 卡片式弹层） | **10pt** | 🟡 社区实测 |
| Sheet（iOS 26+ Liquid Glass） | **明显增大**（官方定性 "increased corner radius"；社区目测 ≈ 26pt 量级） | 🟢 定性 / 🔴 具体值待核实 |
| Action Sheet（底部动作面板） | 10pt | 🟡 |
| Alert（居中警告框） | ≈ **14pt** | 🟡 待核实 |
| 半高 sheet（iOS 26） | 从屏幕边缘**内缩**（非全宽） | 🟢 官方定性 |
| grabber（sheet 顶部横条） | 宽 ≈ 36pt、高 5pt、全圆角 | 🟡 待核实 |

**落地建议**：令牌化 `radius.sm=8 / md=10 / lg=16 / xl=26(iOS26 sheet) / full=9999(胶囊)`，嵌套场景用同心规则推导。

---

## 六、间距与布局

| 项目 | 数值 | 可信度 | 说明 |
|---|---|---|---|
| 最小点击热区 | **44 × 44 pt**（visionOS 60×60） | 🟢 官方 | HIG Buttons："a button needs a hit region of at least 44x44 pt" |
| 标准屏幕边距 | **16pt** | 🟡 | layoutMargins 标准值（社区约定，源自 Apple Design Resources） |
| 8pt 网格 | 基准间距 8pt 及其倍数 | 🟡 | 现行 HIG 未明文写出；社区从 Apple 模板归纳 |
| 列表 cell 高度 | **44pt**（单行标准行高） | 🟡 | UIKit 传统默认行高（现默认为 self-sizing，但 44pt 仍是系统列表实际行高） |
| 列表文字左边距 | 16pt（cell 内） | 🟡 | |
| Inset grouped 列表 separator 缩进 | leading **16pt**（与文字对齐） | 🟡 | |
| 带头像的 cell separator 缩进 | leading **60pt**（与文字对齐：16 边距 + 29 图标 + 15 间距） | 🟡 | |
| 分组间距 | section 间距 ≈ 24pt（inset grouped） | 🟡 | |
| 控件间距 | 相关控件成组间距 8pt；组间 16–24pt | 🟡 | |

布局原则（🟢 HIG Layout）：按重要性排序、对齐、用缩进表达层级、用负空间/容器/分隔线分组、渐进式披露、内容延伸到 bar 之下、尊重 safe area 与 layout guide。

---

## 七、组件级设计特征

### 7.1 按钮（Button）

**官方四样式**（`UIButton.Configuration`，iOS 15+）🟢：

| 样式 | 官方语义 | 背景（浅色） | 背景（深色） | 文字 | 高度 |
|---|---|---|---|---|---|
| `.filled()` | 以 tint 色填充 | systemBlue **#007AFF** | #0A84FF | 白色 | large **50pt** |
| `.tinted()` | tint 色浅色底 | #007AFF @ **15%**（≈#E5F0FF） | #0A84FF @ 15% | tint 色 | large 50pt |
| `.gray()` | 中性灰底 | #787880 @ 20%（≈#E3E3E8） | #787880 @ 36% | label | large 50pt |
| `.plain()` | 透明背景 | 透明 | 透明 | tint 色 | 自适应 |

> 色值与高度为 🟡 社区实测（UIKit 系统实现）；Apple 官方仅定义样式语义与 `Size`（mini/small/medium/large）、`CornerStyle`（capsule/large/medium/small/fixed/dynamic）。小/中尺寸高度社区记录约 **28pt / 32pt**。
> iOS 26 新增 `.glass()` / `.prominentGlass()` / `.clearGlass()` / `.prominentClearGlass()`（Liquid Glass 风格）🟢。

**角色（Role）**🟢：normal / **primary**（用 app accent 色，Return 键默认响应）/ **cancel** / **destructive**（系统红）；不要把 primary 给破坏性操作；每视图 prominent 按钮不超过 1–2 个。

**其他官方要点**：必须有 press state；同组按钮用样式而非大小区分主次；标题用 Title-style 首字母大写、动词开头；可内嵌 activity indicator。

### 7.2 列表（Lists / Tables）

- 标准行高 **44pt**（🟡）；选中态：导航型表格持续高亮当前行，选项型表格短暂高亮 + checkmark。🟢（HIG Lists）
- **Disclosure Indicator（chevron 箭头）**用于进入子视图；**info button（detail disclosure）**仅揭示详情、不导航。🟢
- 分隔线：`separator`（可透出背景）/ `opaqueSeparator`；缩进 16pt（普通）/ 60pt（带头像）。🟡
- 编辑模式下才能多选（iOS）。🟢
- 样式：plain / grouped / **inset grouped**（iOS 13+，组距屏幕边缘 16pt）。🟢

### 7.3 开关（Switch / Toggles）

- 尺寸 **51 × 31 pt**（🟡 社区实测）；开启 = tint 色（默认 systemBlue），thumb 白色。
- iOS 26 / 新 HIG：分组表单中可用 **mini switch**（高度与按钮等其他控件一致，保持行高统一）。🟢
- 交互时 knob 变为 Liquid Glass 外观。🟢
来源：🟢 https://developer.apple.com/design/human-interface-guidelines/toggles

### 7.4 滑块（Slider）

- 最小在 leading、最大在 trailing（水平）；底部最小、顶部最大（垂直）。🟢
- 已填充轨道 = tint 色；可配左右图标；不要用 slider 调音量（用 MPVolumeView）。🟢
- 尺寸：总高 ≈ **28pt**（触摸区），轨道高 ≈ 4pt，thumb ≈ 27pt（🟡 待核实）。
来源：🟢 https://developer.apple.com/design/human-interface-guidelines/sliders

### 7.5 分段控件（Segmented Control）

- 各段等宽；可含文字或图片；iOS 13+ 高度 **32pt**、选中段为白色/浮起小卡片（🟡 待核实）。
- 增删段时可滑动+淡入淡出动画。🟢
来源：🟢 https://developer.apple.com/design/human-interface-guidelines/segmented-controls

### 7.6 弹层（Sheets / Alerts / Action Sheets）

- **Sheet**：detents 停靠点；系统定义 **large**（全展开）与 **medium**（约全高一半）；可自定义 detent；顶部 **grabber** 可拖动/点击循环 detent；`largestUndimmedDetentIdentifier` 控制背景变暗。🟢 https://developer.apple.com/design/human-interface-guidelines/sheets
- **Alert**：宽度 ≈ **270pt**（🟡 社区实测）；按钮角色同 §7.1；visionOS alert accessory view 最大高 154pt、圆角 16pt（🟢 官方，仅 visionOS）。
- **Action Sheet**：底部面板； destructive 动作用红色。🟢
- **Toast**：HIG 无独立 Toast 页；Apple 生态对应模式为 in-app notification / activity indicator in button；建议按 Alert 色彩规则（白底/深色底 + 16pt 圆角 + label 文字）实现。🟡

---

## 八、材质与深度

### 8.1 半透明与 Vibrancy

- 材质定义（🟢 HIG Materials）："A material is a visual effect that creates a sense of depth, layering, and hierarchy between foreground and background elements."
- 材质上必须用 **vibrant 颜色**保证可读性（label/fill/separator 各级 vibrancy）。
- 厚材质对比好但挡内容；薄材质保留上下文。按语义选材质，不按颜色选。
- Liquid Glass：见 §2。clear 变体 + 亮背景时加 **35% 不透明度暗色 dimming**。🟢

### 8.2 阴影

- 现行 HIG **无独立 Shadows 数值页**（2026 年版已合并/移除，本次抓取 `/shadows.md` 返回 404）。
- 官方定性：Deference 原则要求 "minimal use of drop shadows"；阴影用于表达真实层级（visionOS 有 virtual light source 概念）。
- 社区常用阴影参数（🔴 待核实，建议以 Apple Design Resources 为准）：
  - 卡片（浅色模式）：`0 1pt 2pt rgba(0,0,0,0.10)`，大浮层 `0 8pt 24pt rgba(0,0,0,0.12)`
  - 深色模式阴影应更重（黑底上阴影不可见，改用亮度/描边表达层级——这正是 Dark Mode 的 **base/elevated 双层海拔系统**的动机，🟢）。

### 8.3 深度层级（Dark Mode 海拔）

- 暗色下系统用 **base（更暗，后退）/ elevated（更亮，前进）** 两组背景色；弹层/模态自动切换为 elevated。🟢（HIG Dark Mode）

---

## 九、动效

### 9.1 官方原则（HIG Motion，均为定性）

- 动效要有目的、不喧宾夺主；**简洁精确**（brief and precise）；可被取消（不要让人等动画完才能操作）。
- 系统组件已内建微妙动效；自定义控件务必加 press state。
- Liquid Glass 动效响应直接触摸（更强触感），触控板交互时更克制。
- 游戏保持 30–60fps；避免约 **0.2Hz** 的持续振荡（易致不适）。
来源：🟢 https://developer.apple.com/design/human-interface-guidelines/motion

### 9.2 时长与缓动（可落地值）

| 项目 | 数值 | 可信度 |
|---|---|---|
| 微交互（按压、选中、开关） | **0.2–0.25s** | 🟡 社区约定 |
| 标准过渡（推/弹导航、sheet 弹出） | **0.3–0.35s** | 🟡 |
| 模态/全屏过渡 | 0.35–0.4s | 🟡 |
| SwiftUI `Spring(duration: 0.5, bounce: 0.3)` | mass 1.0 / stiffness 157.9 / damping 17.6（官方换算示例） | 🟢 |
| SwiftUI `Spring(mass: 1, stiffness: 100, damping: 10)` | duration 0.63 / bounce 0.5（官方换算示例） | 🟢 |
| 系统缓动曲线 | `kCAMediaTimingFunctionEaseInEaseOut`（cubic-bezier(0.42, 0, 0.58, 1)）；`Default`（cubic-bezier(0.25, 0.1, 0.25, 1)） | 🟡 Core Animation 标准常量 |
| 弹簧交互（跟手） | SwiftUI `interactiveSpring`（保留速度、可中断） | 🟢 |

来源：🟢 https://developer.apple.com/documentation/swiftui/spring ；🟢 https://developer.apple.com/documentation/quartzcore/camediatimingfunction

**CSS 落地建议**：
```css
--ease-in-out: cubic-bezier(0.42, 0, 0.58, 1);   /* Apple EaseInEaseOut */
--ease-default: cubic-bezier(0.25, 0.1, 0.25, 1); /* CAMediaTimingFunctionDefault */
--dur-fast: 0.2s; --dur-base: 0.3s; --dur-slow: 0.35s;
/* 弹簧近似（stiffness 157.9 / damping 17.6 / mass 1）≈ CSS linear() 或 @property 逐帧插值 */
```

---

## 十、暗色模式

### 10.1 官方原则

- 暗色不是亮色的反转（"these colors aren't necessarily inversions of their light counterparts"）。🟢
- 两层海拔：base / elevated；弹层自动 elevated。🟢
- 前景更亮、背景更暗；用系统语义色自动适配；对比度 ≥ 4.5:1。🟢
- Reduce Transparency / Increase Contrast 会改变材质外观，需测试。🟢
来源：🟢 https://developer.apple.com/design/human-interface-guidelines/dark-mode

### 10.2 暗色具体色值速查

| 语义 | Dark 值 |
|---|---|
| systemBackground / systemGroupedBackground | **#000000** |
| secondarySystemBackground / secondarySystemGroupedBackground | **#1C1C1E** |
| tertiarySystemBackground / tertiarySystemGroupedBackground | **#2C2C2E** |
| label | #FFFFFF |
| secondaryLabel | #EBEBF5 @ 60% |
| tertiaryLabel / placeholder | #EBEBF5 @ 30% |
| quaternaryLabel | #EBEBF5 @ 18% |
| separator | #545458 @ 60% |
| opaqueSeparator | #38383A |
| systemBlue / Green / Indigo / Orange / Pink / Purple / Red / Teal / Yellow | #0A84FF / #30D158 / #5E5CE6 / #FF9F0A / #FF375F / #BF5AF2 / #FF453A / #64D2FF / #FFD60A |
| systemGray(2–6) | #8E8E93 / #636366 / #48484A / #3A3A3C / #2C2C2E / #1C1C1E |

（完整亮/暗对照见 §3；灰阶与文字/背景色值交叉验证自 HIG 官方表与 sarunw cheat sheet）

---

## 十一、可直接落地的设计令牌表

```css
:root {
  /* ===== Color: Light ===== */
  --blue:        #007AFF;  /* systemBlue */
  --green:       #34C759;
  --indigo:      #5856D6;
  --orange:      #FF9500;
  --pink:        #FF2D55;
  --purple:      #AF52DE;
  --red:         #FF3B30;
  --teal:        #5AC8FA;
  --yellow:      #FFCC00;
  --gray:        #8E8E93;  --gray-2: #AEAEB2;  --gray-3: #C7C7CC;
  --gray-4:      #D1D1D6;  --gray-5: #E5E5EA;  --gray-6: #F2F2F7;

  --label:       #000000;
  --label-2:     rgba(60,60,67,.60);   /* #3C3C43 60% */
  --label-3:     rgba(60,60,67,.30);
  --label-4:     rgba(60,60,67,.18);
  --separator:   rgba(60,60,67,.29);   /* #3C3C43 29% */
  --bg:          #FFFFFF;  --bg-2: #F2F2F7;  --bg-3: #FFFFFF;   /* system set */
  --bg-grouped:  #F2F2F7;  --bg-grouped-2: #FFFFFF;  --bg-grouped-3: #F2F2F7;
  --fill-1:      rgba(120,120,128,.20); /* 🔴 待核实 */
  --tint-bg:     rgba(0,122,255,.15);   /* tinted 浅色底（15%） */

  /* ===== Typography ===== */
  --font: -apple-system, "SF Pro Text", "SF Pro Display", "PingFang SC", "Helvetica Neue", sans-serif;
  --text-large-title: 34px/41px;  --track-large-title: +0.40px;
  --text-title-1: 28px/34px;      --track-title-1: +0.38px;
  --text-title-2: 22px/28px;      --track-title-2: -0.26px;
  --text-title-3: 20px/25px;      --track-title-3: -0.45px;
  --text-headline: 600 17px/22px; --track-headline: -0.43px;
  --text-body: 17px/22px;         --track-body: -0.43px;
  --text-callout: 16px/21px;      --track-callout: -0.31px;
  --text-subhead: 15px/20px;      --track-subhead: -0.23px;
  --text-footnote: 13px/18px;     --track-footnote: -0.08px;
  --text-caption-1: 12px/16px;    --track-caption-1: 0px;
  --text-caption-2: 11px/13px;    --track-caption-2: +0.06px;

  /* ===== Radius（连续圆角语义）===== */
  --radius-sm: 8px;  --radius-md: 10px;  --radius-lg: 16px;  --radius-xl: 26px; /* iOS26 sheet */
  --radius-capsule: 9999px;

  /* ===== Spacing / Layout ===== */
  --space-1: 4px;  --space-2: 8px;  --space-3: 12px;  --space-4: 16px;
  --space-6: 24px; --space-8: 32px;
  --margin-screen: 16px;   /* 标准边距 */
  --row-height: 44px;      /* 列表行高 */
  --hit-area: 44px;        /* 最小热区 🟢官方 */
  --separator-inset: 16px; --separator-inset-icon: 60px;

  /* ===== Motion ===== */
  --dur-fast: .2s;  --dur-base: .3s;  --dur-slow: .35s;
  --ease-in-out: cubic-bezier(.42,0,.58,1);
  --ease-default: cubic-bezier(.25,.1,.25,1);
}

/* Dark Mode：仅覆盖语义色（base/elevated 海拔） */
.dark {
  --blue:#0A84FF; --green:#30D158; --indigo:#5E5CE6; --orange:#FF9F0A; --pink:#FF375F;
  --purple:#BF5AF2; --red:#FF453A; --teal:#64D2FF; --yellow:#FFD60A;
  --gray:#8E8E93; --gray-2:#636366; --gray-3:#48484A; --gray-4:#3A3A3C; --gray-5:#2C2C2E; --gray-6:#1C1C1E;
  --label:#FFFFFF; --label-2:rgba(235,235,245,.60); --label-3:rgba(235,235,245,.30); --label-4:rgba(235,235,245,.18);
  --separator:rgba(84,84,88,.60);
  --bg:#000000; --bg-2:#1C1C1E; --bg-3:#2C2C2E;
  --bg-grouped:#000000; --bg-grouped-2:#1C1C1E; --bg-grouped-3:#2C2C2E;
  --fill-1:rgba(120,120,128,.36); /* 🔴 待核实 */
  --tint-bg:rgba(10,132,255,.15);
}
```

**按钮四样式映射**：

| 令牌 | 样式 | 背景 | 文字 | 高度 | 圆角 |
|---|---|---|---|---|---|
| `.btn-filled` | filled | `--blue`（tint） | #FFF | 50px | 连续圆角（大）/胶囊 |
| `.btn-tinted` | tinted | `--tint-bg`（15%） | `--blue` | 50px | 同上 |
| `.btn-gray` | gray | `--fill-1` | `--label` | 50px | 同上 |
| `.btn-plain` | plain | transparent | `--blue` | 自适应 | — |

---

## 十二、来源 URL 汇总与待核实清单

### 官方来源（🟢）

| 内容 | URL |
|---|---|
| 设计原则（2026 八原则） | https://developer.apple.com/design/human-interface-guidelines/design-principles |
| iOS 经典三原则（Clarity/Deference/Depth，存档） | https://web.archive.org/web/20190601000000/https://developer.apple.com/design/human-interface-guidelines/ios/overview/themes/ |
| Designing for iOS | https://developer.apple.com/design/human-interface-guidelines/designing-for-ios |
| Color（系统色/灰阶/语义色规格） | https://developer.apple.com/design/human-interface-guidelines/color |
| Typography（字号层级 + tracking + Dynamic Type） | https://developer.apple.com/design/human-interface-guidelines/typography |
| Layout | https://developer.apple.com/design/human-interface-guidelines/layout |
| Materials（Liquid Glass / vibrancy / 标准材质） | https://developer.apple.com/design/human-interface-guidelines/materials |
| Motion | https://developer.apple.com/design/human-interface-guidelines/motion |
| Dark Mode | https://developer.apple.com/design/human-interface-guidelines/dark-mode |
| Buttons | https://developer.apple.com/design/human-interface-guidelines/buttons |
| Lists and tables | https://developer.apple.com/design/human-interface-guidelines/lists-and-tables |
| Toggles（开关/mini switch） | https://developer.apple.com/design/human-interface-guidelines/toggles |
| Sheets（detents/grabber） | https://developer.apple.com/design/human-interface-guidelines/sheets |
| Action sheets | https://developer.apple.com/design/human-interface-guidelines/action-sheets |
| Sliders | https://developer.apple.com/design/human-interface-guidelines/sliders |
| Segmented controls | https://developer.apple.com/design/human-interface-guidelines/segmented-controls |
| Alerts | https://developer.apple.com/design/human-interface-guidelines/alerts |
| Disclosure controls | https://developer.apple.com/design/human-interface-guidelines/disclosure-controls |
| Adopting Liquid Glass（技术总览） | https://developer.apple.com/documentation/technologyoverviews/adopting-liquid-glass |
| UIButton.Configuration（四样式/Size/CornerStyle/glass） | https://developer.apple.com/documentation/uikit/uibutton/configuration-swift.struct |
| UICornerConfiguration（iOS 26 连续/同心/胶囊圆角） | https://developer.apple.com/documentation/uikit/uicornerconfiguration-swift.struct |
| UIView.cornerConfiguration | https://developer.apple.com/documentation/uikit/uiview/cornerconfiguration-7l0ja |
| CALayerCornerCurve（.continuous 连续圆角） | https://developer.apple.com/documentation/quartzcore/calayercornercurve |
| ContainerRelativeShape（SwiftUI 同心形状） | https://developer.apple.com/documentation/swiftui/containerrelativeshape |
| Spring（弹簧参数官方换算示例） | https://developer.apple.com/documentation/swiftui/spring |
| CAMediaTimingFunction（缓动曲线） | https://developer.apple.com/documentation/quartzcore/camediatimingfunction |
| UIColor.systemFill（语义定义） | https://developer.apple.com/documentation/uikit/uicolor/systemfill |
| SF 字体下载 | https://developer.apple.com/fonts/ |

### 社区来源（🟡）

| 内容 | URL |
|---|---|
| iOS 语义色/系统色 HEX 全表（与官方灰阶表吻合） | https://sarunw.com/posts/dark-color-cheat-sheet/ |

### 🔴 待二次核实清单（建议真机取色/Apple Design Resources 复核）

1. **systemFill 1–4 具体 rgba 值**（§3.6；当前为社区记录值）
2. **tinted 按钮 15% 透明度**的精确值（§3.7；UIKit 实现可能随 tint 自适应）
3. **iOS 26 sheet 具体圆角值**（官方仅定性 "increased corner radius"）
4. **Alert 宽度 270pt / 圆角 ≈14pt、grabber 36×5pt、Slider 轨道 4pt/thumb 27pt、Segmented 32pt、Switch 51×31pt、按钮 small/mini 高度**（均为社区实测）
5. **阴影具体参数**（现行 HIG 无 Shadows 数值页；需以 Apple Design Resources 为准）
6. **卡片圆角 10/16pt、16pt 边距、8pt 网格、44pt 行高、separator 16/60pt**（社区约定；建议对照 Apple Design Resources 官方模板）
7. **PingFang SC 的字号/行高适配**（Apple 未在 HIG 给出中文专属排印规范；建议按 SF Pro 表 + 中文阅读习惯微调）

---

## 附：本次调研方法与覆盖度说明

- 通过 `curl` 直接抓取 developer.apple.com 的 `.md` 文档端点（web_fetch 工具在本环境被沙箱 DNS 拦截，已改用 bash curl，均返回 HTTP 200）。
- 已覆盖用户要求的 9 大主题；其中 **色彩、字号、tracking、圆角 API、材质、动效弹簧、暗色海拔** 有官方数值；**组件微尺寸、阴影、8pt 网格** 为社区约定并已在文中逐条标注可信度。
- HIG 页面 Change log 显示色彩规格最后更新 2025-06-09 / 2025-12-16，Materials 2025-09-09，Design principles 2026-06-08 —— 本报告数值对应当前（iOS 26 时代）HIG。
