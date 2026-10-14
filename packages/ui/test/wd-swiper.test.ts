import { describe, it, expect, afterEach, vi } from 'vitest'
import { ref } from 'vue-lynx'
import { render } from './render'
import { fireEvent } from './fire-event'
import WdSwiper from '../src/components/wd-swiper/wd-swiper.vue'

const wait = (ms = 30) => new Promise((r) => setTimeout(r, ms))

/** 按选择器返回指定尺寸的矩形（默认 setup mock 返回零尺寸，轮播换算需要非零容器宽） */
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

const CONTAINER_WIDTH = 300

function trackOf(container: Element) {
  return container.querySelector('.wd-swiper__track') as HTMLElement
}

function trackTransform(container: Element) {
  const track = trackOf(container)
  return (track && (track.style.transform || track.getAttribute('style'))) || ''
}

/** 容器宽 300px、循环 3 项时，真实下标 index 对应的轨道位移 */
function expectedOffset(index: number) {
  return `translate3d(${-CONTAINER_WIDTH * (index + 1)}px`
}

describe('wd-swiper', () => {
  it('回归：不使用原生 swiper / swiper-item 元素（宿主未注册 BehaviorController 不再触发 9902 致命异常）', () => {
    const Wrapper = {
      components: { WdSwiper },
      setup: () => ({ list: ['a', 'b', 'c'] }),
      template: `<WdSwiper :list="list" :autoplay="false" />`
    }
    const { container } = render(Wrapper)
    // LynxUI 扩展元素（swiper / swiper-item）完全不出现，仅使用引擎内置元素
    expect(container.querySelector('swiper')).toBeNull()
    expect(container.querySelector('swiper-item')).toBeNull()
    // 循环播放：首尾各追加一个克隆项（3 + 2）
    expect(container.querySelectorAll('.wd-swiper__item').length).toBe(5)
    expect(container.querySelectorAll('.wd-swiper__image').length).toBe(5)
    // 指示器：3 个 dot
    expect(container.querySelectorAll('.wd-swiper-nav__item--dots').length).toBe(3)
  })

  it('非循环不渲染克隆项', () => {
    const Wrapper = {
      components: { WdSwiper },
      setup: () => ({ list: ['a', 'b', 'c'] }),
      template: `<WdSwiper :list="list" :autoplay="false" :loop="false" />`
    }
    const { container } = render(Wrapper)
    expect(container.querySelectorAll('.wd-swiper__item').length).toBe(3)
  })

  it('单列表单不渲染克隆项且可正常挂载', () => {
    const Wrapper = {
      components: { WdSwiper },
      setup: () => ({ list: ['a'] }),
      template: `<WdSwiper :list="list" :autoplay="false" />`
    }
    const { container } = render(Wrapper)
    expect(container.querySelectorAll('.wd-swiper__item').length).toBe(1)
  })

  it('度量首次返回零矩形时重试并就位（真机节点未布局完成）', async () => {
    // 前两次查询返回零矩形（节点未布局），第三次返回真实尺寸
    const lynx = (globalThis as any).lynx
    let calls = 0
    lynx.createSelectorQuery = () => {
      const makeRef = () => ({
        invoke(options: any) {
          calls++
          const rect = calls <= 2 ? { width: 0, height: 0 } : { width: CONTAINER_WIDTH, height: 150 }
          if (options && typeof options.success === 'function') {
            setTimeout(() => options.success({ left: 0, top: 0, right: 0, bottom: 0, ...rect }), 0)
          }
          return { exec: () => {} }
        },
        boundingClientRect(cb: any) {
          if (typeof cb === 'function') setTimeout(() => cb({ width: 0, height: 0 }), 0)
          return { exec: () => {} }
        },
        fields(_: any, cb: any) {
          if (typeof cb === 'function') setTimeout(() => cb({ width: 0, height: 0 }), 0)
          return { exec: () => {} }
        }
      })
      return {
        select: () => makeRef(),
        selectAll: () => makeRef(),
        in: () => ({ select: () => makeRef(), selectAll: () => makeRef(), exec: () => {} }),
        exec: () => {}
      }
    }
    const Wrapper = {
      components: { WdSwiper },
      setup: () => ({ list: ['a', 'b', 'c'] }),
      template: `<WdSwiper :list="list" :autoplay="false" />`
    }
    const { container } = render(Wrapper)
    await wait()
    // 尚未取得尺寸：保持在初始位移
    expect(trackTransform(container)).toContain('translate3d(0px')
    // 重试（100ms 间隔）后取得尺寸并瞬移就位
    await wait(260)
    expect(calls).toBeGreaterThanOrEqual(3)
    expect(trackTransform(container)).toContain(expectedOffset(0))
  })

  it('程序设置 current（v-model 受控）时轨道结算到对应位置', async () => {
    mockSelectorRects({ '.wd-swiper': { width: CONTAINER_WIDTH, height: 150 } })
    const value = ref(0)
    const Wrapper = {
      components: { WdSwiper },
      setup: () => ({ list: ['a', 'b', 'c'], value }),
      template: `<WdSwiper :current="value" :list="list" :autoplay="false" @update:current="value = $event" />`
    }
    const { container } = render(Wrapper)
    await wait()
    // 初始就位：真实下标 0 → 轨道位置 1（循环）→ -300px
    expect(trackTransform(container)).toContain(expectedOffset(0))
    value.value = 2
    await wait()
    expect(trackTransform(container)).toContain(expectedOffset(2))
    // 指示器高亮跟随
    const dots = container.querySelectorAll('.wd-swiper-nav__item--dots')
    expect(dots[2].className).toContain('is-active')
  })

  it('横向拖动切换当前项并同步 v-model（后台线程手势路径）', async () => {
    mockSelectorRects({ '.wd-swiper': { width: CONTAINER_WIDTH, height: 150 } })
    const value = ref(0)
    const Wrapper = {
      components: { WdSwiper },
      setup: () => ({ list: ['a', 'b', 'c'], value }),
      template: `<WdSwiper :current="value" :list="list" :autoplay="false" @update:current="value = $event" />`
    }
    const { container } = render(Wrapper)
    const root = container.querySelector('.wd-swiper')!
    await wait()
    fireEvent.touchstart(root, { touches: [{ clientX: 200, clientY: 100 }] })
    await wait()
    fireEvent.touchmove(root, { touches: [{ clientX: 0, clientY: 100 }] })
    await wait()
    // 慢速拖动（等待 600ms 保证不触发甩动阈值），位移 -200px 超过半格 → 落到下一项
    await wait(600)
    fireEvent.touchend(root, { touches: [{ clientX: 0, clientY: 100 }] })
    await wait()
    expect(value.value).toBe(1)
    expect(trackTransform(container)).toContain(expectedOffset(1))
  })

  it('小幅拖动回弹到当前项', async () => {
    mockSelectorRects({ '.wd-swiper': { width: CONTAINER_WIDTH, height: 150 } })
    const value = ref(1)
    const Wrapper = {
      components: { WdSwiper },
      setup: () => ({ list: ['a', 'b', 'c'], value }),
      template: `<WdSwiper :current="value" :list="list" :autoplay="false" @update:current="value = $event" />`
    }
    const { container } = render(Wrapper)
    const root = container.querySelector('.wd-swiper')!
    await wait()
    fireEvent.touchstart(root, { touches: [{ clientX: 200, clientY: 100 }] })
    await wait()
    fireEvent.touchmove(root, { touches: [{ clientX: 180, clientY: 100 }] })
    await wait(400)
    fireEvent.touchend(root, { touches: [{ clientX: 180, clientY: 100 }] })
    await wait()
    expect(value.value).toBe(1)
    expect(trackTransform(container)).toContain(expectedOffset(1))
  })

  it('快速甩动额外多滑一格', async () => {
    mockSelectorRects({ '.wd-swiper': { width: CONTAINER_WIDTH, height: 150 } })
    const value = ref(0)
    const Wrapper = {
      components: { WdSwiper },
      setup: () => ({ list: ['a', 'b', 'c'], value }),
      template: `<WdSwiper :current="value" :list="list" :autoplay="false" @update:current="value = $event" />`
    }
    const { container } = render(Wrapper)
    const root = container.querySelector('.wd-swiper')!
    await wait()
    fireEvent.touchstart(root, { touches: [{ clientX: 200, clientY: 100 }] })
    await wait()
    // -300px 已过半，且松手足够快（> 0.4px/ms）→ 落到下标 2
    fireEvent.touchmove(root, { touches: [{ clientX: -100, clientY: 100 }] })
    fireEvent.touchend(root, { touches: [{ clientX: -100, clientY: 100 }] })
    await wait()
    expect(value.value).toBe(2)
    expect(trackTransform(container)).toContain(expectedOffset(2))
  })

  it('纵向轮播按容器高度换算位移', async () => {
    mockSelectorRects({ '.wd-swiper': { width: CONTAINER_WIDTH, height: 150 } })
    const value = ref(0)
    const Wrapper = {
      components: { WdSwiper },
      setup: () => ({ list: ['a', 'b', 'c'], value }),
      template: `<WdSwiper :current="value" :list="list" :autoplay="false" direction="vertical" @update:current="value = $event" />`
    }
    const { container } = render(Wrapper)
    await wait()
    // 容器高 150px：初始就位 -150px（translateY），而非按宽度换算的 -300px
    expect(trackTransform(container)).toContain('translate3d(0, -150px, 0)')
    value.value = 2
    await wait()
    expect(trackTransform(container)).toContain('translate3d(0, -450px, 0)')
  })

  it('纵向滑动不触发横向轮播切换', async () => {
    mockSelectorRects({ '.wd-swiper': { width: CONTAINER_WIDTH, height: 150 } })
    const value = ref(0)
    const Wrapper = {
      components: { WdSwiper },
      setup: () => ({ list: ['a', 'b', 'c'], value }),
      template: `<WdSwiper :current="value" :list="list" :autoplay="false" @update:current="value = $event" />`
    }
    const { container } = render(Wrapper)
    const root = container.querySelector('.wd-swiper')!
    await wait()
    fireEvent.touchstart(root, { touches: [{ clientX: 200, clientY: 100 }] })
    await wait()
    fireEvent.touchmove(root, { touches: [{ clientX: 200, clientY: 300 }] })
    await wait()
    fireEvent.touchend(root, { touches: [{ clientX: 200, clientY: 300 }] })
    await wait()
    expect(value.value).toBe(0)
    expect(trackTransform(container)).toContain(expectedOffset(0))
  })

  it('自动播放按 interval 推进并循环', async () => {
    mockSelectorRects({ '.wd-swiper': { width: CONTAINER_WIDTH, height: 150 } })
    const value = ref(0)
    const Wrapper = {
      components: { WdSwiper },
      setup: () => ({ list: ['a', 'b', 'c'], value }),
      template: `<WdSwiper :current="value" :list="list" :interval="400" @update:current="value = $event" />`
    }
    const { container, unmount } = render(Wrapper)
    await wait()
    await wait(460)
    expect(value.value).toBe(1)
    expect(trackTransform(container)).toContain(expectedOffset(1))
    await wait(460)
    expect(value.value).toBe(2)
    await wait(460)
    // 循环：最后一项之后回到第一项
    expect(value.value).toBe(0)
    expect(trackTransform(container)).toContain(expectedOffset(0))
    unmount()
  })

  it('点击轮播项派发 click 事件（index 为真实下标）', async () => {
    const onClick = vi.fn()
    const Wrapper = {
      components: { WdSwiper },
      setup: () => ({ list: ['a', 'b', 'c'], onClick }),
      template: `<WdSwiper :list="list" :autoplay="false" @click="onClick">
        <template #default="{ item }"><text>{{ item }}</text></template>
      </WdSwiper>`
    }
    const { container } = render(Wrapper)
    await wait()
    const items = container.querySelectorAll('.wd-swiper__item')
    // 循环时渲染顺序为 [尾克隆, 0, 1, 2, 首克隆]，第 4 项为真实下标 2
    fireEvent.tap(items[3], {})
    await wait()
    expect(onClick).toHaveBeenCalledTimes(1)
    expect(onClick.mock.calls[0][0]).toMatchObject({ index: 2, item: 'c' })
  })

  it('默认插槽内容按项渲染（作用域插槽）', async () => {
    const Wrapper = {
      components: { WdSwiper },
      setup: () => ({ list: ['a', 'b', 'c'] }),
      template: `<WdSwiper :list="list" :autoplay="false">
        <template #default="{ item, index }"><text class="slot-text">{{ index }}:{{ item }}</text></template>
      </WdSwiper>`
    }
    const { container } = render(Wrapper)
    await wait()
    const texts = container.querySelectorAll('.slot-text')
    // 循环时含克隆项，内容与真实数据一致
    expect(texts.length).toBe(5)
    expect(texts[0].textContent).toBe('2:c')
    expect(texts[1].textContent).toBe('0:a')
    expect(texts[3].textContent).toBe('2:c')
    expect(texts[4].textContent).toBe('0:a')
  })
})
