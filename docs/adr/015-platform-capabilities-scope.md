# ADR-015 PlatformAdapter 只落地 capabilities，方法层不做

- **状态**：已采纳
- **日期**：2026-10-23
- **相关**：`packages/ui/src/common/platform.ts`、`common/uniAdapter.ts`、`common/uni.ts`、`test/platform.test.ts`、ADR-005

## 背景

ADR-005 设计的 `PlatformAdapter` 含两部分：

1. `capabilities`（canvas2d / svgGradient / pseudoElements / declarativeMts / clipboard / safeArea）
2. 方法层：`measure(target)` / `getSystemInfo()` / `navigate(to)` / `pickMedia(opts)`

本次落地（P2.1 / P2.2）逐项核对了这两部分在代码里的真实消费者，结论与 ADR-005 的设想有偏差，需要记录。

### 方法层零消费者

`uni.*` 已经提供了 `getSystemInfoSync` / `navigateTo` / `chooseImage` 等 **100+ 个键**，
并经 `configureUniAdapter` 支持宿主注入。`PlatformAdapter` 的方法层只是给这些 API
再套一层门面：同一个能力有两个入口（`uni.navigateTo` 和 `platform.navigate`），
调用方会分裂，维护成本翻倍，而**当前没有任何调用点需要它**。

ADR-005 自己的推翻条件写着：

> 抽象出的能力**未被 2 个以上组件实际使用** → 说明抽象过度，应删除该能力（YAGNI）。

方法层连 1 个消费者都没有。

### 能力清单也要按消费者裁剪

ADR-005 列了 6 个能力。实测代码里的使用频次（`grep hasUniAdapter`）：

| 键 | 组件使用次数 |
|---|---|
| `createIntersectionObserver` | 3 |
| `pageScrollTo` | 2 |
| `createVideoContext` | 2 |
| `createCanvasContext` | 2 |
| `canvasToTempFilePath` | 2 |
| `getImageInfo` | 1 |
| `makePhoneCall` | 1 |
| `openType` | 1 |

`svgGradient` / `pseudoElements` / `clipboard` / `safeArea` **一次都没出现**；
`declarativeMts` 也没有探测——MTS 是声明式写法（ADR-011），组件无条件使用，
不存在「平台不支持」的分支。

## 决策

### 1. 只落地 `capabilities`，且只含 4 个能力

```ts
interface PlatformCapabilities {
  canvas2d: boolean              // createCanvasContext + canvasToTempFilePath
  intersectionObserver: boolean
  videoContext: boolean
  pageScroll: boolean
}
```

每个都恰好有 2 个以上消费者（见上表），满足 ADR-005 的 YAGNI 条款。

### 2. 能力是**派生值**，不单独配置

`capabilities` 由 `hasUniAdapter(key)` 实时计算，宿主注入 API 后自动为真。
**不设**「能力声明」字段：注册表与声明并存必然漂移，而本仓库反复出现的
「文档/声明与实现不一致」问题不该在代码里重演。

配套两条实现约束：

- 用 **getter** 而非 setup 时快照 —— 宿主可能在挂载后才注入（`configureUniAdapter`
  的既有契约允许）。
- `getPlatform()` 返回**稳定实例**，能力读取实时。

### 3. `mockPlatform()` 必须压过已注入的宿主能力

ADR-005 的原始诉求是「测试降级路径时无法注入全能力关闭的 mock → 降级分支无覆盖」。
如果 mock 只是「不注入」，那么任何先注入了宿主能力的用例都覆盖不到降级分支。
因此 mock 是一层**强制覆盖**：

```ts
const restore = mockPlatform()          // 全部 false，name='mock'
const restore2 = mockPlatform({ pageScroll: true })  // 只放行一项
```

负向验证：把 `readCapability` 里的 `forcedCapabilities` 分支短路后，
`test/platform.test.ts` 有 3 例失败（含组件级门禁用例），确认 mock 真的生效。

### 4. 单点能力不进 capabilities

`getImageInfo` / `makePhoneCall` / `openType` 各只有 1 个消费者，继续用
`hasUniAdapter(key)`。若把它们也收进 `capabilities`，`capabilities` 会退化成
注册表的镜像——多一层间接却不多一点信息。

### 5. `uniAdapter.ts` 保持原样

P2.2 原计划「`uniAdapter` 降级为薄封装」。核查后**不需要改**：它已经是 17 行
纯注册表，`platform.ts` 叠在其上做语义层，职责已经分开。为改而改会制造无收益的
diff。

### 6. 替换范围

8 处组件判断改为能力判断（`wd-backtop` / `wd-signature` / `wd-img-cropper` /
`wd-sticky` ×2 / `wd-sticky-box` / `wd-swiper` / `wd-tour` / `wd-video-preview`）。

顺带修正一处误导：`uni.ts` 的降级告警原本写死「在 Lynx 中不可用」，但本库也跑在
web 环境（`packages/demo` 的 `environments.web`）。改为报 `getPlatform().name`。

## 后果

- 能力的判定条件只有一处（`CAPABILITY_APIS`），改动面从 O(组件数) 降到 O(1)。
- `getPlatform().capabilities.x` 比 `hasUniAdapter('x')` 啰嗦，但语义明确。
- 新增能力必须先进 `CAPABILITY_APIS`，且要有 ≥2 个消费者；单点需求继续用字符串键。
- 方法层缺位意味着「平台抽象」只覆盖了能力探测，不覆盖 API 归一化。这是有意的
  边界：API 归一化由 `uni.ts` 承担。

## 推翻条件

- **出现需要跨平台统一签名的调用点**（如既要 `navigate` 又要 `pickMedia`，且两者
  在 ≥2 个组件里各写一遍分支）→ 再把方法层补上。
- **`uni.*` 被拆分或废弃** → `PlatformAdapter` 应升级为唯一的平台门面。
- **某个能力涨到需要区分「支持但不完整」**（如 canvas 支持但无导出）→ 能力值从
  boolean 改为枚举，届时 `CAPABILITY_APIS` 的结构也要跟着变。
