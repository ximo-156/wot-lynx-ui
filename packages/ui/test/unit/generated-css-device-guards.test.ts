/**
 * 生成 CSS 的真机守卫（静态扫描，不依赖浏览器）。
 *
 * 2026-11-08 真机反馈：级联选择器弹层只有两三个选项高、列表被裁。
 * 根因是 `calc(336 * var(--wot-n-1, 1px))`——运行时 var 参与 calc 乘法，
 * Lynx CSS 引擎求值失败会让整条 `height` 声明失效并回落到内容高度。
 *
 * 约定：`--wot-n-1` 恒为 1px（三套预设主题都不改写它），需要 N 倍时直接写
 * 像素值（如 336px），不要用 calc 乘法。
 */
import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'

const SRC = path.resolve(__dirname, '../../src')

function collectCss(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry)
    if (statSync(full).isDirectory()) collectCss(full, out)
    else if (entry.endsWith('.css')) out.push(full)
  }
  return out
}

describe('generated CSS device guards', () => {
  it('never multiplies a runtime design token inside calc()', () => {
    const violations: string[] = []
    for (const file of collectCss(SRC)) {
      const css = readFileSync(file, 'utf8')
      const matches = css.match(/calc\([^)]*\*\s*var\(--wot-n-[\w-]*/g)
      if (matches) violations.push(`${path.relative(SRC, file)}: ${matches.join(' ')}`)
    }
    expect(violations, 'calc 里出现运行时 var 乘法，真机上整条声明可能失效').toEqual([])
  })

  it('keeps a plain pixel fallback on the cascader list height', () => {
    const css = readFileSync(path.join(SRC, 'components/wd-cascader/index.css'), 'utf8')
    expect(css).toMatch(/\.wd-cascader__list\{height:var\(--wot-cascader-list-height,\s*336px\)/)
    expect(css).toMatch(/\.wd-cascader__panel\{position:relative;height:var\(--wot-cascader-list-height,\s*336px\)/)
  })
})
