import { onMounted, watch, type Ref } from 'vue-lynx'
import { getUniAdapter } from '../common/uniAdapter'
import { uuid } from '../common/util'

/**
 * 原生 input / textarea 受控值同步（真机通道）。
 *
 * ## 背景：为什么 :value 属性通道不够
 *
 * 组件库对原生输入框一律采用 Lynx 官方受控写法——`:value` 受控绑定 +
 * `@input` 回写。该写法在 **Web 预览** 全绿：@lynx-js/web-elements 的
 * XInput 属性处理器直接把新值写进 shadow root 里的 `<input>.value`
 * （`XInputAttribute._handleValue`），属性即显示。
 *
 * 但**真机上属性通道刷新不了「用户已输入过」的输入框**：原生输入框被
 * IME（输入法）接管后，文本由输入法所有，后台线程下发的 value 属性更新
 * 会被吞。2026-11-05 真机复报（wd-input-number）：min=0/max=10 的步进器
 * 里键入 33，归一化（应回落到 10）与加减步进都不回显——模型其实已经
 * 变了，只是输入框文本不动，用户视角就是「加减没有鸟用」。
 *
 * ## 正解：元素方法 setValue
 *
 * Lynx input 元素自带 `setValue({ value, index })` 方法（官方 API，
 * @lynx-js/web-elements 的 XInput.setValue：「Sets value and cursor」），
 * 经 SelectorQuery.invoke 触达——与 getRect / scrollViewTo 同一条已验证
 * 的真机链路。程序化改写值时必须走该通道，属性通道只负责创建期初值。
 *
 * ## 用法
 *
 * ```ts
 * const { inputId, markNativeValue } = useNativeInputValue(inputValue, 'wd-input')
 * // handleInput 里用户输入回声处标记一次，避免重复推送打扰 IME 光标：
 * //   markNativeValue(rawVal)
 * // 模板：<input :id="inputId" :value="String(inputValue)" @input="handleInput" />
 * ```
 *
 * @param source 组件内的受控值 ref（输入框当前应显示的文本）
 * @param idPrefix 实例唯一 id 前缀（组件名，如 'wd-input'）
 */
export function useNativeInputValue(source: Ref<string | number>, idPrefix: string) {
  /** 实例唯一 id：Lynx 引擎按 id 维护节点注册，同页多实例必须各自唯一 */
  const inputId = `${idPrefix}-${uuid()}`

  /**
   * 原生输入框当前已显示的文本。
   *
   * 用户输入的回声不需要推送（输入框本来就显示用户敲的内容），重复
   * setValue 只会打扰 IME 光标；程序化改写（归一化 / 步进 / 清除 /
   * 外部受控）才需要推送。
   */
  let nativeSynced = ''

  function sync(val: string | number | null | undefined) {
    const strVal = val == null ? '' : String(val)
    if (strVal === nativeSynced) return
    nativeSynced = strVal
    const lynx = (globalThis as any).lynx
    const createQuery =
      getUniAdapter('createSelectorQuery') ||
      (typeof lynx?.createSelectorQuery === 'function' ? () => lynx.createSelectorQuery() : undefined)
    if (!createQuery) return
    try {
      createQuery().select(`#${inputId}`).invoke({ method: 'setValue', params: { value: strVal } }).exec()
    } catch {
      // 宿主无 invoke 能力（如 jsdom 测试环境）时保留 :value 属性通道兜底。
    }
  }

  watch(source, (val) => sync(val))

  // 创建期初值：属性通道在建树时下发，挂载后再推一次 setValue 双保险
  // （真机上属性初值也可能被延迟/丢弃，同值推送无副作用）。
  onMounted(() => sync(source.value))

  /** 用户输入回声标记：原生输入框已显示该文本，无需再推送 */
  function markNativeValue(val: string | number | null | undefined) {
    nativeSynced = val == null ? '' : String(val)
  }

  return { inputId, markNativeValue }
}
