#!/usr/bin/env node
/**
 * check-device-coverage — 保证「每个组件都有真机可渲染实例 + 有检查项」。
 *
 * 为什么需要这个门禁：device-test 的交互清单长期只覆盖 28/106 个组件，
 * 剩下 78 个组件在真机上从没被按项验过，缺陷只能等用户截图反馈
 * （2026-10-26 那批 8 类缺陷就是这么来的）。光靠人记「要全测」不成立，
 * 必须有机器断言。
 *
 * 两条断言：
 *   1. 主 demo（packages/demo/src/App.vue）引用了全部 106 个组件的标签
 *      —— 保证真机上每个组件都有可渲染实例；
 *   2. component-checks.ts 为每个组件提供一条检查项（id = r-<组件名>）
 *      —— 保证每个组件都有明确的「该看什么」。
 *
 * 用法：node scripts/check-device-coverage.mjs
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const ROOTS = ['packages/ui/src/primitives', 'packages/ui/src/components']

/** 目录名即组件名；wot-ui 是占位目录（空组件），不参与 */
function listComponents() {
  const names = []
  for (const rel of ROOTS) {
    for (const entry of readdirSync(join(root, rel))) {
      if (!entry.startsWith('wd-')) continue
      if (!statSync(join(root, rel, entry)).isDirectory()) continue
      names.push(entry)
    }
  }
  return names.sort()
}

const components = listComponents()
const app = readFileSync(join(root, 'packages/demo/src/App.vue'), 'utf8')
const checks = readFileSync(join(root, 'packages/demo/src/device-test/component-checks.ts'), 'utf8')

const rendered = new Set([...app.matchAll(/<(wd-[a-z0-9-]+)/g)].map((m) => m[1]))
const checked = new Set([...checks.matchAll(/id:\s*'r-(wd-[a-z0-9-]+)'/g)].map((m) => m[1]))

const notRendered = components.filter((c) => !rendered.has(c))
const notChecked = components.filter((c) => !checked.has(c))
const duplicated = [...checked].filter((c) => (checks.match(new RegExp(`id: 'r-${c}'`, 'g')) || []).length > 1)

let failed = false

if (notRendered.length) {
  failed = true
  console.error(`✗ ${notRendered.length} 个组件在主 demo 中没有可渲染实例：`)
  console.error(`  ${notRendered.join(' ')}`)
} else {
  console.log(`✅ 主 demo 覆盖全部 ${components.length} 个组件`)
}

if (notChecked.length) {
  failed = true
  console.error(`✗ ${notChecked.length} 个组件缺少真机检查项（component-checks.ts）：`)
  console.error(`  ${notChecked.join(' ')}`)
} else {
  console.log(`✅ 真机检查清单覆盖全部 ${components.length} 个组件`)
}

if (duplicated.length) {
  failed = true
  console.error(`✗ 检查项 id 重复：${duplicated.join(' ')}`)
}

const extra = [...checked].filter((c) => !components.includes(c))
if (extra.length) {
  failed = true
  console.error(`✗ 检查项指向不存在的组件（已删除或改名？）：${extra.join(' ')}`)
}

if (failed) process.exit(1)
