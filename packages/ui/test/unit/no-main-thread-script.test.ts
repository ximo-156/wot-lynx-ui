/**
 * 结构回归测试：组件库的 Main Thread Script（MTS）使用规范。
 *
 * 2026-10-19 起组件库全面转向**原生优先**实现：跟手交互（拖动 / 滑动 / 缩放）
 * 必须走 Lynx 官方的声明式 MTS 路径（`main-thread-bind*` 事件 + `'main thread'`
 * 指令函数 + `useMainThreadRef` + `main-thread-ref`），事件在主线程直接派发、
 * 节点样式直改，零线程跨越——这是 Lynx「原生交互性能」的唯一官方路径。
 *
 * 历史禁令（真机 1101 "cannot read property 'current' of undefined"）针对的是
 * **命令式** `runOnMainThread` 派发模式：其 worklet 消费 useMainThreadRef 的
 * `.current` 依赖 INIT_MT_REF ops 先于 worklet 应用，跨通道无顺序保证，refMap
 * 未就绪时生产构建直接崩溃。声明式 `main-thread-bind*` 由框架在建树时注册，
 * 不经过该竞态路径，为现行唯一允许的 MTS 形态。
 *
 * 本测试锁定：
 * - **禁止**命令式跨线程 API（runOnMainThread / runOnBackground / lynxWorkletImpl 检测）；
 * - **允许**声明式 MTS（main-thread-bind* / main-thread-ref / useMainThreadRef /
 *   'main thread' 指令）。
 */
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'

const SRC_DIR = path.resolve(__dirname, '../..', 'src')

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

/** 命令式跨线程 API：真机 1101 崩溃路径，一律禁止 */
const FORBIDDEN_PATTERNS: Array<{ pattern: RegExp; hint: string }> = [
  { pattern: /runOnMainThread/, hint: 'runOnMainThread 命令式派发' },
  { pattern: /runOnBackground/, hint: 'runOnBackground 命令式派发' },
  { pattern: /lynxWorkletImpl/, hint: 'lynxWorkletImpl 检测' }
]

describe('组件库 MTS 使用规范（声明式允许，命令式禁止）', () => {
  const files = collectSourceFiles(SRC_DIR)

  // 读盘 + 去注释**只做一次**并缓存到 describe 作用域（旧实现每用例重读全库，
  // 单用例超 5s 致 7 个用例全部超时失败，守卫实际处于无人看守状态）。
  const sources = files.map((file) => ({
    file,
    code: stripComments(readFileSync(file, 'utf8'))
  }))

  it('覆盖率：收集器不应漏扫 src 下的源码文件', () => {
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

  it("声明式 MTS 形态自洽：用了 'main thread' 指令就必须经 main-thread-bind* 绑定", () => {
    // 防「写了指令函数但没绑主线程事件」的半吊子用法（死代码 + 假性能）
    const offenders = sources
      .filter(({ code }) => {
        const hasDirective = /['"]main thread['"]/.test(code)
        const hasBinding = /main-thread-bind/.test(code)
        return hasDirective && !hasBinding
      })
      .map(({ file }) => path.relative(SRC_DIR, file))
    expect(offenders).toEqual([])
  })
})
