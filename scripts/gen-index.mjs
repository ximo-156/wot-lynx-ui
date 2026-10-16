#!/usr/bin/env node
/**
 * gen-index.mjs — 生成组件 barrel，消除「同一份组件清单维护两遍」。
 *
 * 背景（架构文档 §1.5 P0）：
 *   旧 `src/index.ts` 是 435 行手写文件，同一份组件清单出现了两遍 ——
 *   一遍是 `import X from './components/wd-x/wd-x.vue'`，另一遍是插件里
 *   的 `const components = [X, ...]` 数组。101 个组件全靠人工同步，
 *   漏一个就是「按需引入可用、全局注册不可用」的静默缺陷。
 *
 * 现在组件清单只在**文件系统**里定义一次，由本脚本产出
 * `packages/ui/src/components/index.ts`：
 *   - 组件默认导出（导出名 = 去掉 `wd-` 前缀后的 PascalCase）
 *   - `<Pascal>Props` 类型导出（各组件 types.ts 均已提供）
 *   - `allComponents` 清单（供 `createApp().use(wotLynxUI)` 全局注册）
 *
 * 用法：
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
const COMPONENTS_DIR = join(ROOT, 'packages/ui/src/components')
const OUTPUT = join(COMPONENTS_DIR, 'index.ts')
const REL_OUTPUT = relative(ROOT, OUTPUT)

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
function collectComponents() {
  const entries = readdirSync(COMPONENTS_DIR)
    .filter((name) => {
      const full = join(COMPONENTS_DIR, name)
      return statSync(full).isDirectory() && /^wd-/.test(name)
    })
    .sort()

  const components = []
  const problems = []
  const seen = new Map()

  for (const dir of entries) {
    const vueFile = join(COMPONENTS_DIR, dir, `${dir}.vue`)
    const typesFile = join(COMPONENTS_DIR, dir, 'types.ts')
    if (!existsSync(vueFile)) {
      problems.push(`${dir}/ 缺少 ${dir}.vue`)
      continue
    }
    if (!existsSync(typesFile)) {
      problems.push(`${dir}/ 缺少 types.ts`)
      continue
    }

    const pascal = toPascalCase(dir)
    if (seen.has(pascal)) {
      problems.push(`导出名冲突：${dir} 与 ${seen.get(pascal)} 都映射为 ${pascal}`)
      continue
    }
    seen.set(pascal, dir)

    const typesSrc = readFileSync(typesFile, 'utf8')
    const propsExport = new RegExp(`export\\s+(?:type|interface|const)\\s+${pascal}Props\\b`).test(typesSrc)

    components.push({ dir, pascal, propsExport })
  }

  return { components, problems }
}

function render(components) {
  const lines = []

  lines.push('/*')
  lines.push(' * ⚠️ 本文件由 scripts/gen-index.mjs 自动生成，请勿手动编辑。')
  lines.push(' *')
  lines.push(' * 新增 / 删除组件后运行：pnpm gen:index')
  lines.push(' * 组件清单的单一来源是 src/components/ 下的目录（含 <dir>.vue 与 types.ts）。')
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

  lines.push('/** 全部组件清单（供 createApp().use(wotLynxUI) 全局注册使用） */')
  lines.push('export const allComponents = [')
  for (const { pascal } of components) {
    lines.push(`  ${pascal},`)
  }
  lines.push(']')
  lines.push('')

  return lines.join('\n')
}

function main() {
  if (!existsSync(COMPONENTS_DIR)) {
    console.error(`✖ 组件目录不存在：${relative(ROOT, COMPONENTS_DIR)}`)
    process.exit(1)
  }

  const { components, problems } = collectComponents()

  if (problems.length) {
    console.error('✖ 组件结构校验失败：')
    for (const p of problems) console.error(`   - ${p}`)
    process.exit(1)
  }

  if (components.length === 0) {
    console.error('✖ 未收集到任何组件')
    process.exit(1)
  }

  const next = render(components)
  const current = existsSync(OUTPUT) ? readFileSync(OUTPUT, 'utf8') : null

  if (checkOnly) {
    if (current === next) {
      console.log(`✅ ${REL_OUTPUT} 与组件目录一致（${components.length} 个组件）`)
      process.exit(0)
    }
    console.error(`✖ ${REL_OUTPUT} 与组件目录不一致。`)
    console.error('  可能原因：手改了生成物，或新增/删除了组件但未运行 pnpm gen:index')
    process.exit(1)
  }

  if (current === next) {
    console.log(`ℹ️  ${REL_OUTPUT} 已是最新（${components.length} 个组件）`)
    process.exit(0)
  }

  writeFileSync(OUTPUT, next)
  console.log(`✅ 已生成 ${REL_OUTPUT}：${components.length} 个组件（${components.filter((c) => c.propsExport).length} 个含 Props 类型导出）`)
}

main()
