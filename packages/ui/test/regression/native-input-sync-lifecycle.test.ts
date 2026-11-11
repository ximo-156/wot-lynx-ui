/**
 * 原生输入值同步生命周期：真实 Vue Lynx 组件/双线程渲染 + 可控 SelectorQuery。
 *
 * nativeText 与 DOM 的 value 属性完全独立；只有成功执行 setValue 才改变原生文本。
 * 这模拟 Android input 的方法契约、异步失败和 input 回声，不模拟原生命中/IME 排版。
 * 因此本文件能守护同步协议，但不能代替 Android/iOS 上的实际点击及像素验收。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { h, nextTick, ref } from 'vue-lynx'
import { cleanup, render } from '../render'
import { fireEvent } from '../fire-event'
import { useNativeInputValue } from '@wot-lynx/core/composables/useNativeInputValue'
import InputNumber from '@wot-lynx/ui-form/wd-input-number'

type InvokeOptions = {
  method: string
  params?: { value?: string }
  success?: (result?: any) => void
  fail?: (error: { code: number; data: string }) => void
}
type Invocation = {
  selector: string
  options: InvokeOptions
  node: Element | null
  finished: boolean
}

const restores: Array<() => void> = []

beforeEach(() => { vi.useFakeTimers() })
afterEach(async () => {
  cleanup()
  restores.splice(0).reverse().forEach((restore) => restore())
  // 先完成卸载的主线程 patch，再复原时钟，避免异步回调污染复用 worker 的下个用例。
  await vi.advanceTimersByTimeAsync(100)
  await nextTick()
  vi.clearAllTimers()
  vi.useRealTimers()
})

async function flush(ms = 0) {
  await vi.advanceTimersByTimeAsync(ms)
  await nextTick()
  await nextTick()
}

/**
 * 只在 exec 时记录调用，并在独立的 success/fail 回调里结算。
 * DOM 属性可显示 value="5"，但 nativeText 初始仍为空，不能以属性断言掩盖丢同步。
 */
function nativeInputMock(config: { autoSuccess?: boolean; echoInput?: boolean; throwCount?: number } = {}) {
  const env = (globalThis as any).lynxTestingEnv
  const lynx = env.backgroundThread.globalThis.lynx
  const doc: Document = env.jsdom.window.document
  const original = lynx.createSelectorQuery
  const calls: Invocation[] = []
  const nativeText = new Map<Element, string>()
  let throwsLeft = config.throwCount ?? 0

  function fail(call: Invocation, message = 'native input is not ready') {
    if (call.finished) throw new Error('an invocation may settle only once')
    call.finished = true
    call.options.fail?.({ code: 1, data: message })
  }

  function succeed(call: Invocation) {
    if (call.finished) throw new Error('an invocation may settle only once')
    // 同一 id 经 v-if 重建后是另一个原生节点，旧请求不能写入替代节点。
    if (!call.node || !call.node.isConnected || doc.querySelector(call.selector) !== call.node) {
      fail(call, 'selected input is absent or has been replaced')
      return
    }
    call.finished = true
    if (call.options.method === 'setValue') {
      const value = String(call.options.params?.value ?? '')
      nativeText.set(call.node, value)
      // Android TextWatcher 会在 setValue 时发 input，Web XInput.value setter 不会。
      // 在 success 前发出回声，避免测试只覆盖 Web 的理想无事件路径。
      if (config.echoInput) fireEvent.input(call.node, { detail: { value, isComposing: false } })
      call.options.success?.()
    } else if (call.options.method === 'getValue') {
      call.options.success?.({
        value: nativeText.get(call.node) ?? '',
        selectionStart: -1,
        selectionEnd: -1,
        isComposing: false
      })
    } else {
      call.options.success?.()
    }
  }

  lynx.createSelectorQuery = () => ({
    select: (selector: string) => ({
      invoke: (options: InvokeOptions) => ({
        exec() {
          const call = { selector, options, node: doc.querySelector(selector), finished: false }
          calls.push(call)
          if (throwsLeft > 0) {
            throwsLeft--
            call.finished = true
            throw new Error('native bridge temporarily unavailable')
          }
          if (!call.node) {
            // 原生失败是回调，不是同步 throw；try/catch 不能替代 fail。
            Promise.resolve().then(() => fail(call, 'selected input is not materialized'))
          } else if (config.autoSuccess) {
            Promise.resolve().then(() => succeed(call))
          }
        }
      })
    })
  })
  restores.push(() => { lynx.createSelectorQuery = original })

  return {
    calls,
    nativeText,
    setCalls: () => calls.filter((call) => call.options.method === 'setValue'),
    values: () => calls.filter((call) => call.options.method === 'setValue').map((call) => call.options.params?.value),
    text: (node: Element) => nativeText.get(node) ?? '',
    succeed,
    fail,
    userInput(node: Element, value: string) {
      nativeText.set(node, value)
      fireEvent.input(node, { detail: { value, isComposing: false } })
    }
  }
}

