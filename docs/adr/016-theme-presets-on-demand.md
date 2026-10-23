# ADR-016 预设主题按需引入，不进主包

- **状态**：已采纳
- **日期**：2026-10-23
- **相关**：`packages/ui/src/styles/theme/presets/*`、`scripts/build-css.mjs`、`scripts/build-dist.mjs`、`packages/ui/package.json`、`test/theme-presets.test.ts`

## 背景

三套预设主题（`brand-a` / `compact` / `high-contrast`）原先全部 `@include` 进
`theme/index.scss`，因此**每个消费者都无条件收到它们**。

两个问题：

1. **语义错误**：`brand-a` 不是「主题开关」，而是**品牌覆盖**——它把
   `--wot-primary-1..10` 整体换成一套紫色色阶。默认发给所有消费者，等于替他们
   做品牌决策。`compact` / `high-contrast` 也是少数场景才需要。
2. **体积**：实测预设占主主题 CSS 的 **1844 / 20103 字节（9.2%）**，全部是
   未使用时的死重。

## 决策

### 1. 主主题与预设主题拆为独立入口

```jsonc
"./theme":            { "source": "./src/styles/theme/index.scss",            "import": "./dist/theme/index.css" },
"./theme/presets":    { "source": "./src/styles/theme/presets/index.scss",    "import": "./dist/theme/presets/index.css" },
"./theme/presets/*":  { "source": "./src/styles/theme/presets/*.scss",        "import": "./dist/theme/presets/*.css" }
```

消费方：

```ts
import 'wot-lynx-ui/theme'                  // 必须：base 刻度 + light/dark
import 'wot-lynx-ui/theme/presets/brand-a'  // 按需：某个预设
// 或 import 'wot-lynx-ui/theme/presets'    // 全部预设
```

主主题 CSS 因此从 **20103 → 18259 字节**。

### 2. 类名规则下沉到各预设文件

原先类名集中在 `presets/index.scss` 的 `preset-theme-classes` mixin 里，
这会让「单独编译 `brand-a.scss`」得到**空 CSS**，就必须为每个预设再造一个入口文件。

改为每个预设文件自带：

```scss
@mixin brand-a-theme-vars { … }
.wot-theme-brand-a { @include brand-a-theme-vars; }
```

于是 `@use` 任一预设文件即可产出完整规则，聚合入口与单文件入口天然一致，
`presets/index.scss` 退化为三行 `@use`。

### 3. 构建链路同步

- `build-css.mjs` 新增 `THEME_ENTRIES` 清单（主主题 + 聚合 + 3 个预设）。
- `build-dist.mjs` 复制 `dist/theme/presets/*.css`。
- `check-exports.mjs` 的「跨条件条目集合一致性」会拦住「新增预设但漏加进
  `THEME_ENTRIES`」——这类漏配不会报错，只会让消费者的子路径 404。

### 4. 用测试锁住两条契约

`test/theme-presets.test.ts` 直接编译 SCSS（不读生成物，因此不依赖构建顺序）：

- 主主题编译结果的主题类**只有** `.wot-theme-dark` / `.wot-theme-light`；
- 每个预设单独编译后**只含自己的类**；
- `WdConfigProvider` 的 `theme="brand-a"` 产出的类名与预设选择器**同源**。

第三条把 CSS 与运行时绑在一起：任一侧改名，测试同时暴露两边对不上。

负向验证：把 `@use './presets/index.scss'` 加回主主题 → 第 1 条断言失败。

## 后果

- **未引入预设 CSS 时不会报错**。`--wot-*` 会回落到 light 主题的值，表现为
  「主题没生效」而不是「报错」。这是 CSS 自定义属性的固有行为，无法在运行时
  可靠检测（Lynx 下读取计算样式代价高且不可靠）。已写入 `presets/index.scss`
  头部与 `ARCHITECTURE.md §7.1`，排查时先确认预设 CSS 是否引入。
- 消费者多一条 import 语句。
- `theme/presets/*` 是**文件通配**（`*.scss` / `*.css`），与组件根的**目录通配**
  （`*/*.vue`）不同。`check-exports.mjs` 的 `sampleNames()` 需要按通配符角色分别
  枚举——只枚举目录会让这类目标被静默跳过（已修）。

## 推翻条件

- **绝大多数消费者都会用某个预设** → 拆分的收益消失，应合并回主主题。
- **Lynx 提供可靠的样式探测 API** → 可改为「缺预设 CSS 时告警」，消除静默失败。
- **预设数量涨到 5 个以上** → 应改为运行时主题引擎（JS 注入变量），而不是继续
  堆 CSS 类。
