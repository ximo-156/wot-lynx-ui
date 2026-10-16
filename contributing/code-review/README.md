# wot-lynx-ui 代码审查机制

> 适用仓库：`github.com/ximo-156/wot-lynx-ui`
> 技术栈：Vue 3.5 + Vue Lynx 0.5（跨端）· pnpm monorepo · Vitest
> 团队规模：10 人以内 ｜ 评审载体：GitHub Pull Request
> 版本：v1.0 ｜ 生效：2026-10-16 ｜ 回顾周期：每季度

---

## 这套机制要解决什么

体检结论（见 [`00-仓库现状体检.md`](./00-仓库现状体检.md)）：

> **这个仓库不缺规范，缺的是"规范的可执行化"。**
> `CONVENTIONS.md` 已写明 19 节硬约束，但**没有任何一条被自动化**；且 `pnpm verify` 因 `scripts/` 未入库而**无法运行**，CI 无从谈起。

因此本机制的三个支点：

1. **把法典变成警察** —— 将 `CONVENTIONS.md` 的硬规则写成脚本，进 CI（[`05`](./05-自动化门禁与CI配置.md) + `scripts/review-lint.mjs`）
2. **把评审焦点从"风格"移到"静默失效"** —— 本库的头号风险不是报错，是"不报错但坏了"（[`03`](./03-组件库专项检查清单.md)）
3. **把强度与风险挂钩** —— 改一行鉴权 vs 改一行注释，不该同等对待（[`01`](./01-审查标准.md)）

---

## 30 秒速览

| 问题 | 答案 |
| --- | --- |
| 谁必须审？ | 至少 1 人；`L2/L3` 需 2 人且含 1 名 Code Owner |
| 多久必须响应？ | 工作时间 **4 小时**首次响应，**24 小时**内完成 |
| PR 能开多大？ | 有效 diff **≤ 400 行**；> 800 行必须拆分或走 RFC |
| 生成物怎么算？ | `**/index.css`、`pnpm-lock.yaml` **不计入**有效 diff，且不逐行评审 |
| 什么必须拦下？ | 静默失效类（字符串 `:style`、类名错配、`@click` 绑 view）、真机崩溃类（SVG 白名单、MTS、事件注册表数组）、回归测试被弱化 |
| 什么不该在评审里吵？ | 格式、缩进、引号、导入顺序 —— 交给 Prettier/ESLint |
| 靠什么保证执行？ | GitHub Branch Protection + CI 必过检查 + CODEOWNERS，不靠自觉 |
| 怎么衡量？ | 首次响应时长、合并周期、PR 尺寸、评审轮次、缺陷逃逸率 |

---

## 五条核心原则

1. **评审针对代码，不针对人。**
   任何"你怎么又……"的表述都违反本规范（见 [`04`](./04-评审意见与沟通规范.md)）。

2. **强度随风险走，不随资历走。**
   风险分级见 [`01`](./01-审查标准.md)。

3. **机器能判断的，人不重复判断。**
   `CONVENTIONS.md` 里凡是能用正则/类型/lint 表达的规则，全部交给脚本。
   人只看脚本看不懂的：**意图、权衡、真机行为、边界情况**。

4. **静默失效优先于代码美观。**
   在本库中，一个类名写错的代价（按钮塌成内容高度）远大于一个命名不佳的函数。

5. **回归测试是制度记忆，不可弱化。**
   `test/` 下 11 个 `*-regression.test.ts` 各自对应一类真实线上缺陷。
   修改相关代码时删断言、跳过测试、改用假绿 API（如用 `fireEvent.click` 断言 Lynx 的 tap 行为）→ 一律 🔴。

---

## 文档索引

