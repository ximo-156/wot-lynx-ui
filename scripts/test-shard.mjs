#!/usr/bin/env node
/**
 * 测试分片 —— 按**实测耗时**装箱，而不是按文件数轮转。
 *
 * ## 为什么不用 vitest 内建的 `--shard`
 *
 * 内建分片的算法是「收集顺序上取 i % count === index」，即**按文件个数**均分。
 * 测试文件的耗时差两个数量级（20.7s 的 event-registry 矩阵 vs 0.02s 的纯函数），
 * 按个数均分等于按个数不均分。2026-10 用 86 个文件的实测数据模拟 4 片：
 *
 *   内建 --shard    23.0s / 50.0s / 37.6s / 61.9s   ← 最慢片比理想值高 44%
 *   LPT 装箱        43.1s / 43.1s / 43.1s / 43.1s   ← 精确均分
 *
 * CI 的墙钟由**最慢分片**决定，44% 的不均衡直接变成 44% 的等待。
 *
 * ## 正确性与性能分开保证
 *
 * - **不漏跑**（正确性）：分片清单由 `collectTestFiles()` 现场扫描文件系统得到，
 *   不依赖任何缓存。`assignShards()` 结束时断言「每个文件恰好出现一次」，
 *   断言失败直接 throw —— 新增测试文件不可能因为缓存过期而被静默跳过。
 * - **均衡**（性能）：权重来自 `test/durations.json`。缓存过期只会让分片不均，
 *   不会让任何文件漏跑；缺失的文件用默认权重并告警。
 *
 * ## 用法
 *
 *   node scripts/test-shard.mjs --plan                    # 只看各片负载
 *   node scripts/test-shard.mjs --index=1 --count=4       # 跑第 1/4 片
 *   node scripts/test-shard.mjs --index=1 --count=4 --list
 *   node scripts/test-shard.mjs --update                  # 重测耗时并写缓存
 */
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const UI_DIR = path.join(ROOT, 'packages/ui')
const TEST_DIR = path.join(UI_DIR, 'test')
const DURATIONS_FILE = path.join(TEST_DIR, 'durations.json')
const VITEST_ENTRY = path.join(UI_DIR, 'node_modules/vitest/vitest.mjs')

/**
 * 未知文件的默认权重（毫秒）。
 *
 * 取「组件测试文件的中位数」而不是均值：均值被 event-registry 那一个 20s 的
 * 矩阵文件拉高，会让新增文件被高估、被排到最后，反而破坏均衡。
 */
const DEFAULT_WEIGHT = 2500

/**
 * 递归收集测试文件，返回相对 UI_DIR 的 POSIX 路径（如 `test/foo.test.ts`）。
 *
 * 不用 glob 库：这里是分片的唯一事实来源，少一个依赖就少一处「版本升级导致
 * 匹配语义变化」的静默风险。排序保证分片结果可复现。
 */
export function collectTestFiles(dir = TEST_DIR, base = UI_DIR) {
  const out = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) out.push(...collectTestFiles(full, base))
    else if (entry.isFile() && entry.name.endsWith('.test.ts')) {
      out.push(path.relative(base, full).split(path.sep).join('/'))
    }
  }
  return out.sort()
}

/** 读取耗时缓存；文件不存在或格式损坏时返回空表（分片照常工作，只是不均衡） */
export function loadDurations(file = DURATIONS_FILE) {
  if (!existsSync(file)) return {}
  try {
    const raw = JSON.parse(readFileSync(file, 'utf8'))
    const table = raw && typeof raw === 'object' && raw.durations ? raw.durations : {}
    const clean = {}
    for (const [key, value] of Object.entries(table)) {
      if (typeof value === 'number' && Number.isFinite(value) && value > 0) clean[key] = value
    }
    return clean
  } catch {
    return {}
  }
}

/**
 * 把文件清单配上权重。缺失的用 DEFAULT_WEIGHT 并返回名字，由调用方告警。
 */
