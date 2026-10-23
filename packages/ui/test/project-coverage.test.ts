/**
 * 测试项目覆盖守卫 —— 保证「每个测试文件都真的会被执行」。
 *
 * 这个文件守的是三类**静默**缺陷，它们的共同点是「不会报错，只是少跑」：
 *
 * 1. **拼错的 PURE_TESTS 条目**：`unit` project 的 include 是精确路径列表，
 *    写错一个字符不会报错，那个文件会落到 `component`（白搭 3s 环境），
 *    或者两边都不匹配而**完全不被执行**。
 * 2. **被改坏的 component include / exclude**：把 `test/**\/*.test.ts` 收窄，
 *    或往 exclude 里加一条，新测试就悄悄不跑了，CI 依然全绿。
 * 3. **分片漏文件**：分片清单若来自缓存而非现场扫描，新增文件会永远不被
 *    CI 执行。`assignShards` 内部有断言，这里再从外部独立验证一次。
 *
 * ## 为什么不自己实现 glob 匹配
 *
 * 首版用 `**` → `.*`、`*` → `[^/]*` 模拟 vitest 的 glob，结果第一跑就被
 * `configDefaults.exclude` 里的 `**\/.{idea,git,cache,output,temp}/**` 拦下。
 * 扩展模拟器是错的方向：**守卫脚本最危险的失效方式是它自己算错了却仍然判绿**，
 * 而 glob 的语义（花括号展开、extglob、否定、`.` 开头文件、大小写）远比看起来复杂。
 *
 * 这里改为断言配置的**结构**，让「覆盖性」成为推论而不是模拟结果：
 *
 *   unit.include 全是精确路径（无通配符）且都真实存在
 *   component.include === ['test/**\/*.test.ts']        ← 收下整个 test/ 目录
 *   component.exclude === configDefaults.exclude ++ PURE_TESTS  ← 只排除纯函数用例
 *
 * 三条同时成立时，「每个文件恰好归一个 project」是集合论上的必然，不需要再算。
 * 任何一条被改坏，下面的断言会立刻变红并说明是哪一个前提破了。
 */
import { describe, expect, it } from 'vitest'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { configDefaults } from 'vitest/config'
import config from '../vitest.config'
import { assignShards, collectTestFiles, resolveWeights } from '../../../scripts/test-shard.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const UI_DIR = path.resolve(HERE, '..')

interface ProjectTestConfig {
  name: string
  environment?: string
  include: string[]
  exclude?: string[]
  setupFiles?: string[]
  isolate?: boolean
}

const projects = (config as any).test.projects as Array<{ test: ProjectTestConfig }>
const byName = new Map(projects.map((p) => [p.test.name, p.test]))
const unit = byName.get('unit')!
const component = byName.get('component')!

const allFiles = collectTestFiles()

describe('测试项目覆盖', () => {
  it('磁盘上确实扫到了测试文件（防止扫描逻辑失效后一片绿）', () => {
    expect(allFiles.length).toBeGreaterThan(50)
    for (const file of allFiles) {
      expect(file.startsWith('test/'), `${file} 应在 test/ 下`).toBe(true)
      expect(file.endsWith('.test.ts'), `${file} 应匹配 *.test.ts`).toBe(true)
    }
  })

  it('unit.include 全部是精确路径（守卫的集合运算依赖这一点）', () => {
    expect(unit.include.length).toBeGreaterThan(0)
    for (const entry of unit.include) {
      expect(entry, `unit.include 出现通配符，结构前提被破坏：${entry}`).not.toMatch(/[*?[\]{}]/)
      expect(existsSync(path.join(UI_DIR, entry)), `PURE_TESTS 条目不存在：${entry}`).toBe(true)
      expect(entry.endsWith('.test.ts'), `PURE_TESTS 条目不是测试文件：${entry}`).toBe(true)
    }
  })

  it('component 收下整个 test/ 目录，且只排除 PURE_TESTS', () => {
    expect(component.include).toEqual(['test/**/*.test.ts'])

    const exclude = component.exclude ?? []
    const defaults = configDefaults.exclude
    // 前缀必须是 configDefaults 原样（vitest 默认排除 node_modules / dist 等），
    // 后面必须恰好接上 PURE_TESTS。多了 = 有文件被静默排除，少了 = 纯函数用例跑两遍。
    expect(exclude.slice(0, defaults.length)).toEqual(defaults)
    expect(exclude.slice(defaults.length).sort()).toEqual([...unit.include].sort())
  })

  it('unit.include 是磁盘文件的子集（没有指向不存在文件的幽灵条目）', () => {
    const onDisk = new Set(allFiles)
    for (const entry of unit.include) expect(onDisk.has(entry), `幽灵条目：${entry}`).toBe(true)
  })

  it('unit project 不搭双线程环境（否则「纯函数测试」的前提就没了）', () => {
    expect(unit.environment).toBe('node')
    expect(unit.setupFiles ?? []).toEqual([])
  })

  it('文件隔离关闭在根 test 上（写在 project 内部会被静默忽略）', () => {
    // 「防止有人为排查问题临时打开、然后忘了改回来」的回归线：
    // isolate: true 会让全量测试从 33s 退回 110s，且没有任何测试会因此变红。
    //
    // ⚠️ 断言的是**根层**而不是 component project 内部。2026-10 实测：把
    //    `isolate: false` 写在 project 的 test 里，配置读出来是对的、行为却没变
    //    （113.88s vs 30.60s）。这类「配置值对、行为不对」的失效，只断言配置值
    //    是抓不住的——所以这里额外断言「project 内部没有重复写一份」，避免有人
    //    以为那里才是生效位置。
    expect((config as any).test.isolate).toBe(false)
    expect(
      (component as any).isolate,
      'component project 内部不应再写 isolate：那一层不生效，只会误导'
    ).toBeUndefined()
  })
})

describe('测试分片', () => {
  it('任意分片数下都不漏文件、不重复', () => {
    const { entries } = resolveWeights(allFiles, {})
    for (const count of [1, 2, 3, 4, 6, 8]) {
      const shards = assignShards(entries, count)
      expect(shards).toHaveLength(count)
      const assigned = shards.flatMap((s) => s.files)
      expect(new Set(assigned).size, `${count} 片出现重复`).toBe(assigned.length)
      expect([...assigned].sort(), `${count} 片漏文件`).toEqual(allFiles)
    }
  })

  it('分片权重来自缓存，缺失文件回落到默认权重而不是被丢弃', () => {
    const durations = { [allFiles[0]]: 9999 }
    const { entries, missing } = resolveWeights(allFiles, durations)
    expect(entries).toHaveLength(allFiles.length)
    expect(missing).toEqual(allFiles.slice(1))
    expect(entries[0].weight).toBe(9999)
    for (const entry of entries.slice(1)) expect(entry.weight).toBeGreaterThan(0)
  })

  it('LPT 把最重的文件摊到不同分片，而不是按个数轮转', () => {
    // 这正是内建 --shard 的问题：一个 20s 的文件和一堆 <1s 的文件混在一起时，
    // 按个数均分会让某个分片独占那个 20s 文件。
    const entries = [
      { file: 'a', weight: 20000 },
      { file: 'b', weight: 100 },
      { file: 'c', weight: 100 },
      { file: 'd', weight: 100 }
    ]
    const shards = assignShards(entries, 2)
    expect(shards.map((s) => s.files.includes('a'))).toEqual([true, false])
    expect(shards.map((s) => s.weight).sort((x, y) => x - y)).toEqual([300, 20000])
  })
})