/** 延迟真实 MT 建树与 ack，不把后台 onMounted 当作原生节点已经存在。 */
function holdMainThreadPatches() {
  const env = (globalThis as any).lynxTestingEnv
  const app = env.backgroundThread.globalThis.lynx.getNativeApp()
  const original = app.callLepusMethod
  const pending: Array<() => void> = []
  let holding = true
  app.callLepusMethod = (...args: any[]) => {
    if (holding && args[0] === 'vuePatchUpdate') pending.push(() => original.apply(app, args))
    else original.apply(app, args)
  }
  const release = () => {
    holding = false
    pending.splice(0).forEach((run) => run())
  }
  restores.push(() => {
    release()
    app.callLepusMethod = original
  })
  return { pending, release }
}

function mountNumber() {
  const value = ref<string | number>(5)
  const updates: Array<string | number> = []
  const result = render({
    setup: () => () => h(InputNumber, {
      modelValue: value.value,
      min: 0,
      max: 10,
      'onUpdate:modelValue': (next: string | number) => { value.value = next; updates.push(next) }
    })
  })
  return {
    ...result,
    value,
    updates,
    input: () => result.container.querySelector('.wd-input-number__input')!
  }
}

function mountHook(initial: string | number = 5, initiallyVisible = true) {
  const value = ref<string | number>(initial)
  const visible = ref(initiallyVisible)
  let control!: ReturnType<typeof useNativeInputValue>
  const result = render({
    setup() {
      control = useNativeInputValue(value, 'native-input-sync-test', () => visible.value)
      return () => h('view', { class: 'native-input-sync-harness' }, visible.value ? [
        h('input', {
          id: control.inputId,
          value: String(value.value),
          onInput(event: any) {
            const rawValue = String(event.detail?.value ?? '')
            control.markNativeValue(rawValue)
            value.value = rawValue
          }
        })
      ] : [])
    }
  })
  return { ...result, value, visible, control: () => control, input: () => result.container.querySelector('input')! }
}

