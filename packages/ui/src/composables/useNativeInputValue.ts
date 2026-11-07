import { nextTick, onBeforeUnmount, onMounted, watch, type Ref } from 'vue-lynx'
import { getUniAdapter } from '../common/uniAdapter'
import { uuid } from '../common/util'

/**
 * 原生 input / textarea 的值同步。
 *
 * Web XInput 会处理 value 属性，但 Lynx 原生 input 的公开契约是 setValue /
 * getValue，不能把 :value 当作跨平台的初值或受控更新保证。保留属性供 Web
 * 使用；原生初值、程序化更新均在 nextTick（包含 MT flush ack）之后 invoke。
 *
 * 只有 success 回调才确认同步。节点未落地等失败最多重试一帧，失败 / 无能力
 * 不缓存「已同步」；用户输入、更新值、隐藏或卸载会失效旧请求和重试。条件
 * 渲染通过 isVisible 传入，重新创建同值输入框时也必须重新推送。
 *
 * 官方契约：
 * https://lynxjs.org/api/elements/built-in/input.md
 * https://lynxjs.org/api/lynx-api/nodes-ref/nodes-ref-invoke.md
 */
export function useNativeInputValue(source: Ref<string | number>, idPrefix: string, isVisible: () => boolean = () => true) {
  const inputId = `${idPrefix}-${uuid()}`
  let mounted = false
  let disposed = false
  let nativeSynced: string | undefined
  let revision = 0
  let retryTimer: ReturnType<typeof setTimeout> | undefined

  const valueText = () => source.value == null ? '' : String(source.value)

  function clearRetry() {
    if (retryTimer !== undefined) {
      clearTimeout(retryTimer)
      retryTimer = undefined
    }
  }

  function createQuery() {
    const lynx = (globalThis as any).lynx
    const factory = getUniAdapter('createSelectorQuery') ||
      (typeof lynx?.createSelectorQuery === 'function' ? () => lynx.createSelectorQuery() : undefined)
    return factory?.()
  }

  /** 同值但上一次同步失败时也可以显式请求；已经成功的输入回声不重复推送。 */
  async function syncNativeValue(retrying = false) {
    const request = ++revision
    clearRetry()
    if (disposed || !mounted || !isVisible()) return
    const value = valueText()
    // Vue post-watch / onMounted 本身不代表原生节点就绪；nextTick 等 MT 确认。
    await nextTick()
    const isCurrent = () => !disposed && mounted && request === revision && isVisible() && value === valueText()
    if (!isCurrent() || value === nativeSynced) return

    const fail = () => {
      if (!isCurrent()) return
      nativeSynced = undefined
      if (retrying) return
      retryTimer = setTimeout(() => {
        retryTimer = undefined
        if (isCurrent()) void syncNativeValue(true)
      }, 1000 / 30)
    }

    try {
      const query = createQuery()
      if (!query) return
      // 已发出的命令无法撤回：在它落地前，旧确认值不能用作同值跳过依据。
      // 例如 5 → 6（待回调）→ 5，必须再派发 5，不能沿用之前的 5 缓存。
      nativeSynced = undefined
      query.select(`#${inputId}`).invoke({
        method: 'setValue',
        params: { value },
        success: () => {
          if (isCurrent()) nativeSynced = value
        },
        // invoke 的异步失败不会被 try/catch 捕获；缺少 fail 还可能触发宿主红屏。
        fail
      }).exec()
    } catch {
      fail()
    }
  }

  watch(source, () => { void syncNativeValue() })
  watch(isVisible, (visible) => {
    revision++
    clearRetry()
    nativeSynced = undefined
    if (visible) void syncNativeValue()
  }, { flush: 'sync' })

  onMounted(() => {
    mounted = true
    void syncNativeValue()
  })
  onBeforeUnmount(() => {
    disposed = true
    mounted = false
    revision++
    clearRetry()
  })

  /** 原生输入（包括 setValue 的原生回声）已显示文本，不再写回或打扰 IME。 */
  function markNativeValue(value: string | number | null | undefined) {
    revision++
    clearRetry()
    nativeSynced = value == null ? '' : String(value)
  }

  /**
   * 调用当前实例的原生焦点方法，不依赖仅 Web 支持的 focus 属性。
   * 调用方在新节点挂载后 await nextTick 再 focus；blur 应在节点卸载前调用。
   */
  function setNativeFocus(focus: boolean) {
    if (disposed || !mounted || !isVisible()) return
    try {
      createQuery()?.select(`#${inputId}`).invoke({
        method: focus ? 'focus' : 'blur',
        fail: () => {}
      }).exec()
    } catch {
      // 不支持该原生方法的宿主保留属性通道；不把失败当作聚焦成功。
    }
  }

  return { inputId, markNativeValue, syncNativeValue, setNativeFocus }
}
