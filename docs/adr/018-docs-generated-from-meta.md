# ADR-018 文档由 meta 生成，侧边栏是唯一组件清单

- **状态**：已采纳
- **日期**：2026-10-23
- **相关**：`scripts/gen-docs.mjs`、`docs/.vitepress/components-sidebar.ts`、`docs/.vitepress/config.ts`、`docs/package.json`、`package.json`（`check:docs`）、`.gitignore`
- **依赖**：ADR-017（`packages/ui/meta.json`）

## 背景

`gen-docs.mjs` 原本用正则**反解析** `types.ts` 的 JSDoc。为此打了三个补丁：

1. tempered token（`(?:(?!\*\/)[\s\S])*?`）避免贪婪吞掉多个注释块；
2. `<` / `>` 转义成 HTML 实体（markdown 会把 `Partial<X>` 当标签）；
3. 对象默认值包 code span（`{ top: 16 }` 会被 markdown 当属性语法）。

三个补丁都作用在**解析时**，于是转义后的字符串被存进了中间产物——而真正该转义的
是**渲染时**。这是分层错位。

除了解析脆弱，还有三处硬编码与一个结构性问题：

| 问题 | 表现 |
|---|---|
| `customStyle` / `customClass` 手写 | 且 `unshift` 两次导致顺序反了（customClass 在 customStyle 前） |
| Events 表格写死两行假数据 | `update:modelValue` / `click · change · confirm 等`，106 个组件完全一样 |
| 没有 Slots 表格 | meta 里明明有 |
| 只有「参数 / 说明」两列 | 类型与默认值被塞进说明列 |

**最严重的是表格结构被破坏**：`可选值: 'primary' | 'success' | …` 被直接拼进单元格，
竖线被 markdown 当列分隔符，`wd-button` 的 `type` 行裂成 8 列、整张表错位。那一版
没有任何自检，错误一路进到文档站。

此外，`docs/.vitepress/config.ts` 的侧边栏是**手写的第三份组件清单**（另两份是
`meta.json` 与 barrel），标题写着「全部组件（101 个）」，而 meta 已有 106 个，
缺 5 个条目——点进去 404。

## 决策

### 1. 读 meta，转义下沉到渲染层

`gen-docs` 只做两件事：读 `meta.json`、渲染 markdown。转义集中在两个函数里：

- `cell()`：普通单元格，处理 `|`（断列）、`<` `>`（HTML 标签）、换行（断行）；
- `code()`：行内代码，`|` 在 GFM 的 code span 内**仍需转义**，否则照样断列。

meta 存干净原文，因此同一个 description 可以被文档、JSON schema、IDE 提示共用，
各自按自己的规则转义。

### 2. Props 四列，Events / Slots 从 meta 来

```
| 参数 | 说明 | 类型 | 默认值 |
```

`可选值` 并入说明列（`可选值：'a' | 'b'`），不单开一列——106 个组件里只有 104 个
prop 有可选值，单开一列会让绝大多数行是 `-`。

Events 与 Slots 只在非空时输出小节。`wd-circle` 这类纯展示组件不再出现
「Events 表格里写着 click / change / confirm」的假信息。

### 3. 事件说明留空，不编造

事件描述只存在于 `types.ts` 的 `XxxEmits` 类型 JSDoc 里，而全仓**只有 6 个组件**
这样定义（其中 4 个写了 JSDoc）。其余组件的 `defineEmits` 只有事件名与参数类型，
**代码里没有描述**。

按 ADR-006「猜出来的比没有更糟」，这里只填两个协议级说明：

```js
'update:modelValue': 'v-model 双向绑定的值更新'
'update:current':    '`v-model:current` 绑定的当前项更新'
```

这两个是 Vue 的 v-model 协议语义，不是业务猜测。业务含义一律留 `-`。

### 4. 侧边栏生成，成为唯一组件清单

`gen-docs` 额外产出 `docs/.vitepress/components-sidebar.ts`，`config.ts` 里
109 行手写数组变成一行 `[componentsSidebar]`。

标题的组件数、条目顺序、链接全部来自 meta，不可能再漂移。

### 5. NAMES 必须全覆盖，缺一个就退出

组件中文名是**唯一**无法从代码推导的信息（`Button 按钮` 里的「按钮」不在任何代码里）。
`NAMES` 表保留人工维护，但生成前断言：

