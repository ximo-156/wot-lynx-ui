# ADR-006 meta 作为契约单一来源

- **状态**：已采纳（方案修正为推导式，2026-10-22；产物形态调整为 JSON，见 ADR-017）
- **日期**：2026-10-16 ／ 修订：2026-10-22、2026-10-23
- **相关**：`ARCHITECTURE.md §4.3`、ADR-017

## 背景

组件的契约（props / events / slots / 可访问性 / 生命周期状态 / 与 wot-ui 的兼容声明）没有单一来源，散落在 `types.ts`、`.vue` 的 `defineEmits`、模板的 `<slot>`、以及人脑里。

后果：

- `gen-docs.mjs` 靠**反解析 `.vue`** 生成文档，写法一变即失效。
- 无法做 API 变更检测，破坏性变更只能靠人。
- 无法产出 IDE 智能提示 / AI 可消费的结构化契约。

## 决策

**meta 作为契约单一来源**，驱动六处生成物（barrel / 文档 / demo 注册 / API diff / codemod / JSON schema）。

**方案修正**：v1.0 计划「脚本生成骨架 + 人工补 events/slots/a11y」，仍需人工过 107 遍。v2.0 改为**推导式**：

| 字段 | 来源 | 维护方 |
|---|---|---|
| `props` | `types.ts` 的 props 对象（`common/props.ts` 工厂可运行时识别） | 机器 |
| `events` | `.vue` 的 `defineEmits` / `emits` | 机器 |
| `slots` | template 中的 `<slot name="x">` | 机器 |
| `name` | 目录名 | 机器 |
| `domain` / `tier` / `status` / `a11y` / `wotCompat` | 人工语义 | 人工（仅 5 字段） |

产出两份文件：`meta.generated.ts`（机器维护，CI 校验）+ `meta.ts`（人工语义）。

## 后果

**正面**

- 107 份 meta 的人工成本从「107 × 20 分钟」降到「107 × 2 分钟」。
- `meta.generated.ts` 的 diff **天然就是 API 变更清单**——破坏性变更检测不再依赖人。
- `gen-docs` 从「反解析 vue」改为「读 meta」，脆弱性消失。

**负面**

- 推导器本身需要维护（正则解析 `defineEmits` / `<slot>` 有边界情况）。
- 生成物入库会带来「忘记重生成」的 CI 红灯（用 `--check` 模式拦住，与 `gen-index` 同模式）。

## 推翻条件

- 推导器的假阳性率 > 10% → 回退为「人工维护 meta」，但保留单一来源原则。
- 上游（vue-lynx / Rspeedy）提供组件元信息导出能力 → 直接消费，删除推导器。
