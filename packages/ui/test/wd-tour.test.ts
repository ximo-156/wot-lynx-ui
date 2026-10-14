/**
 * wd-tour 缺失元素处理策略的回归测试。
 *
 * 背景：getRect 约定永不 reject（未命中节点 / 宿主度量不可用时降级为零尺寸矩形），
 * wd-tour 需要自行识别零矩形并按 missingStrategy（stop / skip / hide）处理，
 * 同时触发 error 事件——不能把零矩形当作"元素在 (0,0)"继续引导。
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { ref } from 'vue-lynx'
import { render } from './render'
import { configureUniAdapter } from '../src/common/uni'
import WdTour from '../src/components/wd-tour/wd-tour.vue'

const wait = (ms = 150) => new Promise((r) => setTimeout(r, ms))

/** 让 SelectorQuery 的 invoke 成功回调返回指定矩形（默认 setup mock 返回零尺寸） */
function mockSelectorQueryRect(rect: Record<string, number>) {
  const lynx = (globalThis as any).lynx
  lynx.createSelectorQuery = () => {
    const full = { id: '', left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0, ...rect }
    const makeRef = () => ({
      invoke(options: any) {
        if (options && typeof options.success === 'function') {
          setTimeout(() => options.success(full), 0)
        }
        return { exec: () => {} }
      },
      boundingClientRect(cb: any) {
        if (typeof cb === 'function') setTimeout(() => cb(full), 0)
        return { exec: () => {} }
      },
      fields(_: any, cb: any) {
        if (typeof cb === 'function') setTimeout(() => cb(full), 0)
        return { exec: () => {} }
      }
    })
    const makeQuery = () => {
      const ref = makeRef()
      return {
        select: () => ref,
        selectAll: () => ref,
        in: () => makeQuery(),
        exec: () => {}
      }
    }
    return makeQuery()
  }
}

/** 还原 setup.ts 安装的默认 mock（零尺寸矩形） */
function restoreDefaultSelectorQuery() {
  mockSelectorQueryRect({})
}

function mountTour(options: { missingStrategy?: string; steps?: any[] }) {
  const visible = ref(true)
  const errors: any[] = []
  const events: string[] = []
  const Wrapper = {
    components: { WdTour },
    setup: () => ({
      visible,
      steps: options.steps || [{ element: '#not-exist', content: '引导内容' }],
      onError: (e: any) => errors.push(e),
      onFinish: () => events.push('finish'),
      onUpdateModelValue: (v: boolean) => {
        visible.value = v
        events.push('update:modelValue')
      }
    }),
    template: `<wd-tour v-model="visible" :steps="steps"${
      options.missingStrategy ? ` missing-strategy="${options.missingStrategy}"` : ''
    } @error="onError" @finish="onFinish" @update:modelValue="onUpdateModelValue" />`
  }
  const { container } = render(Wrapper)
  return { visible, errors, events, container }
}

afterEach(() => {
  restoreDefaultSelectorQuery()
})

describe('wd-tour 缺失元素处理', () => {
  it('目标元素未命中（getRect 降级为零矩形）时触发 error 事件', async () => {
    mockSelectorQueryRect({})
    const { errors } = mountTour({})
    await wait()
    expect(errors.length).toBe(1)
    expect(errors[0].message).toContain('无法找到指定的引导元素')
    expect(errors[0].element).toBe('#not-exist')
  })

  it('missing-strategy 为 hide 时缺失元素关闭引导', async () => {
    mockSelectorQueryRect({})
    const { visible, events } = mountTour({ missingStrategy: 'hide' })
    await wait()
    expect(events).toContain('update:modelValue')
    expect(visible.value).toBe(false)
  })

  it('missing-strategy 为 skip 时缺失元素走完成流程', async () => {
    mockSelectorQueryRect({})
    const { visible, events } = mountTour({ missingStrategy: 'skip' })
    await wait()
    expect(events).toContain('finish')
    expect(visible.value).toBe(false)
  })

  it('目标元素存在（非零矩形）时不触发 error 事件', async () => {
    mockSelectorQueryRect({ width: 100, height: 40, left: 10, top: 20, right: 110, bottom: 60 })
    const { errors, visible } = mountTour({})
    await wait()
    expect(errors.length).toBe(0)
    expect(visible.value).toBe(true)
  })
})

describe('wd-tour 意外异常兜底', () => {
  afterEach(() => {
    // 还原宿主适配器，避免影响后续用例
    configureUniAdapter({ pageScrollTo: () => {} })
  })

  it('宿主 pageScrollTo 抛错时不误报"元素缺失"，引导保持可用', async () => {
    // 元素位于可视区上方（top < 0）会走 scrollUp -> uni.pageScrollTo；
    // 宿主在这里抛错属于意外异常，必须与"引导元素缺失"区分开：
    // 不能触发 error 事件、不能关闭引导，只保留已度量到的元素信息。
    mockSelectorQueryRect({ width: 100, height: 40, left: 10, top: -50, right: 110, bottom: -10 })
    configureUniAdapter({
      pageScrollTo: () => {
        throw new Error('host pageScrollTo failed')
      }
    })
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const unhandled: unknown[] = []
    const onUnhandled = (reason: unknown) => unhandled.push(reason)
    process.on('unhandledRejection', onUnhandled)
    try {
      const { errors, visible, container } = mountTour({})
      await wait()
      // 不是"元素缺失"：error 事件不触发，missing-strategy 不介入
      expect(errors).toEqual([])
      expect(visible.value).toBe(true)
      expect(container.querySelector('.wd-tour')).toBeTruthy()
      // 异常被兜底：没有变成未处理异常，且按 key 去重告警了一次
      expect(unhandled).toEqual([])
      expect(warnSpy).toHaveBeenCalledTimes(1)
      expect(String(warnSpy.mock.calls[0][0])).toContain('wd-tour')
    } finally {
      process.off('unhandledRejection', onUnhandled)
      warnSpy.mockRestore()
    }
  })
})
