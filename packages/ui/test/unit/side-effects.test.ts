/**
 * sideEffects 字段回归测试（ADR-007，2026-10-23 修订；2026-11-11 域包拆分后改清单驱动）。
 *
 * 契约有两个方向，缺一不可：
 *
 * 1. **不得为 `true`。** `true` 意味着整个包任何模块都被视为有副作用，
 *    tree-shaking 完全失效——`import { WdButton } from 'wot-lynx-ui'`
 *    会把全部组件打进产物。这正是修订前的状态。
 *
 * 2. **必须保留组件样式副作用导入。** 每个组件脚本首行都是
 *    `import './index.css'`（CONVENTIONS §2 的样式 funnel 终点）。
 *    若 sideEffects 收窄后没有任何模式能匹配 index.css，该导入会被
 *    tree-shake 掉，组件样式全部丢失——比 tree-shaking 失效更致命。
 *
 * 域包拆分后，样式副作用契约落在**每个组件包自己的 package.json** 上
 * （包内相对路径以该包 package.json 为根）。因此这里按
 * `docs/architecture/packages.json` 逐包校验，而不是只查门面包。
 *
 * 断言方式是「glob 语义匹配」而不是写死具体模式：
 * 换成任何等价模式（如根级通配配合双星通配）都应通过，
 * 而漏掉 css 或退化为 `false` / `true` 都必须失败。
 */
import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { ALL_PACKAGES, COMPONENT_ROOTS } from '../helpers/component-roots'

/** 清单里已声明但尚未落地的包（拆分过渡期）不参与校验 */
const READY_ROOTS = COMPONENT_ROOTS.filter((root) => existsSync(path.join(root.pkgDir, 'package.json')))

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

function patternsOf(pkgDir: string): string[] {
  const pkg = JSON.parse(readFileSync(path.join(pkgDir, 'package.json'), 'utf8'))
  if (Array.isArray(pkg.sideEffects)) return pkg.sideEffects
  if (pkg.sideEffects === false) return []
  return [pkg.sideEffects]
}

/** 递归收集目录下所有指定文件，返回相对 pkgDir 的 POSIX 路径 */
function collectRel(pkgDir: string, dir: string, match: (name: string) => boolean): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...collectRel(pkgDir, full, match))
    else if (match(entry)) out.push(path.relative(pkgDir, full).split(path.sep).join('/'))
  }
  return out
}

describe('package.json sideEffects', () => {
  it('组件包清单与落地产出一致（过渡期允许未建包）', () => {
    expect(READY_ROOTS.length).toBeGreaterThan(0)
  })

  it('每个组件包都声明了 sideEffects 且不为 true', () => {
    for (const root of READY_ROOTS) {
      const pkg = JSON.parse(readFileSync(path.join(root.pkgDir, 'package.json'), 'utf8'))
      expect(pkg.sideEffects, `${root.pkg} 的 sideEffects`).not.toBe(true)
      expect(Array.isArray(pkg.sideEffects), `${root.pkg} 的 sideEffects 必须是数组`).toBe(true)
    }
  })

  it('每个包的全部组件 CSS 都被 sideEffects 保留（含嵌套子目录）', () => {
    for (const root of READY_ROOTS) {
      const patterns = patternsOf(root.pkgDir)
      const cssFiles = collectRel(root.pkgDir, root.dir, (name) => name === 'index.css')
      expect(cssFiles.length, `${root.pkg} 应至少有一个组件`).toBeGreaterThan(0)
      for (const request of cssFiles) {
        const kept = patterns.some((pattern) => globToRegExp(pattern).test(request))
        expect(kept, `${root.pkg}：没有任何 sideEffects 模式匹配 ${request}，组件样式会被 tree-shake 掉`).toBe(true)
      }
    }
  })

  it(' barrel 与组件 .vue 仍可被 tree-shake', () => {
    for (const root of READY_ROOTS) {
      const patterns = patternsOf(root.pkgDir)
      const shakeable = collectRel(root.pkgDir, root.dir, (name) => name.endsWith('.vue'))
      if (existsSync(path.join(root.pkgDir, 'src', 'index.ts'))) {
        shakeable.push('src/index.ts')
      }
      expect(shakeable.length).toBeGreaterThan(0)
      for (const request of shakeable) {
        const blocked = patterns.some((pattern) => globToRegExp(pattern).test(request))
        expect(blocked, `${root.pkg}：${request} 被 sideEffects 命中，tree-shaking 会失效`).toBe(false)
      }
    }
  })

  it('@wot-lynx/core 的字体与主题产物被 sideEffects 保留', () => {
    const coreRoot = ALL_PACKAGES.find((r) => r.pkg === '@wot-lynx/core')
    expect(coreRoot, '清单应声明 @wot-lynx/core').toBeDefined()
    const coreDir = coreRoot!.pkgDir
    const patterns = patternsOf(coreDir)
    const requests = collectRel(coreDir, path.join(coreDir, 'src'), (name) =>
      name.endsWith('.css') || name.endsWith('.ttf')
    )
    expect(requests.length).toBeGreaterThan(0)
    for (const request of requests) {
      const kept = patterns.some((pattern) => globToRegExp(pattern).test(request))
      expect(kept, `@wot-lynx/core：没有任何 sideEffects 模式匹配 ${request}`).toBe(true)
    }
  })
})
