/** 宿主能力注册表独立于 util / uni，避免系统信息查询形成循环依赖。 */
export type UniAdapter = Record<string, any>
const hostAdapter: UniAdapter = {}

/** 同名键覆盖；传 undefined 可撤回该能力。 */
export function configureUniAdapter(adapter: UniAdapter): void {
  Object.assign(hostAdapter, adapter)
}

export function hasUniAdapter(api: string): boolean {
  return typeof hostAdapter[api] === 'function'
}

export function getUniAdapter(api: string): ((...args: any[]) => any) | undefined {
  return hasUniAdapter(api) ? hostAdapter[api] : undefined
}
