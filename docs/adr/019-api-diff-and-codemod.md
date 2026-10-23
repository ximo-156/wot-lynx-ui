# ADR-019 API 变更检测走语义 diff，codemod 只做能证明等价的改写

- **状态**：已采纳
- **日期**：2026-10-23
- **相关**：`scripts/api-diff.mjs`、`scripts/codemod.mjs`、`packages/ui/test/api-diff.test.ts`、`packages/ui/test/codemod.test.ts`、`packages/ui/test/fixtures/api-diff/`、`package.json`（`api:diff` / `codemod`）、`.github/workflows/ci.yml`（`api-diff` job）
- **依赖**：ADR-017（`packages/ui/meta.json`）

## 背景

架构评审给「引入破坏性变更」这一行的现状是「人工排查 + 手写 changelog」，目标
是「meta diff 自动产出 + codemod」，差距标注为「无机制」。

ADR-017 之后 `meta.json` 已经是源码的函数，**两个 commit 的 meta 之差就是这两个
commit 的公开 API 之差**。但「有 diff」和「有变更清单」之间还差两层：

| 层 | 缺什么 |
|---|---|
| 表达 | `git diff meta.json` 会把「一个 prop 改类型」显示成一行两千字符的 JSON，人读不出来 |
| 判定 | 文本 diff 无法区分「改描述」和「删 prop」——两者对使用者的影响差一个 major |
| 执行 | 知道「`round` 改名成 `circle`」之后，仍要人去 58 个 demo 里搜 `round` |

## 决策

### 1. 按契约单元做语义 diff，而不是文本 diff

比较单位是**组件 / prop / event / slot**，共 13 类变更，每类映射到固定严重级：

| 变更 | 级别 | 依据 |
|---|---|---|
| 删组件 / 删 prop / 删 event / 删 slot | major | 使用者代码编译失败或静默失效 |
| 组件换根（primitives ↔ components） | major | 深层导入路径失效 |
| v-model 契约变化 | major | 双向绑定的对外约定 |
| prop 类型收窄 / 不兼容 | major | 传入值可能不再合法 |
| prop 可选值移除 | major | 已写死的取值不再合法 |
| prop 由可选变必填 / 新增必填 prop | major | 现有用法缺参 |
| 新增组件 / prop / event / slot | minor | 向后兼容 |
| prop 类型放宽 | minor | 旧值仍然合法 |
| prop 默认值变化 | minor | 不改类型，但改变默认行为 |
| prop 由必填变可选 | minor | 向后兼容 |
| 族归属变化 | patch | 内部组织，使用者无感 |
| 描述变化 | docs | 纯文档，默认不进清单 |

**类型比较用联合成员集合的包含关系**，不是字符串相等：`number` → `number | string`
是放宽（minor），反过来是收窄（major），`number` → `string` 是不兼容（major）。
切分必须跳过引号与成对括号——`Record<string, any>` 里的逗号、`(() => void)` 里的
`=>` 都不是顶层分隔符，处理错会让整条类型比较静默失效。

**可选值单独比较**：`type` 常常是别名（`BadgeType`），真正的字面量集合在
`options` 里。只看 `type` 会漏掉「收窄了可选值」这种典型破坏性变更。

### 2. 改名识别：签名一致才算，有歧义就不猜

删掉一个 prop、新增一个 prop，若**类型、默认值、可选值三者完全相同**，判定为改名，
折叠成一条 `prop-renamed`。签名桶里任何一侧超过 1 个（2 删 2 加）时无法确定配对，
**退回「删 + 加」两条独立变更**，交给人工。

猜错的代价是一个静默改坏使用者代码的 codemod——比不给 codemod 糟得多。这是
ADR-006「只推导事实、语义不猜」在迁移层面的延续。

### 3. codemod 只执行 `rules`，其余输出人工指引

计划文件把变更分成两半：

- `rules`：可自动改写（当前只有 prop 改名）；
- `manual`：必须人看，每条带具体指引（搜什么、改成什么、为什么）。