describe('原生 input setValue：节点生命周期与成功确认', () => {
  it('等待主线程建树 ack 后显示初值 5，真实 InputNumber 加减同步 6/5', async () => {
    const native = nativeInputMock({ autoSuccess: true })
    const patch = holdMainThreadPatches()
    const mounted = mountNumber()
    // 刻意不推进 50ms 的 ack fallback，也不 await 尚未收到 ack 的 nextTick。
    await Promise.resolve()
    await Promise.resolve()
    expect(patch.pending.length).toBeGreaterThan(0)
    expect(mounted.input()).toBeNull()
    expect(native.setCalls(), 'onMounted 不能在 MT 建树前就调用原生输入框').toHaveLength(0)

    patch.release()
    await flush()
    expect(native.text(mounted.input())).toBe('5')
    expect(native.values()).toEqual(['5'])

    fireEvent.tap(mounted.container.querySelector('.wd-input-number__add')!)
    await flush()
    expect(mounted.value.value).toBe(6)
    expect(native.text(mounted.input())).toBe('6')
    fireEvent.tap(mounted.container.querySelector('.wd-input-number__sub')!)
    await flush()
    expect(mounted.value.value).toBe(5)
    expect(native.text(mounted.input())).toBe('5')
    expect(mounted.updates).toEqual([6, 5])
    expect(native.values()).toEqual(['5', '6', '5'])
  })

  it('setValue 异步失败不能缓存为已显示，有限重试成功才写入 nativeText', async () => {
    const native = nativeInputMock()
    const mounted = mountHook()
    await flush()
    const first = native.setCalls()[0]!
    expect(native.setCalls()).toHaveLength(1)
    expect(first.options.success).toBeTypeOf('function')
    expect(first.options.fail).toBeTypeOf('function')
    expect(native.text(mounted.input()), '属性初值不等于原生文本已同步').toBe('')

    native.fail(first)
    await flush(100)
    expect(native.setCalls()).toHaveLength(2)
    expect(native.text(mounted.input())).toBe('')
    native.succeed(native.setCalls()[1]!)
    await flush(100)
    expect(native.text(mounted.input())).toBe('5')
    expect(native.values()).toEqual(['5', '5'])
  })

  it('连续失败最多重试一次，不无限轮询；新值仍能重新同步', async () => {
    const native = nativeInputMock()
    const mounted = mountHook()
    await flush()
    native.fail(native.setCalls()[0]!)
    await flush(100)
    expect(native.setCalls()).toHaveLength(2)
    native.fail(native.setCalls()[1]!)
    await flush(1000)
    expect(native.setCalls()).toHaveLength(2)

    await mounted.control().syncNativeValue()
    await flush()
    expect(native.values(), '失败过的同值应允许再次显式同步').toEqual(['5', '5', '5'])
    native.succeed(native.setCalls()[2]!)
    expect(native.text(mounted.input())).toBe('5')

    mounted.value.value = 6
    await flush()
    expect(native.values()).toEqual(['5', '5', '5', '6'])
    native.succeed(native.setCalls()[3]!)
    expect(native.text(mounted.input())).toBe('6')
  })

  it('缺少 SelectorQuery 能力时不缓存假成功，同值可在能力就绪后补推', async () => {
    const native = nativeInputMock()
    const lynx = (globalThis as any).lynxTestingEnv.backgroundThread.globalThis.lynx
    const createQuery = lynx.createSelectorQuery
    lynx.createSelectorQuery = undefined
    const mounted = mountHook()
    await flush()
    expect(native.setCalls()).toHaveLength(0)
    expect(native.text(mounted.input())).toBe('')

    lynx.createSelectorQuery = createQuery
    await mounted.control().syncNativeValue()
    await flush()
    expect(native.setCalls()).toHaveLength(1)
    native.succeed(native.setCalls()[0]!)
    expect(native.text(mounted.input())).toBe('5')
  })

  it('已有旧写入在桥上时回退至上次成功值，也必须重新派发最新目标值', async () => {
    const native = nativeInputMock()
    const mounted = mountHook()
    await flush()
    native.succeed(native.setCalls()[0]!)
    expect(native.text(mounted.input())).toBe('5')

    mounted.value.value = 6
    await flush()
    const inFlight = native.setCalls()[1]!
    expect(native.values()).toEqual(['5', '6'])
    // 6 已派发，不能撤销它；缓存里的旧 5 已不再是最新原生状态的可靠证明。
    mounted.value.value = 5
    await flush()
    expect(native.values(), '不能因 5 === 旧 nativeSynced 而漏发纠正写入').toEqual(['5', '6', '5'])

    native.succeed(inFlight)
    expect(native.text(mounted.input())).toBe('6')
    native.succeed(native.setCalls()[2]!)
    await flush()
    expect(mounted.value.value).toBe(5)
    expect(native.text(mounted.input())).toBe('5')
  })

  it('同步抛错也保留未同步状态，并在下一次有限重试恢复', async () => {
    const native = nativeInputMock({ autoSuccess: true, throwCount: 1 })
    const mounted = mountHook()
    await flush(100)
    expect(native.values()).toEqual(['5', '5'])
    expect(native.text(mounted.input())).toBe('5')
  })

  it('v-if 隐藏时不查询，重新挂载后即使同值也必须同步到新节点', async () => {
    const native = nativeInputMock()
    const mounted = mountHook(5, false)
    await flush()
    expect(mounted.input()).toBeNull()
    expect(native.setCalls(), '不存在的条件输入框不能记作已同步').toHaveLength(0)

    mounted.visible.value = true
    await flush()
    expect(native.setCalls()).toHaveLength(1)
    const firstInput = mounted.input()
    native.succeed(native.setCalls()[0]!)
    expect(native.text(firstInput)).toBe('5')

    mounted.visible.value = false
    await flush()
    mounted.value.value = 6
    await flush()
    mounted.value.value = 5
    await flush()
    expect(native.setCalls()).toHaveLength(1)

    mounted.visible.value = true
    await flush()
    expect(mounted.input()).not.toBe(firstInput)
    expect(native.text(mounted.input())).toBe('')
    expect(native.values()).toEqual(['5', '5'])
    native.succeed(native.setCalls()[1]!)
    expect(native.text(mounted.input())).toBe('5')
  })
})