| 文档 | 内容 | 读者 |
| --- | --- | --- |
| [`00-仓库现状体检.md`](./00-仓库现状体检.md) | 实测数据、5 个阻塞问题、本库风险特征分析 | 全员必读 |
| [`01-审查标准.md`](./01-审查标准.md) | 风险分级、PR 尺寸、审查维度、意见级别、Blocker 清单 | 全员必读 |
| [`02-审查流程.md`](./02-审查流程.md) | 角色职责、端到端流程、SLA、冲突升级、特殊场景 | 全员必读 |
| [`03-组件库专项检查清单.md`](./03-组件库专项检查清单.md) | Vue Lynx 组件库逐条检查项（按缺陷类型组织） | 评审时对照 |
| [`04-评审意见与沟通规范.md`](./04-评审意见与沟通规范.md) | 评论标签、正反示例、作者侧响应、反模式 | 全员必读 |
| [`05-自动化门禁与CI配置.md`](./05-自动化门禁与CI配置.md) | 分层门禁、Branch Protection、CODEOWNERS、CI 工作流 | 仓库管理员 |
| [`06-落地推行计划.md`](./06-落地推行计划.md) | 4 周启动、90 天路线、度量指标、阻力应对 | 技术负责人 |
| [`scripts/review-lint.mjs`](../../scripts/review-lint.mjs) | 规范检查脚本：把 `CONVENTIONS.md` 的硬规则自动化（22 条规则） | 仓库管理员 |
| [`.github/`](../../.github) | PR 模板、CODEOWNERS、CI 工作流 | 仓库管理员 |

---

## 快速开始

本 PR 已把门禁相关文件全部入库，**无需再手动复制**：

| 已入库文件 | 作用 |
| --- | --- |
| `.github/pull_request_template.md` | PR 模板（风险分级 + 自审清单 + 验证记录） |
| `.github/CODEOWNERS` | 模块所有权（⚠️ 占位团队名需替换） |
| `.github/workflows/ci.yml` | CI 门禁（5 项必过检查） |
| `scripts/review-lint.mjs` | 规范检查脚本 |
| `.gitignore` | 已放行 `scripts/build-css.mjs` 与 `scripts/review-lint.mjs` |

### 第 1 步：让 `verify` 能跑（仍需人工处理）

`scripts/build-css.mjs` 目前**仍未入库**（本 PR 只放行了该路径，未包含文件本体，因为它不在版本控制中、无法从远端获取）。需要由本地持有该文件的人执行：

```bash
git add scripts/build-css.mjs
git commit -m "chore(build): 将 build-css 脚本入库以支持 CI"
```

**在此之前**，CI 的「生成物一致性」与「构建校验」两个 job 会**自动跳过并给出告警**，其余三项检查正常生效。

### 第 2 步：替换 CODEOWNERS 中的占位团队名

把 `@tech-lead` / `@arch-owner` / `@design-owner` / `@icon-owner` / `@maintainer`
替换为真实 GitHub 用户名或团队名，否则分支保护的 "Require review from Code Owners" 不会生效。

### 第 3 步：打开 GitHub 分支保护

Settings → Branches → `main` 规则：
- ✅ Require a pull request before merging（1 approval）
- ✅ Require review from Code Owners
- ✅ Dismiss stale pull request approvals when new commits are pushed
- ✅ Require status checks：`规范检查`、`类型检查`、`测试`、`生成物一致性`、`构建校验`
- ✅ Require conversation resolution
- ✅ Require linear history

### 第 4 步：在周会上讲清一条规则

> **"PR 超过 400 行，作者有义务说明理由或拆分。"**

**不要一次性推行全部条款。** 落地节奏见 [`06`](./06-落地推行计划.md)。

---

## 术语表

| 术语 | 含义 |
| --- | --- |
| **有效 diff** | 排除 `**/index.css`、`pnpm-lock.yaml`、`docs/.vitepress/**` 后的代码行数 |
| **Code Owner** | 由 `.github/CODEOWNERS` 指定的模块负责人，其批准对该模块强制 |
| **L0–L3** | 变更风险等级，决定审查人数与 SLA |
| **Blocker / Major / Minor / Nit** | 评审意见的四个严重级别 |
| **静默失效** | 不报错、不告警，但样式/事件/数据实际未生效的缺陷（本库头号风险） |
| **回归网** | `test/*-regression.test.ts`，每份对应一类已修复的真实缺陷 |
| **MTS** | Main Thread Script，本库**明令禁止**使用（见 `CONVENTIONS.md` §10） |
| **RFC** | 设计评审文档，L3 变更在写代码前先达成共识 |
