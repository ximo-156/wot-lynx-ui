# ADR-005 PlatformAdapter 显式契约

- **状态**：已采纳（**范围收敛**：只落地 `capabilities`，方法层不做，见 [ADR-015](./015-platform-capabilities-scope.md)）
- **日期**：2026-10-16 ／ 落地：2026-10-23
- **相关**：`common/platform.ts`、`common/uniAdapter.ts`、`ARCHITECTURE.md §4.2`、ADR-015

> ⚠️ **本文的接口草案与最终落地有偏差**：`measure` / `navigate` / `pickMedia` 等方法
> 未实现（零消费者），能力清单从 6 个裁剪到 4 个（每个需 ≥2 个消费者）。
> 能力也不作为「声明」而是从注册表派生。详见 ADR-015。以下为历史记录，未作修改。

## 背景

平台差异（系统信息、路由、媒体选择、剪贴板、Canvas 能力）散落在 `common/uni.ts`、`useDeviceInfo`、以及各组件内的 `if (host)` 分支。

现状 `common/uniAdapter.ts` 仅 17 行：

```ts
export type UniAdapter = Record<string, any>
const hostAdapter: UniAdapter = {}
export function configureUniAdapter(adapter: UniAdapter): void { Object.assign(hostAdapter, adapter) }
export function hasUniAdapter(api: string): boolean { return typeof hostAdapter[api] === 'function' }
```

它解决了「宿主可注入」，但**没解决「组件如何知道平台有什么能力」**。后果：

| 场景 | 改动面 |
|---|---|
| 新增 Harmony 专有 API | 注册表加键 + **每个用到该能力的组件**内加分支 → O(组件数) |
| 测试降级路径 | 无法注入「全能力关闭」的 mock → 降级分支无覆盖 |

## 决策

引入带 `capabilities` 声明的 `PlatformAdapter`：

```ts
interface PlatformAdapter {
  readonly name: 'lynx' | 'web' | 'harmony' | 'mock'
  readonly capabilities: { canvas2d; svgGradient; pseudoElements; declarativeMts; clipboard; safeArea }
  measure(target): Promise<Rect>
  getSystemInfo(): SystemInfo
  navigate(to): Promise<void>
  pickMedia(opts): Promise<MediaFile[]>
}
```

- 组件写法改为 `if (!platform.capabilities.canvas2d) return fallback`。
- `mockAdapter`（capabilities 全 false）强制覆盖降级路径。
- 旧 `configureUniAdapter` 保留为薄封装，零破坏。

## 后果

- 平台扩展成本从 **O(组件数)** 降到 **O(1)**。
- 引入一层间接，组件内取值略啰嗦。

## 推翻条件

- Lynx 官方提供跨平台能力探测标准 API → 直接采用官方，本层降级为薄适配。
- 抽象出的能力**未被 2 个以上组件实际使用** → 说明抽象过度，应删除该能力（YAGNI）。