- meta 里每个组件都在 `NAMES` 里；
- `NAMES` 里没有 meta 中不存在的组件。

任一不满足即 `exit 1`，避免标题悄悄退化成裸 PascalCase。

实测补了 7 个缺失（`address-edit` / `coupon` / `pull-refresh` / `share-sheet` /
`sidebar` / `sidebar-item` / `submit-bar`），删了 1 个幽灵（`wd-shide-verify`，
拼写错误，组件不存在）。

### 6. md 不入库，侧边栏入库

| 产物 | 入库 | 原因 |
|---|---|---|
| `docs/components/*.md` | ❌ | 纯生成物，`docs:build` / `docs:dev` 的 `pre` 脚本保证存在 |
| `docs/.vitepress/components-sidebar.ts` | ✅ | `config.ts` 直接 import 它 |

因此 `check:docs` **只校验侧边栏**，不校验 md——md 根本不在版本控制里，
没有「与源码不一致」的概念。这是它与 `index.css` 的关键区别：后者是运行时
`import './index.css'` 的必需产物，必须入库并被 CI 校验。

### 7. 生成后自检表格结构

`assertTableShape()` 在写文件**之前**检查：每个表格的每一行列数必须等于表头列数。
不满足即抛错，非法产物无法落地。

负向验证：去掉 `code()` 的竖线转义后，`action-sheet.md` 第 15 行立刻报
「列数 5 ≠ 表头 4」。

## 后果

### 顺带修掉的两个真实缺陷

**（1）`.gitignore` 自相矛盾，16 篇 ADR 从未入库**

第 3 节的注释写着「`docs/guide/`、`docs/components/`、`docs/adr/` 是文档源码，
必须入库，不得忽略」，规则却是：

```
docs/components/*
docs/adr/*
docs/guide/*
```

`git ls-files docs/adr/` 返回空——**001–016 共 16 篇 ADR 与全部指南只存在于本机**。
文末「必须入库的生成物」清单里还明确列着 `docs/**/*.md`，与这三条规则直接冲突。

已移除 `docs/adr/*` 与 `docs/guide/*` 两条（人工撰写的源码），保留 `docs/components/*`
（纯生成物）。修复后 `docs/adr/`、`docs/architecture/` 共 22 个文件进入版本控制
——后者包含 `families.json`（ADR-013 的单一来源）与 `deps-baseline.json`（CI 基线），
之前也从未入库。

**（2）文档站构建被双组件根迁移阻断**

`wd-cell` 等 12 个基础件迁到 `src/primitives/` 后（ADR-012），29 个 demo 仍从
`wot-lynx-ui/components/wd-cell/…` 导入，`config.ts` 的别名也只映射 `components` 根。
构建报 `ENOENT: src/components/wd-cell/wd-cell.vue`。

已批量修正 29 个文件的 37 处导入，并给 `config.ts` 补 `primitives` 别名。

### 已知限制

- **`docs/guide/` 目录不存在**，而 `config.ts` 的侧边栏引用了 7 篇指南
  （`quick-start` / `device-testing` / `theme` / `icons` / `design-research` /
  `performance` / `differences`）。这 7 个链接目前是 404。补内容属于写作任务，
  不在本决策范围内。
- **事件说明大面积留空**（见决策 3）。要补齐需要在各组件的 `defineEmits` 类型体里
  写 JSDoc，然后扩 meta 结构——那是 ADR-017 的推翻条件之一，当前收益不足。
- 构建产物 `docs/.vitepress/dist/` 在沙箱环境中会因批量删除保护
  （`SAFE_DELETE_BULK_CONFIRM_REQUIRED`）在**最后清理临时目录**阶段失败。
  此时 `client + server bundles` 与 `rendering pages` 均已成功，106 个页面已落盘。
  真实 CI 无此限制。

## 推翻条件

- **`docs/guide/` 补齐后**，侧边栏应该连指南一起生成（`/guide/` 那组现在也是手写的），
  届时 `gen-docs` 应改名为 `gen-nav` 或拆出 `gen-sidebar`。
- **事件 JSDoc 覆盖率达到 50% 以上** → 扩 meta 的 `events` 为对象数组（含描述与参数），
  文档事件表不再留空。这是 ADR-017 推翻条件的补充。
- **文档站改为运行时读 meta 渲染**（而非构建期生成 md）→ 本决策的大部分机制失去意义，
  但 meta 作为唯一数据源的前提不变。
