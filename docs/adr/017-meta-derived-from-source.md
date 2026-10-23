# ADR-017 组件契约由源码推导，产物是 JSON

- **状态**：已采纳
- **日期**：2026-10-23
- **相关**：`scripts/gen-meta.mjs`、`packages/ui/meta.json`、`packages/ui/test/meta-generated.test.ts`、`package.json`（`check:meta`）、`.github/workflows/ci.yml`、ADR-006
- **取代**：ADR-006 中「`meta.generated.ts`」的产物形态决策（推导式推导的结论不变）

## 背景

ADR-006 定了「契约字段只推导代码事实、不猜语义」，但产物形态留的是
`meta.generated.ts`。落地前实测了两件事，都需要调整：

1. **`.ts` 产物会被全量类型检查**。106 个组件、1464 个 prop 写成字面量类型后，
   `vue-tsc` 每次都要遍历它；而**当前没有任何 TS 消费者**读这份 meta
   （gen-docs 与后续的变更检测都是 JS 侧脚本）。为一个不存在的消费者付
   typecheck 代价不合理。
2. **人工维护骨架必然漂移**。106 份骨架 × 20 分钟，且写完那一刻就开始与代码
   不一致——这正是本仓库反复出现的文档漂移问题。契约必须是代码的**函数**，
   而不是代码的**复印件**。

## 决策

### 1. 产物是 `packages/ui/meta.json`，不进发布白名单

`JSON.stringify` 是数据，不是类型面。`meta.json` 目前只被构建期脚本消费
（`gen-docs`、后续的 meta diff），**没有外部消费者**，因此不加进 `files`、
不加进 `exports`。等真出现消费者（IDE 插件、契约校验工具）再开子路径——
ADR-005 的 YAGNI 条款同样适用。

### 2. 只推导代码里已有的事实

| 字段 | 来源 |
|---|---|
| `name` / `layer` | 目录结构（`primitives` / `components`） |
| `family` | `docs/architecture/families.json`（ADR-013 的单一来源） |
| `props` | `types.ts` 里唯一的 `<x>Props` 对象字面量 |
| `events` | `.vue` 的 `defineEmits(...)`，五种写法全支持（见下） |
| `slots` | `.vue` 模板里的 `<slot>` / `<slot name="x">` |
| `modelValue` | props 含 `modelValue` **且** events 含 `update:modelValue` |

不推导任何语义判断（是否废弃、可访问性等级、兼容状态）：那类信息代码里没有，
猜出来的 meta 比没有 meta 更糟。

### 3. `defineEmits` 的五种写法必须全部覆盖

实测分布（106 个组件）：

| 写法 | 数量 | 示例 |
|---|---|---|
| 数组 | 64 | `defineEmits(['click', 'tap'])` |
| 内联调用签名 | 7 | `defineEmits<{ (e: 'click', ev: any): void }>()` |
| 内联键元组 | 3 | `defineEmits<{ open: []; 'long-press': [{ image: string }] }>()` |
| 类型别名 | 5 | `defineEmits<SliderEmits>()`（别名在同目录 `types.ts`） |
| 交叉类型 | 2 | `defineEmits<Foo & { tap: [any] }>()` |
| 无（纯展示组件） | 25 | — |

前两种是首版实现覆盖的；后三种各漏过一轮（10 → 4 → 2 个组件），详见
「后果 / 静默失效」。

### 4. prop 的 `type` / `default`：代码优先，JSDoc 兜底

`types.ts` 里同一件事有两种表达：

```ts
/** 禁用按钮  默认值: false */
disabled: makeBooleanProp(false)
```

代码侧归一规则（覆盖全仓实际形态）：

- `makeBooleanProp(v)` → `boolean`，默认 `v`
- `makeStringProp(v)` → `string`，默认 `v`
- `makeNumberProp(v)` → `number`，默认 `v`
- `makeNumericProp(v)` → `number | string`，默认 `v`
- `makeArrayProp()` → `array`，默认 `[]`
- `makeRequiredProp(T)` → `T`，`required: true`
- `{ type: T, default: D }` → 解析对象字面量
- `foo: Boolean` → `boolean`（Vue 简写）
- `String as PropType<T>` → `T`（**不是** `string`：消费者在 IDE 里看到的是 `T`）
- `numericProp` / `truthProp` / `unknownProp` → 按 `common/props.ts` 的定义展开

JSDoc 侧只在代码推不出时兜底，且要过滤噪音：

