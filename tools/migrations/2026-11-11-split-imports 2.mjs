#!/usr/bin/env node
/**
 * 一次性迁移脚本（2026-11-11，ADR-023 域包拆分 Phase 1）。
 *
 * 把 `@wot-lynx/core`（common/composables/icons/locale/styles）与
 * `@wot-lynx/primitives`（24 基础件）从 packages/ui 拆出后的 import 说明符
 * 与 SCSS `@use` 路径改写为包名 / load-path 形式。
 *
 * 只做**可证明等价**的文本改写：
 *   - import 说明符：相对路径 → 包名（解析目标由 exports map 保证一致）
 *   - SCSS @use：`../../styles/x` → `styles/x`（由 build-css 的 loadPaths 解析）
 *
 * 不做（留给定向编辑/后续 phase）：
 *   - 测试里的文件系统路径字符串（path.resolve / readFileSync / import.meta.glob）
 *   - 业务组件迁入域包（Phase 2）
 *   - 各 scripts/*.mjs 的路径假设
 *
 * 用法：node tools/migrations/2026-11-11-split-imports.mjs [--write]
 * 默认 dry-run，只打印将改动的文件与行数。
 */
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import process from 'node:process'

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..')
const write = process.argv.includes('--write')

const SKIP = new Set(['node_modules', '.git', 'dist', 'coverage', '.wot-ref'])

function walk(dir, out = []) {
  if (!statSync(dir, { throwIfNoEntry: false })) return out
  for (const entry of readdirSync(dir)) {
    if (SKIP.has(entry)) continue
    const full = join(dir, entry)
    const st = statSync(full)
    if (st.isDirectory()) walk(full, out)
    else if (/\.(ts|vue|mjs|js|scss)$/.test(entry)) out.push(full)
  }
  return out
}

/**
 * 规则表。[scope] 是目录前缀；pattern/replacement 作用于整行文本。
 * 顺序即优先级（前面的规则先应用，避免前缀互相吃掉）。
 */
const RULES = [
  // ---- packages/primitives/src：同包 sibling + 中立层 ----
  {
    scope: 'packages/primitives/src',
    pattern: /(['"])\.\.\/\.\.\/primitives\//g,
    replacement: "$1../",
    note: 'primitives 内跨根 sibling → 同包相对'
  },
  {
    scope: 'packages/primitives/src',
    pattern: /(['"])\.\.\/\.\.\/(common|composables|icons|locale)\//g,
    replacement: "$1@wot-lynx/core/$2/",
    note: 'primitives → core 中立层'
  },
  // ---- packages/ui/src：业务组件 + 门面 ----
  {
    scope: 'packages/ui/src/index.ts',
    pattern: /(['"])\.\/(common|composables|icons|locale)\//g,
    replacement: "$1@wot-lynx/core/$2/",
    note: '门面 → core 中立层'
  },
  {
    scope: 'packages/ui/src/index.ts',
    pattern: /(['"])\.\/locale(['"])/g,
    replacement: '$1@wot-lynx/core/locale$2',
    note: '门面 → core locale'
  },
  {
    scope: 'packages/ui/src/index.ts',
    pattern: /(['"])\.\/primitives(\/|['"])/g,
    replacement: '$1@wot-lynx/primitives$2',
    note: '门面 → primitives 包'
  },
  {
    scope: 'packages/ui/src/components',
    pattern: /(['"])\.\.\/\.\.\/primitives\//g,
    replacement: '$1@wot-lynx/primitives/',
    note: '业务 → primitives 包'
  },
  {
    scope: 'packages/ui/src/components',
    pattern: /(['"])\.\.\/\.\.\/(common|composables|icons|locale)\//g,
    replacement: "$1@wot-lynx/core/$2/",
    note: '业务 → core 中立层'
  },
  // ---- packages/ui/test：测试 import ----
  {
    scope: 'packages/ui/test',
    pattern: /(['"])\.\.\/\.\.\/src\/primitives\//g,
    replacement: '$1@wot-lynx/primitives/',
    note: 'test → primitives 包'
  },
  {
    scope: 'packages/ui/test',
    pattern: /(['"])\.\.\/\.\.\/src\/(common|composables|icons|locale|styles)\//g,
    replacement: '$1@wot-lynx/core/$2/',
    note: 'test → core 中立层'
  },
  // ---- demo / docs：包名子路径 ----
  {
    scope: 'packages/demo/src',
    pattern: /(['"])wot-lynx-ui\/primitives\//g,
    replacement: '$1@wot-lynx/primitives/',
    note: 'demo 探针 → primitives 包'
  },
  {
    scope: 'docs/.vitepress',
    pattern: /(['"])wot-lynx-ui\/primitives\//g,
    replacement: '$1@wot-lynx/primitives/',
    note: 'docs demo → primitives 包'
  },
  {
    scope: 'docs/.vitepress',
    pattern: /(['"])\.\.\/\.\.\/\.\.\/packages\/ui\/src\/(common|composables)\//g,
    replacement: '$1../../../packages/core/src/$2/',
    note: 'docs 主题 → core 源码路径'
  },
  // ---- 门面插件：字体目录随 icons 迁至 core ----
  {
    scope: 'packages/ui/plugin',
    pattern: /(['"])\.\.\/src\/icons\//g,
    replacement: '$1../core/src/icons/',
    note: 'web-fonts 插件 → core 字体目录'
  },
  // ---- SCSS：styles 改 load-path 式（build-css 配置 loadPaths）----
  {
    scope: 'packages/primitives/src',
    pattern: /@use\s+'(?:\.\.\/)+styles\//g,
    replacement: "@use 'styles/",
    note: 'primitives SCSS → load-path'
  },
  {
    scope: 'packages/ui/src',
    pattern: /@use\s+'(?:\.\.\/)+styles\//g,
    replacement: "@use 'styles/",
    note: 'ui SCSS → load-path'
  }
]

const SCOPES = [...new Set(RULES.map((r) => r.scope))]

let totalFiles = 0
let totalLines = 0
const report = []

for (const scope of SCOPES) {
  const target = join(ROOT, scope)
  const st = statSync(target, { throwIfNoEntry: false })
  if (!st) continue
  const files = st.isDirectory() ? walk(target) : [target]
  for (const file of files) {
    const rel = relative(ROOT, file)
    const original = readFileSync(file, 'utf8')
    let text = original
    let hits = 0
    for (const rule of RULES) {
      if (!rel.startsWith(rule.scope)) continue
      rule.pattern.lastIndex = 0
      text = text.replace(rule.pattern, (...args) => {
        hits++
        return rule.replacement.replace(/\$(\d)/g, (_, d) => args[Number(d)] ?? '')
      })
    }
    if (hits > 0 && text !== original) {
      totalFiles++
      totalLines += hits
      report.push(`${rel}  (${hits} 处)`)
      if (write) writeFileSync(file, text)
    }
  }
}

for (const line of report) console.log(`  ${line}`)
console.log(`\n${write ? '已改写' : '待改写（dry-run）'}：${totalFiles} 个文件 / ${totalLines} 处`)
if (!write && totalFiles > 0) console.log('加 --write 落盘。')
