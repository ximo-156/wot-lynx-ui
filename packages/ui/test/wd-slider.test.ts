import { describe, it, expect, afterEach } from 'vitest'
import { ref } from 'vue-lynx'
import { render } from './render'
import { fireEvent } from './fire-event'
import WdSlider from '../src/components/wd-slider/wd-slider.vue'

const wait = (ms = 30) => new Promise((r) => setTimeout(r, ms))

/** 按选择器返回指定尺寸的矩形（默认 setup mock 返回零尺寸，拖动计算需要非零轨道） */
function mockSelectorRects(rects: Record<string, { width?: number; height?: number; left?: number; top?: number }>) {
  const lynx = (globalThis as any).lynx
  lynx.createSelectorQuery = () => {
    // 轨道既可能按 class(.wd-slider__track) 也可能按 id(#wd-slider-xxx-track) 查询，
    // 因此按「选择器主体包含键名」匹配，两种写法都能命中。
    const rectFor = (selector: string) => {
      const bare = selector.replace(/^[#.]/, '')
      const key = Object.keys(rects).find((k) => bare.includes(k.replace(/^[#.]/, '')))
      return key ? rects[key] : { width: 0, height: 0, left: 0, top: 0 }
    }
    const makeRef = (selector: string) => ({
      invoke(options: any) {
        const rect = rectFor(selector)
        if (options && typeof options.success === 'function') {
          setTimeout(() => options.success({ left: 0, top: 0, right: 0, bottom: 0, ...rect }), 0)
        }
        return { exec: () => {} }
      },
      boundingClientRect(cb: any) {
        if (typeof cb === 'function') setTimeout(() => cb({ width: 0, height: 0, left: 0, top: 0 }), 0)
        return { exec: () => {} }
      },
      fields(_: any, cb: any) {
        if (typeof cb === 'function') setTimeout(() => cb({ width: 0, height: 0 }), 0)
        return { exec: () => {} }
      }
    })
    return {
      select: (selector: string) => makeRef(selector),
      selectAll: (selector: string) => makeRef(selector),
      in: () => ({ select: (s: string) => makeRef(s), selectAll: (s: string) => makeRef(s), exec: () => {} }),
      exec: () => {}
    }
  }
}

/** 还原 setup.ts 安装的默认 mock（零尺寸矩形） */
afterEach(() => {
  mockSelectorRects({})
})

describe('wd-slider', () => {
  it('渲染滑块与进度条', () => {
    const { container } = render(WdSlider, { modelValue: 50, min: 0, max: 100 })
    expect(container.querySelector('.wd-slider')).toBeTruthy()
    expect(container.querySelector('.wd-slider__line')).toBeTruthy()
    expect(container.querySelector('.wd-slider__dot')).toBeTruthy()
  })

  it('v-model 更新进度条宽度', async () => {
    const Wrapper = {
      components: { WdSlider },
      setup() {
        const value = ref(30)
        return { value }
      },
      template: `<WdSlider v-model="value" :min="0" :max="100" />`
    }
    const { container } = render(Wrapper)
    const line = container.querySelector('.wd-slider__line') as HTMLElement
    expect(line).toBeTruthy()
    // 30% 进度（对象样式绑定）
    expect(line.style.width).toContain('30')
  })

  it('范围模式渲染双滑块', () => {
    const { container } = render(WdSlider, {
      modelValue: [20, 80],
      range: true,
      min: 0,
      max: 100
    })
    expect(container.querySelectorAll('.wd-slider__dot').length).toBe(2)
  })

  it('禁用状态', () => {
    const { container } = render(WdSlider, { modelValue: 50, disabled: true })
    expect(container.querySelector('.wd-slider')!.classList.contains('is-disabled')).toBe(true)
  })

  it('拖动更新 v-model 并触发 drag 事件（后台线程交互路径）', async () => {
    // 轨道宽 100px：拖动 50px ≈ 值 +50
    mockSelectorRects({ track: { width: 100, height: 20 } })
    const value = ref(20)
    const events: string[] = []
    const Wrapper = {
      components: { WdSlider },
      setup: () => ({
        value,
        onDragstart: () => events.push('dragstart'),
        onDragmove: () => events.push('dragmove'),
        onDragend: () => events.push('dragend'),
        onChange: () => events.push('change')
      }),
      template: `<WdSlider v-model="value" :min="0" :max="100"
        @dragstart="onDragstart" @dragmove="onDragmove" @dragend="onDragend" @change="onChange" />`
    }
    const { container } = render(Wrapper)
    const dot = container.querySelector('.wd-slider__dot')!
    fireEvent.touchstart(dot, { touches: [{ clientX: 10, clientY: 0 }] })
    await wait()
    fireEvent.touchmove(dot, { touches: [{ clientX: 60, clientY: 0 }] })
    await wait()
    expect(value.value).toBe(70)
    fireEvent.touchend(dot, { touches: [{ clientX: 60, clientY: 0 }] })
    await wait()
    expect(events).toEqual(['dragstart', 'dragmove', 'dragend', 'change'])
    // 进度条宽度随值更新
    const line = container.querySelector('.wd-slider__line') as HTMLElement
    expect(line.style.width).toContain('70')
  })

  it('禁用时拖动不更新值', async () => {
    mockSelectorRects({ track: { width: 100, height: 20 } })
    const value = ref(20)
    const Wrapper = {
      components: { WdSlider },
      setup: () => ({ value }),
      template: `<WdSlider v-model="value" disabled :min="0" :max="100" />`
    }
    const { container } = render(Wrapper)
    const dot = container.querySelector('.wd-slider__dot')!
    fireEvent.touchstart(dot, { touches: [{ clientX: 10, clientY: 0 }] })
    fireEvent.touchmove(dot, { touches: [{ clientX: 60, clientY: 0 }] })
    await wait()
    expect(value.value).toBe(20)
  })
})
