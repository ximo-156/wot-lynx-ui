/**
 * callInterceptor 回归测试。
 *
 * 背景：beforeConfirm / beforeChange / beforeChoose 等拦截器由消费方提供。
 * 历史实现直接 `interceptor.apply()`，拦截器一旦同步抛错就会冒泡到 Lynx
 * 事件处理器，成为未捕获异常（USER_RUNTIME_ERROR）；Promise 链里 done()
 * 抛错则可能变成未处理拒绝。两者都可能崩掉整张卡片。
 *
 * 本测试锁定：拦截器同步抛错 / 异步拒绝 / done 抛错 都被接住并交给 error
 * 回调；没有 error 回调时只 console.error，不向上抛出。
 */
import { describe, it, expect, vi } from 'vitest'
import { callInterceptor } from '../src/common/interceptor'
import { captureConsole } from './capture-console'

describe('callInterceptor 异常兜底', () => {
  it('未传拦截器时直接执行 done', () => {
    const done = vi.fn()
    callInterceptor(undefined, { done })
    expect(done).toHaveBeenCalledTimes(1)
  })

  it('返回 true 执行 done，返回 false 执行 canceled', () => {
    const done = vi.fn()
    const canceled = vi.fn()
    callInterceptor(() => true, { done, canceled })
    callInterceptor(() => false, { done, canceled })
    expect(done).toHaveBeenCalledTimes(1)
    expect(canceled).toHaveBeenCalledTimes(1)
  })

  it('拦截器同步抛错时不再向上抛，并交给 error 回调', () => {
    const done = vi.fn()
    const error = vi.fn()
    const boom = new Error('sync boom')

    expect(() =>
      callInterceptor(
        () => {
          throw boom
        },
        { done, error }
      )
    ).not.toThrow()

    expect(done).not.toHaveBeenCalled()
    expect(error).toHaveBeenCalledWith(boom)
  })

  it('拦截器异步拒绝时交给 error 回调（不产生未处理拒绝）', async () => {
    const done = vi.fn()
    const error = vi.fn()
    const boom = new Error('async boom')

    callInterceptor(() => Promise.reject(boom), { done, error })
    await Promise.resolve()
    await Promise.resolve()

    expect(done).not.toHaveBeenCalled()
    expect(error).toHaveBeenCalledWith(boom)
  })

  it('done 同步抛错时交给 error 回调', () => {
    const error = vi.fn()
    const boom = new Error('done boom')

    expect(() =>
      callInterceptor(() => true, {
        done: () => {
          throw boom
        },
        error
      })
    ).not.toThrow()

    expect(error).toHaveBeenCalledWith(boom)
  })

  it('done 在 Promise 续段抛错时交给 error 回调', async () => {
    const error = vi.fn()
    const boom = new Error('async done boom')

    callInterceptor(() => Promise.resolve(true), {
      done: () => {
        throw boom
      },
      error
    })
    await Promise.resolve()
    await Promise.resolve()

    expect(error).toHaveBeenCalledWith(boom)
  })

  it('没有 error 回调时只告警，不向上抛出', () => {
    const capture = captureConsole()
    try {
      expect(() =>
        callInterceptor(
          () => {
            throw new Error('no handler boom')
          },
          { done: () => {} }
        )
      ).not.toThrow()
      expect(capture.messages.some((message) => message.includes('拦截器回调执行失败'))).toBe(true)
    } finally {
      capture.restore()
    }
  })

  it('error 回调自身抛错时也只告警', () => {
    const capture = captureConsole()
    try {
      expect(() =>
        callInterceptor(
          () => {
            throw new Error('interceptor boom')
          },
          {
            done: () => {},
            error: () => {
              throw new Error('error handler boom')
            }
          }
        )
      ).not.toThrow()
      expect(capture.messages.some((message) => message.includes('error 回调执行失败'))).toBe(true)
    } finally {
      capture.restore()
    }
  })
})