- `默认值:` 只认**字面量**（`true`/`false`/数字/带引号字符串/`[]`/`{}`/`null`）。
  实测有 27 处写 `-`、8 处写「继承自 wd-checkbox-group」、3 处写「空字符串」、
  3 处写「国际化文案」——这些是**人话**，写进契约会让文档出现
  「默认值 = 继承自 xxx」这种错误。
- `类型:` 含中文的一律丢弃（`number 或 string（…）` 是描述不是类型）。

实测覆盖：**type 1464/1464（100%）**、description 1464/1464、default 1137/1464
（其余是真无默认值或 `void 0`）。

### 5. 序列化：结构缩进 + 每 prop 一行 + 固定字段顺序

不用 `JSON.stringify(meta, null, 2)`：逐层缩进的结构开销比数据本身还大
（实测 258 KB，其中 description 只占 77 KB）。改为每行一个 prop 后 **218.8 KB**。

prop 字段按 `name / type / default / required / options / description` 固定顺序
重建对象：键序原本取决于「JSDoc 给了什么 + 代码推出了什么」的组合，同一份数据
能排出两种键序，diff 里会出现「整行变了但内容没变」。

**diff 粒度落到单个 prop**，所以 `meta.json` 的 diff 就是可读的 API 变更清单
——这是它相对 `.ts` 产物的另一个好处。

### 6. 门禁：`check:meta` + 11 条一致性断言

- `pnpm check:meta`（`gen-meta.mjs --check`）：产物与源码不一致即退出 1，
  接入 CI 的 `generated` job。
- `test/meta-generated.test.ts`：11 条断言，其中 4 条是**防静默失效**的核心：
  1. 源码里有 `emit('x')` 调用 → `events` 必须含 `x`
  2. 源码里有 `<slot>` → `slots` 必须非空
  3. 源码 `types.ts` 里定义的 prop → `props` 必须含它
  4. `default` 不能是人话（`继承自` / `-`）

  这些检测逻辑**独立实现**，不 import `gen-meta.mjs` 里的函数。复用会让同一个
  bug 同时污染生产者和校验者，测试就退化成「代码跑过了」。

## 后果

### 静默失效是本方案的主要风险，且已实际发生过三次

解析器按**写法形态**匹配，遇到没覆盖的写法时安静地返回空数组，产出一份
「看起来正常、实际缺字段」的契约。下游文档生成、API 变更检测都会跟着错，
且没有任何报错。

| 轮次 | 漏掉的组件数 | 原因 |
|---|---|---|
| 首版 | 10 | 只认数组与调用签名，漏了键元组 / 类型别名 / 交叉类型 |
| 次版 | 4 | TS 类型字面量的成员**可以只用换行分隔、不写逗号/分号**，只认 `,`/`;` 会除第一个键外全漏 |
| 三版 | 2 | `defineEmits<Foo & { … }>()` 交叉类型只解析了前半 |

三次都是靠「有 emit 调用但 events 为空」这条断言发现的，没有一次靠报错。

同类陷阱还有：

- **对象展开覆盖**：`wd-text` 在 `...baseProps` 之后重新定义了 `customStyle` /
  `customClass`。按 JS 语义后写覆盖先写、但键位置不变，不去重会产出同名 prop 两次。
- **泛型里的逗号**：`makeArrayProp<Record<string, any>>()` 的逗号在尖括号内，
  取值扫描不跳过尖括号会把值截断成 `makeArrayProp<Record<string`。
- **连续 `>`**：`(?:<[^>]*>)?` 只能吃到第一个 `>`，`Record<…>>()` 需要手动配对。
- **块注释里的 `*/*.vue`** 会因 `*/` 提前闭合注释（本仓库已踩三次）。

### 其它

- 新增组件时若用了第六种 `defineEmits` 写法，`check:meta` 不会报错，
  但 `meta-generated.test.ts` 会红——这是刻意分工：前者管「产物是否最新」，
  后者管「解析是否完整」。
- `meta.json` 是**生成物**，与 `index.css` / `SNAPSHOT.md` 同级，禁止手改。

## 推翻条件

- **出现真正的 TS 消费者**（如需要 `ComponentProps<'wd-button'>` 这类类型工具）
  → 应另出 `meta.generated.ts` 供类型层使用，`meta.json` 继续作为数据源，
  而不是把 JSON 换成 TS。
- **组件数降到 30 以下** → 人工维护骨架的成本低于解析器维护成本，可回退。
- **`defineEmits` 写法收敛到 1–2 种**（例如 lint 强制统一）→ 解析器可大幅简化，
  静默失效面随之消失。