export function resolveWeights(files, durations, fallback = DEFAULT_WEIGHT) {
  const missing = []
  const entries = files.map((file) => {
    const weight = durations[file]
    if (weight === undefined) missing.push(file)
    return { file, weight: weight ?? fallback }
  })
  return { entries, missing }
}

/**
 * LPT（Longest Processing Time first）装箱：耗时降序，每个文件放进当前最轻的片。
 *
 * 这是多机调度上的经典 4/3 近似算法：最重片不超过最优解的 4/3，实践中接近精确。
 * 平手时取「索引更小」的片（`<` 而非 `<=`），保证同一份输入永远得到同一份分片。
 */
export function assignShards(entries, count) {
  if (!Number.isInteger(count) || count < 1) throw new Error(`分片数必须是正整数，收到 ${count}`)
  const shards = Array.from({ length: count }, (_, index) => ({ index, files: [], weight: 0 }))
  const ordered = [...entries].sort((a, b) => b.weight - a.weight || (a.file < b.file ? -1 : 1))
  for (const entry of ordered) {
    let target = shards[0]
    for (const shard of shards) if (shard.weight < target.weight) target = shard
    target.files.push(entry.file)
    target.weight += entry.weight
  }
  for (const shard of shards) shard.files.sort()

  // 正确性断言：现场扫描的文件必须与分片结果一一对应，否则宁可报错也不跑半套
  const assigned = shards.flatMap((s) => s.files)
  const unique = new Set(assigned)
  if (assigned.length !== unique.size) {
    const dupes = assigned.filter((f, i) => assigned.indexOf(f) !== i)
    throw new Error(`分片出现重复文件：${[...new Set(dupes)].join(', ')}`)
  }
  const missing = entries.map((e) => e.file).filter((f) => !unique.has(f))
  if (missing.length > 0) throw new Error(`分片遗漏文件：${missing.join(', ')}`)

  return shards
}

/** 各片负载的极值，用于 --plan 与测试断言 */
export function balanceOf(shards) {
  const weights = shards.map((s) => s.weight)
  const max = Math.max(...weights)
  const min = Math.min(...weights)
  const total = weights.reduce((a, b) => a + b, 0)
  const avg = total / shards.length
  return { max, min, total, avg, spread: avg === 0 ? 0 : (max - avg) / avg }
}

/** 用 vitest 的 json reporter 重测一遍耗时，写入缓存 */
function updateDurations() {
  const tmp = path.join(ROOT, '.tmp-test-durations.json')
  console.log('⏱  跑一次全量测试以采集耗时…')
  const result = spawnSync(
    process.execPath,
    [VITEST_ENTRY, 'run', '--reporter=json', `--outputFile=${tmp}`],
    { cwd: UI_DIR, stdio: ['ignore', 'ignore', 'inherit'] }
  )
  if (!existsSync(tmp)) {
    console.error('✖ 未生成 json 报告，耗时缓存未更新')
    process.exit(1)
  }
  const report = JSON.parse(readFileSync(tmp, 'utf8'))
  const durations = {}
  for (const file of report.testResults || []) {
    const rel = path.relative(UI_DIR, file.name).split(path.sep).join('/')
    // 单个文件的墙钟跨度；0 表示收集阶段就失败（如缺 .wot-ref 的 parity 用例），
    // 这类文件给 1ms 让它排到最后，不占用真实权重
    durations[rel] = Math.max(1, Math.round((file.endTime || 0) - (file.startTime || 0)))
  }
  const payload = {
    $comment:
      '测试耗时缓存（scripts/test-shard.mjs 生成，勿手改）。用途只有分片均衡：' +
      '过期只会让分片不均，不会漏跑任何文件——分片清单是现场扫描文件系统得到的。',
    generatedAt: new Date().toISOString(),
    fileCount: Object.keys(durations).length,
    durations
  }
  writeFileSync(DURATIONS_FILE, JSON.stringify(payload, null, 2) + '\n', 'utf8')
  console.log(`✔ 写入 ${path.relative(ROOT, DURATIONS_FILE)}（${payload.fileCount} 个文件）`)
  console.log(`  退出码 ${result.status}（测试失败不影响采集，权重仍然有效）`)
}

