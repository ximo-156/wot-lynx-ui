import { isPromise } from './util'

export type Interceptor = (...args: any[]) => Promise<boolean> | boolean | undefined | void

/**
 * 拦截器统一兜底出口。
 *
 * `beforeConfirm` / `beforeChange` / `beforeChoose` 等拦截器由消费方提供，
 * 抛错属于消费方缺陷；若直接向事件处理器 / Promise 链抛出，会在 Lynx 上变成
 * 未捕获异常（Sentry USER_RUNTIME_ERROR），最坏情况下崩掉整张卡片。
 * 这里统一接住并交给可选的 error 回调，没有 error 回调时只告警。
 */
function reportInterceptorError(error: unknown, onError?: (err: unknown) => void) {
  if (onError) {
    try {
      onError(error)
      return
    } catch (err) {
      // error 回调自身抛错时也不能继续向上传播
      console.error('[wot-lynx-ui] callInterceptor 的 error 回调执行失败（已兜底）：', err)
      return
    }
  }
  console.error('[wot-lynx-ui] 拦截器回调执行失败（已兜底，页面保持可用）：', error)
}

export function callInterceptor(
  interceptor: Interceptor | undefined,
  {
    args = [],
    done,
    canceled,
    error
  }: {
    args?: unknown[]
    done: () => void
    canceled?: () => void
    error?: (err: unknown) => void
  }
) {
  if (!interceptor) {
    done()
    return
  }

  let returnVal: boolean | Promise<boolean> | undefined | void
  try {
    returnVal = interceptor.apply(null, args)
  } catch (err) {
    // 同步抛错：拦截器在事件处理器里直接执行，必须就地接住
    reportInterceptorError(err, error)
    return
  }

  if (isPromise(returnVal)) {
    returnVal
      .then((value) => {
        if (value) {
          done()
        } else if (canceled) {
          canceled()
        }
      })
      .catch((err) => reportInterceptorError(err, error))
  } else if (returnVal) {
    try {
      done()
    } catch (err) {
      // done 内通常是组件状态写入；抛错同样不能冒泡到事件系统
      reportInterceptorError(err, error)
    }
  } else if (canceled) {
    try {
      canceled()
    } catch (err) {
      reportInterceptorError(err, error)
    }
  }
}
