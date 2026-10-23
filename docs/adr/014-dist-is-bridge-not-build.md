# ADR-014 `dist` 是入口桥接层，不是编译产物

- **状态**：已采纳（**取代 [ADR-007](./007-dual-distribution.md)**）
- **日期**：2026-10-23
- **相关**：`packages/ui/package.json`、`scripts/build-dist.mjs`、`scripts/check-exports.mjs`、`packages/demo/lynx.config.ts`、ADR-007

## 背景

ADR-007 的决策是「双轨分发，源码优先、产物兜底」，其表述为：

> 其他构建器走 `dist` 预构建 ESM + `.d.ts`。

2026-10-23 体检发现**这句话与代码不符**，且由此掩盖了三处真实缺陷。

### 事实一：`dist` 里没有任何编译产物

`scripts/build-dist.mjs` 产出的每个文件都只是一行 re-export：

```js
// dist/primitives/wd-button/index.mjs
export { default } from '../../../src/primitives/wd-button/wd-button.vue'
```

它不做 SFC 编译、不做 worklet 转换、不做 SCSS 编译。用裸 Node 消费的真实结果：

```
ERR_UNKNOWN_FILE_EXTENSION: Unknown file extension ".vue"
```

所以 `dist` 不是「兜底产物」，而是**让子路径可解析的垫片**——组件目录里没有
`index.ts`，`wot-lynx-ui/primitives/wd-button` 这个子路径必须落到一个具体文件上。

### 事实二：`exports` 的 `source` 子路径指向目录，主分发路径是坏的

原声明：

```jsonc
"./components/*": { "source": "./src/components/*", ... }
```

代入 `wd-tag` 得到 `./src/components/wd-tag` —— 一个**目录**，而该目录里没有
`index.ts`。Node 的 `PACKAGE_TARGET_RESOLVE` 对 exports 目标不做目录解析，
Rspeedy 走 `source` 条件时直接 `ERR_UNSUPPORTED_DIR_IMPORT`。

更隐蔽的是 `import.meta.resolve()` 对目录**也返回成功**（它不检查目标是否为文件），
所以「解析一下看看」这种手工验证同样抓不到。

### 事实三：demo 用别名绕开了整个 `exports` 映射

`packages/demo/lynx.config.ts` 里有：

```ts
alias: { 'wot-lynx-ui$': uiSrc('index.ts') }
```

理由写在注释里：「dist 只是源码桥接层，未预构建时整个 demo 编译不过」——理由成立，
但副作用是 **`package.json` 的 `exports` 从未被任何构建真实执行过**。上面的事实二
因此可以长期存在而无人发现。

### 事实四：`dist` 从不清理，迁移后留下僵尸入口

组件在 `src/primitives` 与 `src/components` 之间迁移（2026-10-23 整体迁过一次）后，
`build-dist.mjs` 不清空 `dist`，旧路径的垫片残留并指向已不存在的源码。
而原有 `check-exports --built` 只验「文件存在」，照样通过。

## 决策

### 1. `dist` 的定位改为「入口桥接层」，并如实描述

`build-dist.mjs` 头部、`ARCHITECTURE.md §6.1`、本 ADR 统一口径：`dist` 是**路径别名垫片**，
不是编译产物。能力边界写进文档：

| 消费者 | 结果 |
|---|---|
| 能编译 `.vue` 的打包器（Rspeedy / Vite + `@vitejs/plugin-vue` / webpack + `vue-loader`） | ✅ 顺着 re-export 找到源码并编译 |
| 裸 Node / SSR 直跑 | ❌ `ERR_UNKNOWN_FILE_EXTENSION` |

### 2. 构建前清空 `dist`

迁移/改名后旧垫片必须消失。清理由 `build-dist.mjs` 负责，不依赖人工。

### 3. `source` 子路径目标必须落到**文件**