function formatMs(ms) {
  return `${(ms / 1000).toFixed(1)}s`
}

function parseArgs(argv) {
  const options = { index: null, count: null, list: false, plan: false, update: false, help: false }
  for (const arg of argv) {
    if (arg === '--help' || arg === '-h') options.help = true
    else if (arg === '--list') options.list = true
    else if (arg === '--plan') options.plan = true
    else if (arg === '--update') options.update = true
    else if (arg.startsWith('--index=')) options.index = Number(arg.slice('--index='.length))
    else if (arg.startsWith('--count=')) options.count = Number(arg.slice('--count='.length))
    else throw new Error(`未知参数：${arg}`)
  }
  return options
}

const USAGE = `测试分片（按实测耗时 LPT 装箱）

  node scripts/test-shard.mjs --plan                 查看各片负载
  node scripts/test-shard.mjs --index=1 --count=4    跑第 1/4 片
  node scripts/test-shard.mjs --list --index=1 --count=4
  node scripts/test-shard.mjs --update               重测耗时并写 test/durations.json
`

function main() {
  let options
  try {
    options = parseArgs(process.argv.slice(2))
  } catch (error) {
    console.error(`✖ ${error.message}`)
    console.error(USAGE)
    process.exit(2)
  }
  if (options.help) {
    console.log(USAGE)
    return
  }
  if (options.update) {
    updateDurations()
    return
  }

  const count = options.count ?? (options.plan ? 4 : null)
  if (!count) {
    console.error('✖ 需要 --count=<分片数>')
    console.error(USAGE)
    process.exit(2)
  }

  const files = collectTestFiles()
  const { entries, missing } = resolveWeights(files, loadDurations())
  const shards = assignShards(entries, count)
  const balance = balanceOf(shards)

  if (missing.length > 0) {
    console.warn(
      `⚠ ${missing.length} 个文件不在耗时缓存里，按默认权重 ${DEFAULT_WEIGHT}ms 估算：` +
        `${missing.slice(0, 5).join(', ')}${missing.length > 5 ? ' …' : ''}\n` +
        '  （只影响分片均衡，不影响是否执行；跑 pnpm test:shard:update 可刷新）'
    )
  }

  if (options.plan || options.list) {
    console.log(
      `共 ${files.length} 个测试文件 / ${count} 片，理想 ${formatMs(balance.avg)}，` +
        `最慢 ${formatMs(balance.max)}（超均值 ${(balance.spread * 100).toFixed(1)}%）`
    )
    for (const shard of shards) {
      console.log(
        `  片 ${shard.index + 1}: ${String(shard.files.length).padStart(2)} 个文件  ${formatMs(shard.weight)}`
      )
      if (options.list) for (const file of shard.files) console.log(`      ${file}`)
    }
  }
  if (options.plan) return

  if (!Number.isInteger(options.index) || options.index < 1 || options.index > count) {
    console.error(`✖ --index 必须在 1..${count} 之间，收到 ${options.index}`)
    process.exit(2)
  }
  const selected = shards[options.index - 1]
  console.log(`▶ 片 ${options.index}/${count}：${selected.files.length} 个文件，估算 ${formatMs(selected.weight)}`)

  const result = spawnSync(
    process.execPath,
    [VITEST_ENTRY, 'run', ...selected.files],
    { cwd: UI_DIR, stdio: 'inherit' }
  )
  if (result.error) {
    console.error(`✖ 无法启动 vitest：${result.error.message}`)
    process.exit(1)
  }
  process.exit(result.status ?? 1)
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main()
}
