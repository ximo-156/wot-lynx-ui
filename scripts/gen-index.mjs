#!/usr/bin/env node
/**
 * gen-index.mjs — 生成组件 barrel，消除「同一份组件清单维护两遍」。
 *
 * ## 背景
 *
 * 旧 `src/index.ts` 是 435 行手写文件，同一份组件清单出现了两遍（import 列表 +
 * 插件里的数组）。101 个组件全靠人工同步，漏一个就是「按需引入可用、全局注册
 * 不可用」的静默缺陷。
 *
 * 现在组件清单只在**文件系统**里定义一次，由本脚本产出两份 barrel：
 *
 * | 根 | 产物 | 层 |
 * |---|---|---|
 * | `src/primitives/wd-*` | `src/primitives/index.ts` | L3.5 基础件 |
 * | `src/components/wd-*` | `src/components/index.ts` | L4 业务组件 |
 *
 * 每份 barrel 含：组件默认导出、`<Pascal>Props` 类型导出、`all*` 注册清单。
 * 分层依据见 `docs/adr/012-primitives-layer.md`。
 *
 * ## 用法
 *
 *   node scripts/gen-index.mjs           # 写入文件
 *   node scripts/gen-index.mjs --check   # 只校验（CI 用），不一致则退出码 1
 *
 * 生成物不得手动编辑；新增组件后运行 `pnpm gen:index`。
 */
import { readdirSync, readFileSync, statSync, writeFileSync, existsSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import process from 'node:process'

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..')
const UI_SRC = join(ROOT, 'packages/ui/src')

/**
 * 两个组件根。顺序即全局注册顺序（基础件在前，业务组件在后）：
 * 基础件不依赖业务组件，先注册不会产生解析顺序问题。
 */
const ROOTS = [
  { key: 'primitives', dir: join(UI_SRC, 'primitives'), listName: 'allPrimitives', label: 'L3.5 基础件' },
  { key: 'components', dir: join(UI_SRC, 'components'), listName: 'allComponents', label: 'L4 业务组件' }
]

const checkOnly = process.argv.includes('--check')

/** wd-action-sheet → ActionSheet */
function toPascalCase(name) {
  return name
    .replace(/^wd-/, '')
    .split('-')
    .map((part) => (part ? part.charAt(0).toUpperCase() + part.slice(1) : part))
    .join('')
}

/** 收集组件：目录下必须同时存在 <dir>.vue 与 types.ts */
function collectComponents(dir) {
  if (!existsSync(dir)) return { components: [], problems: [] }

  const entries = readdirSync(dir)
    .filter((name) => {
      const full = join(dir, name)
      return statSync(full).isDirectory() && /^wd-/.test(name)
    })
    .sort()

  const components = []
  const problems = []
  const seen = new Map()

  for (const entry of entries) {
    const vueFile = join(dir, entry, `${entry}.vue`)
    const typesFile = join(dir, entry, 'types.ts')
    if (!existsSync(vueFile)) {
      problems.push(`${entry}/ 缺少 ${entry}.vue`)
      continue
    }
    if (!existsSync(typesFile)) {
      problems.push(`${entry}/ 缺少 types.ts`)
      continue
    }

    const pascal = toPascalCase(entry)
    if (seen.has(pascal)) {
      problems.push(`导出名冲突：${entry} 与 ${seen.get(pascal)} 都映射为 ${pascal}`)
      continue
    }
    seen.set(pascal, entry)

    const typesSrc = readFileSync(typesFile, 'utf8')
    const propsExport = new RegExp(`export\\s+(?:type|interface|const)\\s+${pascal}Props\\b`).test(typesSrc)

    components.push({ dir: entry, pascal, propsExport })
  }

  return { components, problems }
}

function render({ components, key, listName, label }) {
  const lines = []

  lines.push('/*')
  lines.push(' * ⚠️ 本文件由 scripts/gen-index.mjs 自动生成，请勿手动编辑。')
  lines.push(' *')
  lines.push(` * ${label}的清单单一来源：src/${key}/ 下的目录（含 <dir>.vue 与 types.ts）。`)
  lines.push(' * 新增 / 删除组件后运行：pnpm gen:index')
  lines.push(' */')
  lines.push('')

  for (const { dir, pascal } of components) {
    lines.push(`import ${pascal} from './${dir}/${dir}.vue'`)
  }
  lines.push('')

  lines.push('export {')
  for (const { pascal } of components) {
    lines.push(`  ${pascal},`)
  }
  lines.push('}')
  lines.push('')

  const withProps = components.filter((c) => c.propsExport)
  for (const { dir, pascal } of withProps) {
    lines.push(`export type { ${pascal}Props } from './${dir}/types'`)
  }
  lines.push('')

  lines.push(`/** ${label}清单（供 createApp().use(wotLynxUI) 全局注册使用） */`)
  lines.push(`export const ${listName} = [`)
  for (const { pascal } of components) {
    lines.push(`  ${pascal},`)
  }
  lines.push(']')
  lines.push('')

  return lines.join('\n')
}

function main() {
  const results = []
  const allProblems = []

  for (const root of ROOTS) {
    const { components, problems } = collectComponents(root.dir)
    allProblems.push(...problems)
    results.push({ ...root, components, output: join(root.dir, 'index.ts') })
  }

  if (allProblems.length) {
    console.error('✖ 组件结构校验失败：')
    for (const p of allProblems) console.error(`   - ${p}`)
    process.exit(1)
  }

  const total = results.reduce((n, r) => n + r.components.length, 0)
  if (total === 0) {
    console.error('✖ 未收集到任何组件')
    process.exit(1)
  }

  // 跨根导出名冲突检查（两份 barrel 会被 src/index.ts 同时 export *）
  const seen = new Map()
  for (const r of results) {
    for (const c of r.components) {
      if (seen.has(c.pascal)) {
        console.error(`✖ 跨根导出名冲突：${c.dir} 与 ${seen.get(c.pascal)} 都映射为 ${c.pascal}`)
        process.exit(1)
      }
      seen.set(c.pascal, c.dir)
    }
  }

  const plans = results.map((r) => ({ ...r, next: render(r) }))
  const stale = plans.filter((p) => {
    const current = existsSync(p.output) ? readFileSync(p.output, 'utf8') : null
    return current !== p.next
  })

  if (checkOnly) {
    if (stale.length === 0) {
      const detail = plans.map((p) => `${p.key} ${p.components.length}`).join(' / ')
      console.log(`✅ barrel 与组件目录一致（${detail}，共 ${total} 个组件）`)
      process.exit(0)
    }
    for (const p of stale) {
      console.error(`✖ ${relative(ROOT, p.output)} 与组件目录不一致。`)
    }
    console.error('  可能原因：手改了生成物，或新增/删除了组件但未运行 pnpm gen:index')
    process.exit(1)
  }

  if (stale.length === 0) {
    const detail = plans.map((p) => `${p.key} ${p.components.length}`).join(' / ')
    console.log(`ℹ️  barrel 已是最新（${detail}，共 ${total} 个组件）`)
    process.exit(0)
  }

  for (const p of stale) {
    writeFileSync(p.output, p.next)
    console.log(`✅ 已生成 ${relative(ROOT, p.output)}：${p.components.length} 个（${p.label}）`)
  }
}

main()
