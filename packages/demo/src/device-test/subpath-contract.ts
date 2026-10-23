/**
 * exports 子路径契约探针。
 *
 * ## 为什么需要它
 *
 * `package.json` 的 `exports` 声明了三类入口，但 demo 只用了 `"."`（barrel）：
 *
 *   "."               ← 全库导入，被 App.vue / device-test 使用
 *   "./primitives/*"  ← 无任何消费者
 *   "./components/*"  ← 无任何消费者
 *
 * 后两者一旦写错，`pnpm build:demo` 依然绿灯。2026-10-23 的实测：
 * `"./components/*": { "source": "./src/components/*" }` 代入 `wd-tag` 得到的是
 * **一个目录**，真实消费时 Rspeedy 走 source 条件会报
 * `ERR_UNSUPPORTED_DIR_IMPORT` —— 而 demo 构建完全正常，因为它压根没走这条路径。
 *
 * ## 它做什么
 *
 * 显式经子路径导入两个组件（一个基础件、一个业务组件），使每次
 * `pnpm build:demo` 都真实解析一遍这两条映射。这里不参与渲染，只要求「能解析」：
 * 解析失败则构建失败，缺陷在 PR 阶段暴露，而不是等消费者报 bug。
 *
 * ## 维护
 *
 * - 新增组件根（如 `./patterns/*`）时，应同步在此加一条导入。
 * - 删除某个组件时，若它被这里引用，构建会立刻报错 —— 这正是想要的效果。
 */
import WdButton from 'wot-lynx-ui/primitives/wd-button'
import WdTag from 'wot-lynx-ui/components/wd-tag'

/**
 * 被引用的组件集合。仅用于让打包器保留解析结果，不参与渲染。
 */
export const subpathContractProbe = [WdButton, WdTag]
