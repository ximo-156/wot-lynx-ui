/**
 * 异常兜底回归测试。
 *
 * 背景：Lynx 后台线程中，渲染路径（computed / 生命周期 / watch）抛出的未捕获
 * 异常与未处理的 Promise 拒绝，都会被 Sentry 上报为 USER_RUNTIME_ERROR 并
 * **崩掉整张卡片**。本文件锁定"非法输入只降级、不抛出"的约定。
 */
import { describe, it, expect, vi } from 'vitest'
import { ref } from 'vue-lynx'
import { render } from './render'
import wotLynxUI from '../src/index'
import WdText from '../src/components/wd-text/wd-text.vue'
import WdProgress from '../src/components/wd-progress/wd-progress.vue'
import WdPickerView from '../src/components/wd-picker-view/wd-picker-view.vue'

const wait = (ms = 60) => new Promise((r) => setTimeout(r, ms))

/** 收集会话期间的未处理拒绝 */
function collectUnhandledRejections() {
  const unhandled: unknown[] = []
  const onUnhandled = (reason: unknown) => unhandled.push(reason)
  process.on('unhandledRejection', onUnhandled)
  return {
    unhandled,
    dispose: () => process.off('unhandledRejection', onUnhandled)
  }
}

describe('异常兜底', () => {
  it('wd-text：format 为 true 但 mode 非法时按原文展示，不抛错', () => {
    // 回归点：formattedText 是 computed，此前 formatText 直接 throw 会崩掉渲染路径
    const errorSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      const { container } = render(WdText, { text: 'abc', format: true, mode: 'text' })
      const text = container.querySelector('.wd-text')
      expect(text).toBeTruthy()
      expect(text!.textContent).toContain('abc')
    } finally {
      errorSpy.mockRestore()
    }
  })

  it('wd-progress：color 结构非法时降级为普通进度条，不产生未处理拒绝', async () => {
    // 回归点：updateProgress 由 watch（immediate）无 await 调用，内部 validateColorArray
    // 此前会 throw，形成未处理的 Promise 拒绝
    const tracker = collectUnhandledRejections()
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      const { container } = render(WdProgress, {
        percentage: 50,
        // 既不是 string[] 也不是 ProgressColor[]，触发 validateColorArray 抛错
        color: [123 as any]
      })
      await wait()
      expect(container.querySelector('.wd-progress')).toBeTruthy()
      expect(tracker.unhandled).toEqual([])
    } finally {
      tracker.dispose()
      warnSpy.mockRestore()
    }
  })

  it('wd-picker-view：columns 混合类型 / 缺 key 时降级为空列，不抛错', () => {
    // 回归点：resetColumns 由 watch 同步调用，formatArray 此前会 throw
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      // 混合原始值与对象：formatArray 抛 "The columns are correct"
      const { container } = render(WdPickerView, {
        modelValue: ['a'],
        columns: ['a', { foo: 1 } as any]
      })
      expect(container.querySelector('.wd-picker-view')).toBeTruthy()

      // 对象既无 valueKey 也无 labelKey：formatArray 抛 "Can't find valueKey..."
      const { container: c2 } = render(WdPickerView, {
        modelValue: ['a'],
        columns: [[{ foo: 1 } as any]]
      })
      expect(c2.querySelector('.wd-picker-view')).toBeTruthy()
    } finally {
      warnSpy.mockRestore()
    }
  })

  it('wotLynxUI.install：安装 errorHandler 兜底组件异常并链到宿主 handler', () => {
    const hostErrors: unknown[] = []
    const mockApp = {
      component() {
        return mockApp
      },
      config: {
        errorHandler: (err: unknown) => {
          hostErrors.push(err)
        }
      }
    }
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      wotLynxUI.install(mockApp as any)
      const handler = mockApp.config.errorHandler!
      const err = new Error('boom')
      // 兜底 handler 自身不得再抛（再抛就等于没兜底）
      expect(() => handler(err, null, 'render')).not.toThrow()
      // 宿主的 handler 必须被链式调用，不能被静默吞掉
      expect(hostErrors).toEqual([err])
    } finally {
      errorSpy.mockRestore()
    }
  })

  it('wotLynxUI.install：宿主未配置 errorHandler 时也能安全安装', () => {
    const names: string[] = []
    const mockApp = {
      component(name: string) {
        names.push(name)
        return mockApp
      }
      // 注意：没有 config 字段
    }
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      expect(() => wotLynxUI.install(mockApp as any)).not.toThrow()
      expect(names).toContain('wd-button')
      expect(() => (mockApp as any).config.errorHandler(new Error('x'), null, 'render')).not.toThrow()
    } finally {
      errorSpy.mockRestore()
    }
  })

  it('wd-text：mode 为 price 且 text 非数字时不抛错（NaN 也只展示）', () => {
    const { container } = render(WdText, { text: 'abc', mode: 'price' })
    expect(container.querySelector('.wd-text')).toBeTruthy()
  })

  it('wd-slider：createSelectorQuery 缺失时挂载不抛错（线上崩溃路径）', async () => {
    // 复现线上事故：onMounted -> initSlider -> getRect（createSelectorQuery 缺失）
    const lynx = (globalThis as any).lynx
    const original = lynx.createSelectorQuery
    delete lynx.createSelectorQuery
    const tracker = collectUnhandledRejections()
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      const WdSlider = (await import('../src/components/wd-slider/wd-slider.vue')).default
      const { container } = render(WdSlider, { modelValue: 50, min: 0, max: 100 })
      await wait()
      expect(container.querySelector('.wd-slider')).toBeTruthy()
      expect(tracker.unhandled).toEqual([])
    } finally {
      tracker.dispose()
      warnSpy.mockRestore()
      lynx.createSelectorQuery = original
    }
  })

  it('响应式数据被组件持有时，value 变化不抛错', async () => {
    // 防御性冒烟：确认降级改动没有破坏基本的响应式更新
    const value = ref(30)
    const Wrapper = {
      components: { WdText },
      setup: () => ({ value }),
      template: `<WdText :text="String(value)" />`
    }
    const { container } = render(Wrapper)
    expect(container.textContent).toContain('30')
    value.value = 70
    await wait()
    expect(container.textContent).toContain('70')
  })
})
