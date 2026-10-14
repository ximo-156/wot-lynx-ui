/**
 * captureConsole — 把控制台告警变成断言。
 *
 * 背景：Vue 的 props 校验告警（Missing required prop / Extraneous non-props
 * attributes）与 vue-lynx 的 Duplicate id 告警都走 console.warn / console.error。
 * 它们不影响用例结果，却会刷屏并掩盖真正的失败信息。本 helper 在渲染期间
 * 接管这两个出口，让「结构性告警」可被断言——从噪音变成回归防线。
 */
import { vi } from 'vitest'

export interface ConsoleCapture {
  /** 捕获期间的全部输出（warn + error 的首参数） */
  messages: string[]
  /** 其中的结构性告警（props 缺失 / 多余 attrs / 重复 id / 类型不符） */
  frameworkWarnings(): string[]
  restore(): void
}

/**
 * 需要被锁死的结构性告警——出现任意一条即说明组件用法或实现有 bug：
 * 调用方漏传必填 props、传了组件不认识的 attr、或同一 id 挂了多个节点。
 */
const FRAMEWORK_WARNING_PATTERNS = [/Missing required prop/, /Extraneous non-props attributes/, /Duplicate id/, /Invalid prop/]

export function captureConsole(): ConsoleCapture {
  const messages: string[] = []
  const spies = (['warn', 'error'] as const).map((level) =>
    vi.spyOn(console, level).mockImplementation((...args: unknown[]) => {
      messages.push(String(args[0] ?? ''))
    })
  )

  return {
    messages,
    frameworkWarnings: () => messages.filter((message) => FRAMEWORK_WARNING_PATTERNS.some((pattern) => pattern.test(message))),
    restore: () => spies.forEach((spy) => spy.mockRestore())
  }
}
