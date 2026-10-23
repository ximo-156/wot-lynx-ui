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

/**
 * 用**根相对**模式（`/src/...`）而不是相对模式：`import.meta.glob` 的相对模式
 * 是相对当前文件解析的，文件在 `test/unit/` 时要写两层 `..` 才能到包根；一旦
 * 目录层级变动，模式会静默匹配 0 个文件（不报错，整组用例空转）。根相对模式
 * 以 vitest root（`packages/ui`）为基准，与测试文件放哪一层无关。
 */
const modules = import.meta.glob<{ default: LocaleTree }>('/src/locale/lang/*.ts', { eager: true })

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
/**
 * 基准语言包：按**后缀**定位而不是写死相对路径。
 *
 * glob 的 key 是相对当前文件的路径，本文件位于 `test/unit/`，写死
 * `'../../src/locale/lang/zh-CN.ts'` 会在目录层级变动时静默失配
 * （`modules[undefined].default` → TypeError，测试直接炸在 collect 阶段）。
 * 后缀匹配对层级免疫，且找不到时下面的断言会明确报错。
 */
const BASE_FILE = localeFiles.find((file) => file.endsWith('/zh-CN.ts'))

describe('语言包契约', () => {
  it('能定位到基准语言包 zh-CN（防止 glob key 形态变化后整组用例空转）', () => {
    expect(BASE_FILE, `未在 glob 结果里找到 zh-CN：${localeFiles.join(', ')}`).toBeTruthy()
  })

  // 找不到基准包时不要在这里抛：describe 体内抛错会让整组用例「加载失败」，
  // 真正的原因（glob key 形态变了）被埋在栈里。交给下面的守卫用例报。
  const base = BASE_FILE ? flatten(modules[BASE_FILE].default) : new Map<string, LocaleLeaf>()

  it('至少加载到 16 个语言包（防止 glob 失效后测试空跑通过）', () => {
    expect(localeFiles.length).toBeGreaterThanOrEqual(16)
    expect(base.size).toBeGreaterThan(50)
  })

  for (const file of localeFiles) {
    if (file === BASE_FILE) continue
    const name = file.replace(/^.*\/locale\/lang\//, '').replace('.ts', '')
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