describe('原生 input setValue：取消过期任务与输入回声', () => {
  it('用户已输入新值时取消旧失败重试，不把 IME 的 7 回滚成 5', async () => {
    const native = nativeInputMock()
    const mounted = mountHook()
    await flush()
    native.fail(native.setCalls()[0]!)
    native.userInput(mounted.input(), '7')
    await flush(1000)
    expect(mounted.value.value).toBe('7')
    expect(native.text(mounted.input())).toBe('7')
    expect(native.values(), '输入回声不能重新 setValue 或唤醒旧重试').toEqual(['5'])
  })

  it('卸载会取消已安排的失败重试，不再调用不存在的原生节点', async () => {
    const native = nativeInputMock()
    const mounted = mountHook()
    await flush()
    native.fail(native.setCalls()[0]!)
    mounted.unmount()
    await flush(1000)
    expect(native.values()).toEqual(['5'])
  })

  it.each(['input', 'unmount'] as const)('过期 fail 晚于 %s 到达也不得重启旧请求', async (action) => {
    const native = nativeInputMock()
    const mounted = mountHook()
    await flush()
    const pending = native.setCalls()[0]!
    if (action === 'input') native.userInput(mounted.input(), '8')
    else mounted.unmount()
    await flush()
    native.fail(pending)
    await flush(1000)
    expect(native.values()).toEqual(['5'])
    if (action === 'input') expect(native.text(mounted.input())).toBe('8')
  })

  it('Android 式 setValue→input 回声不形成闭环，连续步进和 IME 输入保持一致', async () => {
    const native = nativeInputMock({ autoSuccess: true, echoInput: true })
    const mounted = mountNumber()
    await flush(100)
    expect(native.values()).toEqual(['5'])
    expect(native.text(mounted.input())).toBe('5')
    expect(mounted.updates).toEqual([])

    fireEvent.tap(mounted.container.querySelector('.wd-input-number__add')!)
    fireEvent.tap(mounted.container.querySelector('.wd-input-number__add')!)
    await flush(100)
    expect(mounted.value.value).toBe(7)
    expect(native.text(mounted.input())).toBe('7')
    expect(native.values()).toEqual(['5', '7'])

    native.userInput(mounted.input(), '8')
    await flush(100)
    expect(mounted.value.value).toBe(8)
    expect(native.text(mounted.input())).toBe('8')
    expect(native.values(), '用户已显示的 8 不应再次经过原生 setValue').toEqual(['5', '7'])

    mounted.value.value = 9
    await flush(100)
    expect(native.text(mounted.input())).toBe('9')
    expect(native.values()).toEqual(['5', '7', '9'])
  })
})
