/**
 * sideEffects 字段回归测试。
 *
 * 背景：每个组件脚本的第一行都是 `import './index.css'`（样式副作用导入）。
 * 若 package.json 将 sideEffects 收窄为 ["*.scss", "*.css"] 之类的白名单，
 * rspack 会把 src/index.ts 及全部组件模块判定为无副作用，CSS 导入被
 * tree-shake 掉，组件样式全部丢失。
 *
 * 历史上该字段还承担过 Main Thread Script（registerWorkletInternal 副作用）
 * 的保障职责；MTS 因跨线程兼容性问题已从组件库移除（见 CONVENTIONS.md §9），
 * 但 CSS 副作用导入仍需该字段保持 true。
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'

describe('package.json sideEffects', () => {
  it('必须为 true，保证组件 index.css 副作用导入不被 tree-shake', () => {
    const pkgPath = path.resolve(__dirname, '..', 'package.json')
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
    expect(pkg.sideEffects).toBe(true)
  })
})
