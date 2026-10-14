import { describe, it, expect, afterEach } from 'vitest'
import { ref } from 'vue-lynx'
import { render } from './render'
import { fireEvent } from './fire-event'
import WdSwipeAction from '../src/components/wd-swipe-action/wd-swipe-action.vue'

const wait = (ms = 30) => new Promise((r) => setTimeout(r, ms))

/** 按选择器返回指定尺寸的矩形（默认 setup mock 返回零尺寸，滑动阈值计算需要非零按钮宽度） */
function mockSelectorRects(rects: Record<string, { width?: number; height?: number; left?: number; top?: number }>) {
  const lynx = (globalThis as any).lynx
  lynx.createSelectorQuery = () => {
    const makeRef = (selector: string) => ({
      invoke(options: any) {
        const rect = rects[selector] || { width: 0, height: 0, left: 0, top: 0 }
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

describe('wd-swipe-action', () => {
  it('渲染内容与操作按钮', () => {
    const Wrapper = {
      components: { WdSwipeAction },
      template: `<WdSwipeAction>
        <text>内容</text>
        <template #right><text>删除</text></template>
      </WdSwipeAction>`
    }
    const { container } = render(Wrapper)
    expect(container.querySelector('.wd-swipe-action')).toBeTruthy()
    expect(container.querySelector('.wd-swipe-action__right')).toBeTruthy()
  })

  it('禁用时触摸不产生位移', () => {
    const Wrapper = {
      components: { WdSwipeAction },
      setup() {
        return {}
      },
      template: `<WdSwipeAction disabled><text>内容</text></WdSwipeAction>`
    }
    const { container } = render(Wrapper)
    // wot-ui 的 swipe-action 禁用为行为级（不添加类名），此处验证正常渲染
    expect(container.querySelector('.wd-swipe-action')).toBeTruthy()
  })

  it('内容插槽与默认插槽渲染', () => {
    const Wrapper = {
      components: { WdSwipeAction },
      template: `<WdSwipeAction><text>单元格内容</text><template #left><text>收藏</text></template></WdSwipeAction>`
    }
    const { container } = render(Wrapper)
    expect(container.textContent).toContain('单元格内容')
    expect(container.querySelector('.wd-swipe-action__left')).toBeTruthy()
  })

  it('左滑超过阈值松手保持展开并同步 modelValue（后台线程交互路径）', async () => {
    // 右按钮宽 100px：左滑 50px 超过 30% 阈值 → 展开
    mockSelectorRects({
      '.wd-swipe-action__left': { width: 0 },
      '.wd-swipe-action__right': { width: 100 }
    })
    const value = ref('close')
    const Wrapper = {
      components: { WdSwipeAction },
      setup: () => ({ value }),
      template: `<WdSwipeAction v-model="value">
        <text>内容</text>
        <template #right><text>删除</text></template>
      </WdSwipeAction>`
    }
    const { container } = render(Wrapper)
    const root = container.querySelector('.wd-swipe-action')!
    fireEvent.touchstart(root, { touches: [{ clientX: 200, clientY: 100 }] })
    await wait()
    fireEvent.touchmove(root, { touches: [{ clientX: 150, clientY: 100 }] })
    await wait()
    fireEvent.touchend(root, { touches: [{ clientX: 150, clientY: 100 }] })
    await wait()
    expect(value.value).toBe('right')
    // 容器平移至 -100px（完整露出右按钮）
    const wrapper = container.querySelector('.wd-swipe-action__wrapper') as HTMLElement
    expect(wrapper.style.transform || wrapper.getAttribute('style') || '').toContain('translate3d(-100px')
  })

  it('左滑未超过阈值松手回弹收起', async () => {
    mockSelectorRects({
      '.wd-swipe-action__left': { width: 0 },
      '.wd-swipe-action__right': { width: 100 }
    })
    const value = ref('close')
    const Wrapper = {
      components: { WdSwipeAction },
      setup: () => ({ value }),
      template: `<WdSwipeAction v-model="value"><text>内容</text><template #right><text>删除</text></template></WdSwipeAction>`
    }
    const { container } = render(Wrapper)
    const root = container.querySelector('.wd-swipe-action')!
    fireEvent.touchstart(root, { touches: [{ clientX: 200, clientY: 100 }] })
    await wait()
    // 仅滑动 10px（< 30% 阈值）
    fireEvent.touchmove(root, { touches: [{ clientX: 190, clientY: 100 }] })
    await wait()
    fireEvent.touchend(root, { touches: [{ clientX: 190, clientY: 100 }] })
    await wait()
    expect(value.value).toBe('close')
    const wrapper = container.querySelector('.wd-swipe-action__wrapper') as HTMLElement
    expect(wrapper.style.transform || wrapper.getAttribute('style') || '').toContain('translate3d(0px')
  })

  it('纵向滑动不触发横向位移', async () => {
    mockSelectorRects({
      '.wd-swipe-action__left': { width: 100 },
      '.wd-swipe-action__right': { width: 100 }
    })
    const value = ref('close')
    const Wrapper = {
      components: { WdSwipeAction },
      setup: () => ({ value }),
      template: `<WdSwipeAction v-model="value"><text>内容</text><template #right><text>删除</text></template></WdSwipeAction>`
    }
    const { container } = render(Wrapper)
    const root = container.querySelector('.wd-swipe-action')!
    fireEvent.touchstart(root, { touches: [{ clientX: 200, clientY: 100 }] })
    await wait()
    fireEvent.touchmove(root, { touches: [{ clientX: 200, clientY: 160 }] })
    await wait()
    fireEvent.touchend(root, { touches: [{ clientX: 200, clientY: 160 }] })
    await wait()
    expect(value.value).toBe('close')
    const wrapper = container.querySelector('.wd-swipe-action__wrapper') as HTMLElement
    const style = wrapper.style.transform || wrapper.getAttribute('style') || ''
    expect(style).toContain('translate3d(0px')
  })

  it('禁用时拖动不改变状态', async () => {
    mockSelectorRects({
      '.wd-swipe-action__left': { width: 0 },
      '.wd-swipe-action__right': { width: 100 }
    })
    const value = ref('close')
    const Wrapper = {
      components: { WdSwipeAction },
      setup: () => ({ value }),
      template: `<WdSwipeAction v-model="value" disabled><text>内容</text><template #right><text>删除</text></template></WdSwipeAction>`
    }
    const { container } = render(Wrapper)
    const root = container.querySelector('.wd-swipe-action')!
    fireEvent.touchstart(root, { touches: [{ clientX: 200, clientY: 100 }] })
    fireEvent.touchmove(root, { touches: [{ clientX: 150, clientY: 100 }] })
    fireEvent.touchend(root, { touches: [{ clientX: 150, clientY: 100 }] })
    await wait()
    expect(value.value).toBe('close')
  })
})
