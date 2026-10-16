&lt;!--
  提交前请确认：CI 全绿 / 自评风险等级 / 有效 diff ≤ 400 行
  完整规范见 contributing/code-review/ 目录
--&gt;

## 变更说明

&lt;!-- 这个 PR 做了什么？为什么做？对照需求或 Issue 描述。 --&gt;

关联 Issue：

## 风险等级（必填）

&lt;!-- 判定口诀：改跨组件契约/令牌/事件机制/依赖版本 → L3；触及 common/composables/styles/icons/index.ts → L2；影响运行时行为 → L1；仅注释文档 → L0 --&gt;

- [ ] **L0** 极低（注释 / README / 格式化）
- [ ] **L1** 常规（单组件模板、样式、逻辑）
- [ ] **L2** 较高（`common/` `composables/` `styles/tokens/` `icons/` `index.ts` `lynx.config`，或 props 契约变更）
- [ ] **L3** 高风险（令牌体系 / 事件机制 / 弹层结构 / `vue-lynx` 升级）

&gt; L3 必须**先有 RFC**（Issue 或 `docs/rfc/*.md`），否则本 PR 将被打回。

## 变更类型

- [ ] 新增组件
- [ ] 组件功能 / 样式调整
- [ ] 公共模块（`common/` `composables/` `styles/` `icons/`）
- [ ] 事件机制相关（`@tap` / `@touchmove` / emits 声明 / `wd-transition` 根链）
- [ ] 依赖升级
- [ ] 文档 / 演示
- [ ] 其他：

## 有效 diff 规模

&lt;!-- 有效 diff = git diff --stat 总行数 − index.css − pnpm-lock.yaml − docs/.vitepress/** --&gt;

- 有效 diff 行数：____
- [ ] ≤ 400 行
- [ ] &gt; 400 行，原因如下（必须说明，或拆分）：

## 作者自审清单

### 规范符合性（`CONVENTIONS.md`）

- [ ] 无字符串 `:style`，内联样式均为对象语法（§19）
- [ ] 状态类名与 CSS 选择器一致：已 `pnpm build:css` 后 grep 产物核对（§5.5）
- [ ] 依赖横向排列的容器已显式 `display: flex`（§15）
- [ ] 无 `::before/::after` / `!important` / `:deep()` / `inline-flex`（§5.4）
- [ ] 无 `box-shadow`（§3）
- [ ] import 一律来自 `'vue-lynx'`；`import './index.css'` 在 `<script setup>` 第一行（§4）
- [ ] 无 `<style>` 块；顶层注释中无 `<xxx>` 标签形式（§4）
- [ ] 未手改 `index.css`（§2）
- [ ] `common/` 与 `composables/` 未反向 import 组件（§7）
- [ ] 未引入 Main Thread Script（§10）
- [ ] SVG content 仅用白名单元素：`svg/g/path/rect/circle/polyline`（§8）

### 事件相关（如涉及，**必须**全部勾选）

- [ ] 裸 view 上无 `@click`，一律 `@tap`（§14）
- [ ] 给组件绑的事件名已在其 `defineEmits` 中声明（§14）
- [ ] 未给包裹层组件补绑 `@touchmove="noop"`（§14）
- [ ] 父组件读子组件 props 走 `toRaw`（§13）
- [ ] 四份事件回归测试全绿
- [ ] 关闭行为断言用 `fireEvent.tap`，**未用** `fireEvent.click`（假绿）

### 性能（如涉及交互）

- [ ] `touchmove` 热路径无 `getRect`，度量为一次性 + 缓存（§16）
- [ ] 按压缩态用 CSS `:active`，非 JS state（§17）

## 验证记录（必填，请粘贴命令输出）

```bash
pnpm --filter wot-lynx-ui run typecheck   # 必须 0 错误
pnpm --filter wot-lynx-ui run test
pnpm build:css
pnpm build:demo
```

&lt;details&gt;
&lt;summary&gt;展开查看输出&lt;/summary&gt;

```
（粘贴输出）
```

&lt;/details&gt;

- [ ] `typecheck` 0 错误
- [ ] 全部测试通过
- [ ] `build:css` 成功且 `index.css` 与 `index.scss` 一致
- [ ] 双端 `build` 成功

## 新增组件（如适用，缺一即需补充）

- [ ] `types.ts` — props 与 wot-ui 2.3.2 对齐
- [ ] `wd-xxx.vue` — 含 Lynx 实现说明注释
- [ ] `index.scss` — 消费 `--wd-*` 令牌
- [ ] `index.css` — 由 `build:css` 生成
- [ ] `packages/ui/src/index.ts` 已导出
- [ ] `packages/demo/src/App.vue` 已加演示用例（§11）
- [ ] 测试文件已添加
- [ ] 涉及图标已确认取自内置 180 个 iconfont 集合（§8）

## 回归测试影响

- [ ] 本 PR **未**修改任何 `test/*-regression.test.ts`
- [ ] 已修改，且说明理由（修改回归测试需在描述中论证，弱化断言属 Blocker）：

## 视觉 / 真机验证

- [ ] 涉及布局改动，已用 `__web_preview` 截图核对
- [ ] L3 改动已附**真机**验证截图或录屏

&lt;!-- 截图/录屏 --&gt;

## Reviewer 提示

&lt;!-- 希望评审者重点关注什么？哪些地方你不太确定？ --&gt;
