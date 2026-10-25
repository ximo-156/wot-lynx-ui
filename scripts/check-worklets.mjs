#!/usr/bin/env node
/**
 * check-worklets.mjs — 主线程 worklet 注册契约守护。
 *
 * 真机 fatal 1101（`TypeError: cannot read property 'bind' of undefined`）
 * 的根因：BG 线程把 worklet 序列化成 `{ _wkltId }` 对象随元素属性下发，
 * 主线程收到后到 `lynxWorkletImpl._workletMap` 查注册，查不到即在 hydrate
 * 时抛 TypeError 白屏（2026-10-25 真机）。
 *
 * 两道已踩实的闸门（详见 packages/demo/lynx.config.ts 内注释）：
 * 1. worklet-loader-mt 剔除解析后落在 node_modules 的 import
 *    （需 pluginVueLynx 的 includeWorkletPackages 白名单，npm 实装消费者必踩）；
 * 2. sideEffects tree-shaking 把 MT 桩里「无被消费导出」的 bare import
 *    连同组件子树整树剪掉（主因；rule 级 sideEffects:false 在 rspack 1.7.12
 *    被无视，只能对 lynx/web 环境关 optimization.sideEffects）。
 *
 * 契约：`pnpm build:demo` 产物 dist/*.lynx.bundle 中，**每个 BG 序列化的
 * worklet id 必须在 bundle 内出现 ≥2 次**（BG 序列化 1 次 + 主线程注册 ≥1 次）。
 * 修复前旧 bundle 实测：31/31 个 id 只出现 1 次；修复后：0 个 <2 次。
 * 任何一侧构建配置漂移都会在此红灯，而不是等真机白屏。
 *
 * 用法：pnpm check:worklets（需先 pnpm build:demo）
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = resolve(fileURLToPath(new URL('..', import.meta.url)))
const argIdx = process.argv.indexOf('--demo')
const demoDir = argIdx !== -1 ? resolve(process.argv[argIdx + 1]) : join(repoRoot, 'packages', 'demo')
const distDir = join(demoDir, 'dist')

/** 从 bundle 内提取 BG 序列化的 worklet id（_wkltId 值，容忍转义引号） */
function extractBgWorkletIds(source) {
  const ids = new Set()
  for (const m of source.matchAll(/_wkltId:.{0,3}?([0-9a-f]{4}:[0-9a-f]{4,6}:[0-9])/g)) ids.add(m[1])
  return ids
}

const bundles = existsSync(distDir)
  ? readdirSync(distDir).filter((name) => name.endsWith('.lynx.bundle'))
  : []

if (bundles.length === 0) {
  console.error('✖ 未找到构建产物（dist/*.lynx.bundle）。请先执行 pnpm build:demo。')
  process.exit(1)
}

let failed = false
for (const name of bundles) {
  const source = readFileSync(join(distDir, name), 'latin1')
  const bgIds = extractBgWorkletIds(source)
  if (bgIds.size === 0) {
    // 无 worklet 的入口（理论不存在，防御性跳过）
    console.log(`⚠ ${name}: 未发现 BG 序列化的 worklet id，跳过`)
    continue
  }
  // 出现次数 <2 = 只有 BG 序列化、主线程无注册 → 真机 hydrate 必崩
  const unregistered = [...bgIds].filter((id) => {
    const escaped = id.replace(/:/g, '\\:')
    return (source.match(new RegExp(escaped, 'g')) || []).length < 2
  })
  if (unregistered.length > 0) {
    failed = true
    console.error(`✖ ${name}: ${bgIds.size} 个 BG worklet id 中 ${unregistered.length} 个无主线程注册（真机白屏 fatal 1101）`)
    console.error('  样例:', JSON.stringify(unregistered.slice(0, 5)))
  } else {
    console.log(`✅ ${name}: ${bgIds.size} 个 worklet id 全部具备主线程注册`)
  }
}

if (failed) {
  console.error('\n修复指引：packages/demo/lynx.config.ts 内注释')
  console.error('（pluginVueLynx.includeWorkletPackages + tools.rspack 关闭 sideEffects）。')
  process.exit(1)
}
