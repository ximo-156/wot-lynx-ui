/**
 * 语言包契约校验（ARCHITECTURE §3.8）。
 *
 * 约束两件事：
 *   1. **key 集合与 zh-CN 完全一致**——缺 key 会静默回退到中文（用户看到混排），
 *      多余 key 说明该语言包已经和基准脱节（翻译在维护，但组件侧已不用）。
 *   2. **同名 key 的取值类型一致**——`weekFormat` / `monthFormat` 这类是函数，
 *      若某语言包写成字符串，调用点会直接 TypeError（真机整卡崩溃），
 *      静态类型在语言包按 Record 分发时兜不住。
 *
 * 纯数据断言，不依赖双线程渲染环境。
 */
import { describe, it, expect } from 'vitest'

/**
 * 叶子值：字符串，或带参数的格式化函数（如 weekFormat(year, week)）。
 * 参数类型用 `never[]` 而不是 `any[]`：它同时满足「任意具体签名的函数都能赋值」
 * 与「禁止 any」（CONVENTIONS §F）两条约束。
 */
type LocaleLeaf = string | ((...args: never[]) => string)
type LocaleTree = { [key: string]: LocaleLeaf | LocaleTree }

const modules = import.meta.glob<{ default: LocaleTree }>('../../src/locale/lang/*.ts', { eager: true })

/** 展平为 `a.b.c` → 叶子值 */
function flatten(tree: LocaleTree, prefix = ''): Map<string, LocaleLeaf> {
  const out = new Map<string, LocaleLeaf>()
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key
    if (value && typeof value === 'object') {
      for (const [k, v] of flatten(value as LocaleTree, path)) out.set(k, v)
    } else {
      out.set(path, value as LocaleLeaf)
    }
  }
  return out
}

const localeFiles = Object.keys(modules).sort()
const BASE_FILE = '../src/locale/lang/zh-CN.ts'

describe('语言包契约', () => {
  const base = flatten(modules[BASE_FILE].default)

  it('至少加载到 16 个语言包（防止 glob 失效后测试空跑通过）', () => {
    expect(localeFiles.length).toBeGreaterThanOrEqual(16)
    expect(base.size).toBeGreaterThan(50)
  })

  for (const file of localeFiles) {
    if (file === BASE_FILE) continue
    const name = file.replace('../src/locale/lang/', '').replace('.ts', '')
    const current = flatten(modules[file].default)

    it(`${name} 的 key 集合与 zh-CN 一致`, () => {
      const missing = [...base.keys()].filter((key) => !current.has(key))
      const extra = [...current.keys()].filter((key) => !base.has(key))
      expect({ missing, extra }).toEqual({ missing: [], extra: [] })
    })

    it(`${name} 的取值类型与 zh-CN 一致`, () => {
      const mismatched = [...base.entries()]
        .filter(([key]) => current.has(key))
        .filter(([key, value]) => typeof current.get(key) !== typeof value)
        .map(([key, value]) => `${key}: zh-CN=${typeof value}, ${name}=${typeof current.get(key)}`)
      expect(mismatched).toEqual([])
    })
  }
})
