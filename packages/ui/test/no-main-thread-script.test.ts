/**
 * 结构回归测试：组件库禁止引入 Main Thread Script（MTS）机制。
 *
 * 背景（真机报错 1101 "main-thread.js exception: TypeError: cannot read
 * property 'current' of undefined"）：
 * - `lynxWorkletImpl` 只存在于主线程，后台线程的 computed 检测恒为 false，
 *   MTS 事件绑定永不生效，组件实际走降级分支；
 * - `runOnMainThread` 派发的 worklet 消费 useMainThreadRef 的 `.current`，
 *   其值依赖 INIT_MT_REF ops 先于 worklet 应用到主线程，跨通道无顺序保证，
 *   refMap 未就绪时生产构建直接崩溃。
 *
 * MTS 已从组件库统一移除（见 CONVENTIONS.md §9），本测试防止回归：
 * 任何组件源码不得再出现 worklet 指令、主线程事件/引用绑定或跨线程 API。
 */
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'

const SRC_DIR = path.resolve(__dirname, '..', 'src')

/** 递归收集 src 下的 .vue / .ts 文件（跳过 icons 数据与第三方库代码） */
function collectSourceFiles(dir: string): string[] {
  const files: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry)
    if (statSync(full).isDirectory()) {
      files.push(...collectSourceFiles(full))
    } else if (/\.(vue|ts)$/.test(entry)) {
      files.push(full)
    }
  }
  return files
}

/** 去除注释后再匹配：禁止的是「使用」，注释中的说明文字不构成回归 */
function stripComments(source: string): string {
  return source
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1')
}

const FORBIDDEN_PATTERNS: Array<{ pattern: RegExp; hint: string }> = [
  { pattern: /['"]main thread['"]/, hint: "'main thread' worklet 指令" },
  { pattern: /useMainThreadRef/, hint: 'useMainThreadRef' },
  { pattern: /runOnMainThread/, hint: 'runOnMainThread' },
  { pattern: /runOnBackground/, hint: 'runOnBackground' },
  { pattern: /main-thread-ref/, hint: 'main-thread-ref 属性' },
  { pattern: /main-thread-bind/, hint: 'main-thread-bind* 事件' },
  { pattern: /lynxWorkletImpl/, hint: 'lynxWorkletImpl 检测' }
]

describe('组件库源码不得使用 Main Thread Script', () => {
  const files = collectSourceFiles(SRC_DIR)

  // 读盘 + 去注释**只做一次**并缓存到 describe 作用域。
  //
  // 旧实现把 readFileSync + stripComments 写在 it.each 的回调里：7 个用例各自
  // 重读全库 ~350 个源码文件并跑一遍正则替换，单用例耗时超过 vitest 默认的 5s
  // 超时 → 7 个用例全部「超时失败」（不是断言失败）。后果是这条守卫在 CI 上
  // 要么假红、要么被当作 flaky 忽略，CONVENTIONS §10「禁止 MTS」实际处于
  // 无人看守状态。缓存后单用例只对内存中的字符串跑一次正则。
  const sources = files.map((file) => ({
    file,
    code: stripComments(readFileSync(file, 'utf8'))
  }))

  it('覆盖率：收集器不应漏扫 src 下的源码文件', () => {
    // 重写期间组件数量动态变化，断言「磁盘文件数 == 收集器文件数」，
    // 即收集逻辑始终覆盖全部源码（全部 102 个组件重写完成后约 350 个文件）。
    let onDisk = 0
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir)) {
        const full = path.join(dir, entry)
        if (statSync(full).isDirectory()) {
          walk(full)
        } else if (/\.(vue|ts)$/.test(entry)) {
          onDisk++
        }
      }
    }
    walk(SRC_DIR)
    expect(files.length).toBe(onDisk)
    expect(files.length).toBeGreaterThan(50)
  })

  it.each(FORBIDDEN_PATTERNS.map((p) => [p.hint, p.pattern] as const))(
    '不存在 %s',
    (_hint, pattern) => {
      const offenders = sources
        .filter(({ code }) => {
          pattern.lastIndex = 0
          return pattern.test(code)
        })
        .map(({ file }) => path.relative(SRC_DIR, file))
      expect(offenders).toEqual([])
    }
  )
})
