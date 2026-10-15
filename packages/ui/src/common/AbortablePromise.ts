export class AbortablePromise<T> {
  promise: Promise<T>
  private _reject: ((res?: any) => void) | null = null

  constructor(executor: (resolve: (value?: T | PromiseLike<T>) => void, reject: (reason?: any) => void) => void) {
    this.promise = new Promise<T>((resolve, reject) => {
      // executor 若为 async 函数，其返回的 promise 与 this.promise 并不相连：
      // abort() 后链式 await 抛出的 rejection 会漂成未处理的 Promise 拒绝，
      // 被 Lynx Sentry 上报为 USER_RUNTIME_ERROR。此处统一接住。
      const result = executor((value) => resolve(value as T), reject) as unknown
      if (result && typeof (result as Promise<unknown>).then === 'function') {
        ;(result as Promise<unknown>).then(undefined, () => {})
      }
      this._reject = reject
    })
    // abort() 是本类的正常控制流（动画调度中止），但被中止的 promise 可能
    // 没有任何等待方（如 enter 链飞行中卸载）。挂一个 no-op catch 将其标记
    // 为已处理，避免漂成未处理拒绝；真正 await 它的消费方仍会收到 rejection。
    this.promise.catch(() => {})
  }

  abort(error?: any) {
    if (this._reject) {
      this._reject(error)
    }
  }

  then<TResult1 = T, TResult2 = never>(
    onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null,
    onrejected?: ((reason: any) => TResult2 | never) | undefined | null
  ): Promise<TResult1 | TResult2> {
    return this.promise.then(onfulfilled, onrejected)
  }

  catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): Promise<T | TResult> {
    return this.promise.catch(onrejected)
  }
}
