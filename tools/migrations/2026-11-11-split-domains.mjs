#!/usr/bin/env node
/**
 * 一次性迁移脚本（2026-11-11，ADR-023 域包拆分 Phase 2）。
 *
 * 业务组件从门面 `src/components` 迁入六个域包后，把测试 / docs demo /
 * demo 探针里的业务组件 import 说明符改写为域包包名。
 *
 * 只改 import 说明符（可证明等价：exports map 的 source 条件指向同一份源码）；
 * 文件系统路径字符串（path.resolve / readFileSync / import.meta.glob）不动，
 * 那类引用已统一走 helpers/component-roots（按 packages.json 解析）。
 *
 * 门面自己的组件（wd-config-provider / wot-ui）保持原路径不动。
 *
 * 用法：node tools/migrations/2026-11-11-split-domains.mjs [--write]
 */
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import process from 'node:process'

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..')
const write = process.argv.includes('--write')

const DOMAINS = JSON.parse(readFileSync(join(ROOT, 'tools/migrations/domain-map.json'), 'utf8'))
const comp2pkg = new Map()
for (const [domain, comps] of Object.entries(DOMAINS)) {
  for (const c of comps) comp2pkg.set(c, `@wot-lynx/${domain}`)
}

const SKIP = new Set(['node_modules', '.git', 'dist', 'coverage', '.wot-ref', '.workbuddy-ai'])

function walk(dir, out = []) {
  if (!statSync(dir, { throwIfNoEntry: false })) return out
  for (const entry of readdirSync(dir)) {
    if (SKIP.has(entry)) continue
    const full = join(dir, entry)
    const st = statSync(full)
    if (st.isDirectory()) walk(full, out)
    else if (/\.(ts|vue|mjs|js)$/.test(entry)) out.push(full)
  }
  return out
}

/** 把说明符里的 wd-x 段替换为域包包名（去掉 .vue 后缀与多余段） */
function rewriteSpecifier(spec, mode) {
  const m = spec.match(/(wd-[a-z0-9-]+)/)
  if (!m) return null
  const pkg = comp2pkg.get(m[1])
  if (!pkg) return null // 门面自己的组件或非业务组件：不动
  if (mode === 'pkg') return `${pkg}/${m[1]}`
  // test 模式：保留 /types 等子路径
  const sub = spec.slice(spec.indexOf(m[1]) + m[1].length)
  return `${pkg}/${m[1]}${sub.replace(/\/wd-[a-z0-9-]+\.vue$/, '').replace(/\.vue$/, '')}`
}

const RULES = [
  // 测试：'../../src/components/wd-x[/...]' → '@wot-lynx/ui-<domain>/wd-x[/...]'
  { scope: 'packages/ui/test', mode: 'test', re: /(['"])\.\.\/\.\.\/src\/components\/(wd-[a-z0-9-]+)/g },
  // docs demo：'wot-lynx-ui/components/wd-x/...' → 包名
  { scope: 'docs/.vitepress', mode: 'pkg', re: /(['"])wot-lynx-ui\/components\/(wd-[a-z0-9-]+)/g },
  // demo 探针：同上
  { scope: 'packages/demo/src', mode: 'pkg', re: /(['"])wot-lynx-ui\/components\/(wd-[a-z0-9-]+)/g }
]

let totalFiles = 0
let totalHits = 0

for (const rule of RULES) {
  for (const file of walk(join(ROOT, rule.scope))) {
    const rel = relative(ROOT, file)
    const original = readFileSync(file, 'utf8')
    let hits = 0
    const next = original.replace(rule.re, (...args) => {
      const quote = args[1]
      const comp = args[2]
      const pkg = comp2pkg.get(comp)
      if (!pkg) return args[0]
      hits++
      if (rule.mode === 'pkg') {
        // 去掉 `/wd-x.vue` 尾巴：包名 + 组件名即入口（exports 的 ./* 模式）
        const tail = args[0].slice(quote.length + args[0].indexOf(comp) + comp.length)
        const stripped = tail.replace(new RegExp(`/${comp}\\.vue$`), '')
        return `${quote}${pkg}/${comp}${stripped}${quote}`
      }
      // test 模式：把整段说明符换掉（含后续 /types 等）
      const full = args[0]
      const spec = full.slice(1, -1) // 去掉引号
      const rewritten = rewriteSpecifier(spec, 'test')
      return `${quote}${rewritten}${quote}`
    })
    if (hits > 0 && next !== original) {
      totalFiles++
      totalHits += hits
      if (write) writeFileSync(file, next)
    }
  }
}

console.log(`${write ? '已改写' : '待改写（dry-run）'}：${totalFiles} 个文件 / ${totalHits} 处`)
if (!write && totalFiles > 0) console.log('加 --write 落盘。')
