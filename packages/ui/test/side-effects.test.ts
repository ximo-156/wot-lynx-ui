/**
 * sideEffects 字段回归测试（ADR-007，2026-10-23 修订）。
 *
 * 契约有两个方向，缺一不可：
 *
 * 1. **不得为 `true`。** `true` 意味着整个包任何模块都被视为有副作用，
 *    tree-shaking 完全失效——`import { WdButton } from 'wot-lynx-ui'`
 *    会把全部 106 个组件打进产物。这正是修订前的状态。
 *
 * 2. **必须保留组件样式副作用导入。** 每个组件脚本首行都是
 *    `import './index.css'`（CONVENTIONS §2 的样式 funnel 终点）。
 *    若 sideEffects 收窄后没有任何模式能匹配 index.css，该导入会被
 *    tree-shake 掉，组件样式全部丢失——比 tree-shaking 失效更致命。
 *
 * 因此断言方式是「glob 语义匹配」而不是写死具体模式：
 * 换成任何等价模式（如根级通配配合双星通配）都应通过，
 * 而漏掉 css 或退化为 `false` / `true` 都必须失败。
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'

/** 把 webpack 语义的包内 glob 转成可匹配路径的正则（支持 `**` `*` `?`） */
function globToRegExp(glob: string): RegExp {
  const DS_SLASH = '\u0000'
  const DS = '\u0001'
  const STAR = '\u0002'
  const QUESTION = '\u0003'
  // 先把 glob 元字符换成占位符，避免后续替换把正则自身的 * ? 也吃掉
  let re = glob
    .replace(/\*\*\//g, DS_SLASH)
    .replace(/\*\*/g, DS)
    .replace(/\*/g, STAR)
    .replace(/\?/g, QUESTION)
  re = re.replace(/[.+^${}()|[\]\\]/g, '\\$&') // 转义正则元字符（* ? 已是占位符）
  re = re
    .replace(new RegExp(DS_SLASH, 'g'), '(?:.*/)?') // `**/` → 任意层目录（含 0 层）
    .replace(new RegExp(DS, 'g'), '.*') //            `**`  → 任意字符
    .replace(new RegExp(STAR, 'g'), '[^/]*') //        `*`   → 单层内任意字符
    .replace(new RegExp(QUESTION, 'g'), '[^/]') //     `?`   → 单字符
  // 锚定包内相对路径起点（webpack 以 package.json 所在目录为根匹配）
  return new RegExp(`^(?:\\./)?${re}$`)
}

/** 组件的样式副作用导入（两个组件根各取一个代表） */
const CSS_REQUESTS = [
  'src/primitives/wd-cell/index.css',
  'src/components/wd-button/index.css',
  'src/components/wd-calendar-view/monthPanel/index.css'
]
/** 必须保持可 tree-shake 的模块（脚本与 barrel） */
const SHAKEABLE = ['src/index.ts', 'src/components/wd-button/wd-button.vue']

describe('package.json sideEffects', () => {
  const pkgPath = path.resolve(__dirname, '..', 'package.json')
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
  const patterns: string[] = Array.isArray(pkg.sideEffects)
    ? pkg.sideEffects
    : pkg.sideEffects === false
      ? []
      : [pkg.sideEffects]

  it('不得为 true（否则 import 单个组件会拉入全部 106 个组件）', () => {
    expect(pkg.sideEffects).not.toBe(true)
  })

  it('必须是数组（false 会丢样式，true 会丢 tree-shaking）', () => {
    expect(Array.isArray(pkg.sideEffects)).toBe(true)
  })

  it.each(CSS_REQUESTS)('保留样式副作用导入：%s', (request) => {
    const kept = patterns.some((pattern) => globToRegExp(pattern).test(request))
    expect(kept, `没有任何 sideEffects 模式匹配 ${request}，组件样式会被 tree-shake 掉`).toBe(true)
  })

  it.each(SHAKEABLE)('脚本模块仍可被 tree-shake：%s', (request) => {
    const blocked = patterns.some((pattern) => globToRegExp(pattern).test(request))
    expect(blocked, `${request} 被 sideEffects 命中，tree-shaking 会失效`).toBe(false)
  })
})