只有 prop 改名能自动，是因为其余破坏性变更都**无法从 meta 推出「怎么改才对」**：
删掉的 prop 该换成什么、事件该迁到哪个，取决于使用者的业务语义。自动改写只会把
编译错误变成静默的行为错误。

### 4. 改写范围：只碰模板，且必须有属性名边界

- 只处理 `.vue` / `.html` 的模板区，**跳过 `<script>` 与 `<style>`**：`const legacy = 1`
  这样的同名局部变量是常态，误改会让语义反转。
- 只改目标组件的标签：`<wd-button round>` 与 `<wd-avatar round />` 是两个组件的
  不同 prop，同名不能一起改。
- 属性名必须有边界 `(?=[\s=/>])`：没有它，改名 `legacy` → `modern` 会把
  `:legacy-suffix` 变成 `:modern-suffix`（一个不存在的属性）。
- 驼峰与短横线两种拼写同时改写（meta 里是 `showZero`，模板里常写 `show-zero`）。
- 默认 dry-run 只打印将要改的行，`--write` 才落盘。

### 5. CI 只负责让人看见，不阻塞

PR 上生成清单并写入 `$GITHUB_STEP_SUMMARY` + 上传产物，**不设 `--fail-on`**。

破坏性变更是产品决策，不是缺陷——本项目正在 0.x 阶段做大规模迁移（P2 就把 12 个
基础件从 `components` 挪到了 `primitives`），阻塞式门禁会把正常重构全部卡住。
`--fail-on major` 保留给发布分支的收口检查；硬门禁（破坏性变更必须配 changeset）
等 `changesets` 就位后再接。

## 后果

### 实测

| 项目 | 结果 |
|---|---|
| fixture 对（2 份、覆盖 13 类） | 18 项变更，与手写期望逐项一致 |
| 真实 meta（106 组件）上的模拟演进 | 4 项：改名 1 / 删 prop 1 / 删事件 1 / 删可选值 1，级别全对 |
| codemod 扫 `docs/.vitepress/theme/demos` | 58 文件命中 1 处（`<wd-button round>`），`<wd-avatar round />` 未误伤 |
| 测试 | `api-diff.test.ts` 16 条 + `codemod.test.ts` 10 条 |

### 负向验证暴露的两个真实缺陷

1. **codemod 会静默删掉整个 `<script>` 块**。首版把源码切成「可编辑片段」后直接拼接，
   受保护区间没进输出——改一个属性名，顺带毁掉组件逻辑。测试立刻抓到。
2. **第一次负向验证无效**：我用字符串替换去掉边界断言，结果命中的是 JSDoc 注释里的
   同一段文本，代码没动，测试当然全绿。改用按行定位后才发现——**测试里复制了一份
   `compileRules` 的正则构造逻辑**，绕过了生产实现，所以改生产代码对它零影响。
   修法是导出真实的 `compileRules` 给测试用，**期望值仍手写**：实现共用、oracle 独立。

第 2 条是「负向验证必须确认被改的那条路径确实被执行了」的第三次实例，也是第一次
以「测试自己复制实现」的形式出现。

### 已知限制

- **`default` 是源码表达式字符串**（`"''"`、`"false"`、`"[]"`），比较的是字符串而非
  求值结果。`''` 与 `""` 会被判为不同——保守方向，最多多报一条 minor。
- **不支持 render 函数**（`.ts` 里的 `h('wd-button', { round: true })`）：那是表达式
  不是属性，需要 AST。当前 codemod 只覆盖模板。
- **事件 / 插槽改名不自动**：没有类型或默认值可作为配对证据，只能人工。
- **基准版本必须已有 `meta.json`**。早于契约产物的 commit 会跳过比较并明确提示，
  而不是报错——否则第一个引入 meta 的 PR 会让 CI 崩在 `git show` 上。

## 推翻条件

- 接入 TS 编译器 API 或 vue 语言服务后，codemod 可扩展到 render 函数与 script 内的
  props 传递，届时本 ADR 第 4 节的范围限制随之作废。
- `changesets` 就位并把「破坏性变更必须配 changeset」变成可校验的规则后，PR 门禁
  可从「仅展示」升级为「阻塞」，第 5 节随之修订。
