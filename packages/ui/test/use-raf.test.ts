/**
 * useRaf 回调异常兜底的回归测试。
 *
 * 背景：raf 回调跑在 setTimeout / requestAnimationFrame 里——同步 throw 会变成
 * 未捕获异常（Node 里直接让进程崩溃，Lynx 宿主里变成 Sentry 上报的
 * USER_RUNTIME_ERROR），async 回调的 rejection 则会变成未处理的 Promise 拒绝。
 * 两者都拿不到现场也崩不掉页面，因此 useRaf 统一接住：优先交给调用方 onError，
 * 否则按 key 去重告警一次。
 *
 * 本文件若出现 "Unhandled Error" / "Unhandled Rejection" 即说明兜底被破坏。
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render } from './render'
import { useRaf } from '../src/composables/useRaf'
// 引入一个 SFC：测试环境里内联 template 的运行时编译依赖 SFC 模块触发注册，
// 缺少 SFC import 时会打 "runtime compilation is not supported" 且渲染不出内容。
import WdText from '../src/components/wd-text/wd-text.vue'

const wait = (ms = 120) => new Promise((r) => setTimeout(r, ms))

/** 收集未处理的 Promise 拒绝 */
function collectUnhandledRejections() {
  const rejections: unknown[] = []
  const handler = (reason: unknown) => rejections.push(reason)
  process.on('unhandledRejection', handler)
  return {
    rejections,
    dispose: () => process.off('unhandledRejection', handler)
  }
}

/** 挂载一个在 setup 里启动 useRaf 的组件 */
function mountRaf(callback: () => void | Promise<unknown>, onError?: (error: unknown) => void) {
  const Comp = {
    components: { WdText },
    setup() {
      const { start } = useRaf(callback as any, onError)
      start()
      return {}
    },
    template: `<view><WdText text="raf" /></view>`
  }
  return render(Comp)
}

describe('useRaf 异常兜底', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('回调同步抛错时不变成未捕获异常，并按 key 去重告警', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    mountRaf(() => {
      throw new Error('sync boom')
    })
    await wait()
    expect(warnSpy).toHaveBeenCalledTimes(1)
    expect(String(warnSpy.mock.calls[0][0])).toContain('useRaf')
  })

  it('回调 async rejection 时不变成未处理 Promise 拒绝', async () => {
    const tracker = collectUnhandledRejections()
    try {
      mountRaf(async () => {
        throw new Error('async boom')
      })
      await wait()
      // 不断言告警次数：默认告警按 key 去重（同一会话只提示一次），
      // 前一个用例已经用掉那次配额，这里只锁定"不逃逸成未处理拒绝"。
      expect(tracker.rejections).toEqual([])
    } finally {
      tracker.dispose()
    }
  })

  it('传入 onError 时异常交给调用方处理（不再走默认告警）', async () => {
    const tracker = collectUnhandledRejections()
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const seen: unknown[] = []
    try {
      mountRaf(
        () => {
          throw new Error('boom')
        },
        (error) => seen.push(error)
      )
      await wait()
      expect(seen.length).toBe(1)
      expect((seen[0] as Error).message).toBe('boom')
      expect(warnSpy).not.toHaveBeenCalled()
      expect(tracker.rejections).toEqual([])
    } finally {
      tracker.dispose()
    }
  })

  it('回调正常执行时行为不变', async () => {
    const tracker = collectUnhandledRejections()
    try {
      let called = 0
      mountRaf(() => {
        called++
      })
      await wait()
      expect(called).toBe(1)
      expect(tracker.rejections).toEqual([])
    } finally {
      tracker.dispose()
    }
  })
})