```jsonc
"./components/*": { "source": "./src/components/*/*.vue", "import": "./dist/components/*/index.mjs" },
"./primitives/*": { "source": "./src/primitives/*/*.vue", "import": "./dist/primitives/*/index.mjs" }
```

依据：`PACKAGE_TARGET_RESOLVE` 对目标做 `*` **全量替换**（`/\*/g`），所以
`./src/components/*/*.vue` 代入 `wd-tag` 得到 `./src/components/wd-tag/wd-tag.vue`。
「目录名 == `.vue` 文件名」是本仓库 106/106 组件的既有约定（`gen-index.mjs` 已依赖它）。

未选择「给每个组件目录补 `index.ts`」的理由：94 个业务组件里只有 5 个（`wd-toast` /
`wd-dialog` / `wd-notify` / `wd-image-preview` / `wd-video-preview`）有 `index.ts`，
且都是**手写的命令式 API 实现**，不是样板文件。为剩余 89 个生成空壳 `index.ts`
会把「有逻辑的入口」和「纯转发入口」混成同一形态，收益不抵成本。

### 4. demo 必须走真实 `exports` 契约

- 删除 `'wot-lynx-ui$'` 别名，改为 `resolve.conditionNames` 追加 `'source'`
  （rspack 默认不含该条件，追加后才会命中 `exports` 的 `source` 分支；实测有效，
  且命中后 demo 直接编译 `src`，无需先 `build:ui`）。
- 保留 `'wot-lynx-ui/theme$'` 别名：`./theme` 的 source 目标是 `index.scss`，
  而 Rspeedy 未启用 `@rsbuild/plugin-sass`。
- 新增 `packages/demo/src/device-test/subpath-contract.ts`：显式经 `./primitives/*`
  与 `./components/*` 各导入一个组件。barrel 导入只覆盖 `"."`，子路径映射坏了
  构建照样绿灯——这一点已用负向验证证实（把 source 目标改回目录，demo 仍构建成功）。

### 5. 契约校验从「文件存在」升级为「目标可解析」

`scripts/check-exports.mjs` 增加两节：

- **第 4 节**：解析 `dist/**` 里每条 re-export 的 `from` 目标（按打包器语义补全
  扩展名），断言存在。抓「迁移后 dist 未重新生成」。
- **第 5 节**：把 `exports` 的每条通配符目标代入**真实条目名**，断言解析到**文件**。
  抓「目标指向目录」。

两节都做过负向验证：回退到目录目标时第 5 节准确报出「是目录」；
`dist` 残留 `wd-textarea` 时第 4 节准确报出「re-export 目标不存在」。

## 后果

- **能力边界明确**：本库不支持裸 Node / SSR 消费。需要时见推翻条件。
- **子路径能力不对称**：`wd-toast` 等 5 个组件在 `source` 路径下只暴露组件本体，
  在 `import`（dist）路径下额外暴露命令式 hook（因为 dist 垫片多一行
  `export * from '.../index.ts'`）。命令式 API 以 barrel 导出为准，子路径不保证。
- **`dist` 不入库**（`.gitignore`），本地 `pnpm dev` 前若删过 `dist` 需先 `pnpm build:ui`；
  demo 因走 `source` 条件不受影响。
- `check-exports.mjs` 的解析器需随新扩展名维护（`RESOLVE_EXTS`）。

## 推翻条件

- **需要 SSR / 裸 Node 消费**：必须引入真实编译产物（`vue-tsc` 产 `.d.ts` +
  Vite lib 模式产 `.mjs`），成本显著，且 Lynx 双线程运行时在 Node 下无意义，
  故当前不做。
- **Rspeedy 或主流打包器默认支持 `source` 条件**：可去掉 `dist` 与 `import` 分支，
  退回纯源码分发，`build-dist.mjs` 与第 4 节校验一并删除。
- **子路径开始被真实使用**：应把 5 个命令式组件的 `source` 目标改为指向其
  `index.ts`（通过显式条目），消除不对称。
