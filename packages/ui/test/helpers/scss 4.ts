/**
 * scss.ts — 测试内 SCSS 编译统一入口。
 *
 * 背景：域包拆分后（ADR-023），组件 SCSS 的主题依赖从相对路径
 * `@use '../../styles/variable.scss'` 改为 load-path 式
 * `@use 'styles/variable.scss'`——`styles/` 住在 `@wot-lynx/core` 里，
 * 跨包不能写相对路径。因此任何在测试里编译组件 SCSS 的场景都必须
 * 配置 loadPaths，与 `scripts/build-css.mjs` 的口径一致。
 *
 * 用法：
 *   import { compileScss } from '../helpers/scss'
 *   const css = compileScss(compPath('wd-button', 'index.scss'))
 */
import { compile, type StringOptions } from 'sass'
import { join } from 'node:path'
import { COMPONENT_ROOTS } from './component-roots'

const REPO_ROOT = join(__dirname, '..', '..', '..', '..')

/** loadPaths：全部组件包的 src + core 的 src（styles 的唯一住处） */
const LOAD_PATHS = [
  ...new Set(
    COMPONENT_ROOTS.map((r) => r.dir).concat([join(REPO_ROOT, 'packages', 'core', 'src')])
  )
]

/**
 * 编译 SCSS 入口，返回 CSS 文本。
 * 默认 expanded——多数回归断言的是选择器/声明结构，压缩不影响匹配，
 * 且 expanded 的报错信息带行列。
 */
export function compileScss(absPath: string, options: StringOptions<'sync'> = {}): string {
  return compile(absPath, { style: 'expanded', loadPaths: LOAD_PATHS, ...options }).css
}
