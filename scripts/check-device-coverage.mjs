#!/usr/bin/env node
/**
 * check-device-coverage — 保证「每个组件都有真机可渲染实例 + 有检查项」。
 *
 * 为什么需要这个门禁：device-test 的交互清单长期只覆盖 28/106 个组件，
 * 剩下 78 个组件在真机上从没被按项验过，缺陷只能等用户截图反馈
 * （2026-10-26 / 2026-11-03 那两批缺陷就是这么来的）。光靠人记「要全测」
 * 不成立，必须有机器断言。
 *
 * 断言：
 *   1. **device-test 入口可达的模板**里引用了全部 106 个组件标签
 *      —— 用户扫真机二维码看到的就是这个入口，光主 demo 齐全不够
 *      （2026-11-03：主 demo 106/106，device-test 只有 28/106，真机上
 *      「很多组件显示不出来」，其实是没渲染）。
 *      做法：从 packages/demo/src/device-test/index.ts 出发跟随相对 import
 *      收集全部 wd-* 标签，天然涵盖 App.vue → Showcase.vue 的拆分。
 *   2. 主 demo 入口（packages/demo/src/index.ts）同样覆盖全部 106 个组件
 *      —— 保证「电脑上能看到的」仍然是全量。
 *   3. component-checks.ts 为每个组件提供一条检查项（id = r-<组件名>）
 *      —— 保证每个组件都有明确的「该看什么」。
 *
 * 用法：node scripts/check-device-coverage.mjs
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const ROOTS = ['packages/ui/src/primitives', 'packages/ui/src/components']
const DEVICE_ENTRY = 'packages/demo/src/device-test/index.ts'
const MAIN_ENTRY = 'packages/demo/src/index.ts'

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

/** 相对路径解析：支持 .ts/.js/.vue 省略后缀与目录 index */
function resolveImport(fromFile, spec) {
  const base = resolve(dirname(fromFile), spec)
  const candidates = [base, `${base}.ts`, `${base}.js`, `${base}.vue`, join(base, 'index.ts')]
  return candidates.find((p) => existsSync(p) && statSync(p).isFile()) || null
}

/**
 * 从入口出发跟随相对 import，收集所有模板里出现过的 wd-* 组件标签。
 * 只看相对 import：包名（wot-lynx-ui / vue-lynx）由插件全局注册，与标签无关。
 */
function collectRendered(entryRel) {
  const entry = join(root, entryRel)
  const seen = new Set()
  const tags = new Set()
  const queue = [entry]
  while (queue.length) {
    const file = queue.pop()
    if (!file || seen.has(file)) continue
    seen.add(file)
    let src
    try {
      src = readFileSync(file, 'utf8')
    } catch {
      continue
    }
    for (const m of src.matchAll(/<(wd-[a-z0-9-]+)/g)) tags.add(m[1])
    for (const m of src.matchAll(/from\s+'(\.[^']*)'/g)) {
      const resolved = resolveImport(file, m[1])
      if (resolved) queue.push(resolved)
    }
  }
  return { tags, files: seen }
}

const components = listComponents()
const checks = readFileSync(join(root, 'packages/demo/src/device-test/component-checks.ts'), 'utf8')

const device = collectRendered(DEVICE_ENTRY)
const main = collectRendered(MAIN_ENTRY)

const checked = new Set([...checks.matchAll(/id:\s*'r-(wd-[a-z0-9-]+)'/g)].map((m) => m[1]))

const notRenderedDevice = components.filter((c) => !device.tags.has(c))
const notRenderedMain = components.filter((c) => !main.tags.has(c))
const notChecked = components.filter((c) => !checked.has(c))
const duplicated = [...checked].filter((c) => (checks.match(new RegExp(`id: 'r-${c}'`, 'g')) || []).length > 1)

let failed = false

if (notRenderedDevice.length) {
  failed = true
  console.error(`✗ ${notRenderedDevice.length} 个组件在 device-test 入口（真机页面）没有可渲染实例：`)
  console.error(`  ${notRenderedDevice.join(' ')}`)
} else {
  console.log(`✅ device-test 入口（真机）覆盖全部 ${components.length} 个组件`)
}

if (notRenderedMain.length) {
  failed = true
  console.error(`✗ ${notRenderedMain.length} 个组件在主 demo 中没有可渲染实例：`)
  console.error(`  ${notRenderedMain.join(' ')}`)
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
