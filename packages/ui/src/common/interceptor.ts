import { isPromise } from './util'

function noop() {}

export type Interceptor = (...args: any[]) => Promise<boolean> | boolean | undefined | void

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
    error?: () => void
  }
) {
  if (interceptor) {
    const returnVal = interceptor.apply(null, args)

    if (isPromise(returnVal)) {
      returnVal
        .then((value) => {
          if (value) {
            done()
          } else if (canceled) {
            canceled()
          }
        })
        .catch(error || noop)
    } else if (returnVal) {
      done()
    } else if (canceled) {
      canceled()
    }
  } else {
    done()
  }
}
