/**
 * Real Showcase + registered library components, not unresolved wd-* elements.
 * These demo contracts check native nodes, explicit indicator host geometry and
 * tap/change feedback. They do not claim to be an on-device screenshot test.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue-lynx'
import Showcase from '../../../demo/src/showcase/Showcase.vue'
import wotLynxUI from '../../src/index'
import { cleanup, render } from '../render'
import { fireEvent } from '../fire-event'
import { pause } from '@wot-lynx/core/common/util'

afterEach(cleanup)

async function mountShowcase() {
  const mounted = render(Showcase, {}, [wotLynxUI])
  await pause(40)
  return mounted
}

function expectCurrent(container: Element, index: number) {
  const previews = Array.from(container.querySelectorAll('.demo-swiper-nav-preview'))
  expect(previews).toHaveLength(3)
  for (const type of ['dots', 'dots-bar']) {
    const items = Array.from(container.querySelectorAll(`.demo-swiper-nav-preview .wd-swiper-nav__item--${type}`))
    expect(items).toHaveLength(3)
    expect(items.filter((item) => item.classList.contains('is-active'))).toHaveLength(1)
    expect(items[index].classList.contains('is-active')).toBe(true)
  }
  expect(container.querySelector('.demo-swiper-nav-preview .wd-swiper-nav__fraction-text')!.textContent).toBe(`${index + 1}/3`)
  expect(container.querySelector('.demo-swiper-nav-value')!.textContent).toBe(`当前：${index + 1}/3`)
}

describe('Showcase Segmented/SwiperNav real demo contracts', () => {
  it('binds the valid Segmented value and reflects native taps through update:value', async () => {
    const { container } = await mountShowcase()
    expect(container.querySelector('wd-segmented')).toBeNull()
    const segmented = container.querySelector('.wd-segmented')!
    const items = Array.from(segmented.querySelectorAll('.wd-segmented__item'))
    expect(items.map((item) => item.querySelector('text')!.textContent)).toEqual(['日', '周', '月'])
    expect(items[0].classList.contains('is-active')).toBe(true)
    expect(container.querySelector('.demo-segmented-value')!.textContent).toBe('分段选择：日')
    fireEvent.tap(items[1]); await nextTick()
    expect(container.querySelector('.demo-segmented-value')!.textContent).toBe('分段选择：周')
    expect(items[1].classList.contains('is-active')).toBe(true)
    fireEvent.tap(items[2]); await nextTick()
    expect(container.querySelector('.demo-segmented-value')!.textContent).toBe('分段选择：月')
    expect(items[2].classList.contains('is-active')).toBe(true)
  })

  it('renders all real indicator types in nonzero, positioned native hosts', async () => {
    const { container } = await mountShowcase()
    expect(container.querySelector('wd-swiper-nav')).toBeNull()
    const previews = Array.from(container.querySelectorAll('.demo-swiper-nav-preview')) as HTMLElement[]
    expect(previews).toHaveLength(3)
    for (const [index, type] of ['dots', 'dots-bar', 'fraction'].entries()) {
      const host = previews[index]
      expect(host.tagName.toLowerCase()).toBe('view')
      expect(host.style.position).toBe('relative')
      expect(host.style.height).toBe('88px')
      expect(host.style.width).toBe('100%')
      expect(host.style.display).toBe('flex')
      // 演示宿主底色消费主色令牌（亮暗各自取值，暗色无亮色残留）；jsdom 不解析
      // var()，断言的是令牌引用本身——非空即保证白色导航图标有可见底色。
      expect(host.style.backgroundColor).toBe('var(--wot-primary-6)')
      expect(host.querySelector(`.wd-swiper-nav--${type}`)).not.toBeNull()
      expect(host.querySelectorAll('.wd-swiper-nav__btn')).toHaveLength(2)
    }
    expectCurrent(container, 0)
  })

  it('consumes nav direction events, wraps current and displays the actual event payload', async () => {
    const { container } = await mountShowcase()
    const previews = Array.from(container.querySelectorAll('.demo-swiper-nav-preview'))
    fireEvent.tap(previews[0].querySelector('.wd-swiper-nav__btn--prev')!)
    await nextTick()
    expectCurrent(container, 2)
    expect(container.querySelector('.demo-swiper-nav-event')!.textContent).toBe('事件：nav: prev')
    fireEvent.tap(previews[2].querySelector('.wd-swiper-nav__btn--next')!)
    await nextTick()
    expectCurrent(container, 0)
    expect(container.querySelector('.demo-swiper-nav-event')!.textContent).toBe('事件：nav: next')
    fireEvent.tap(previews[1].querySelector('.wd-swiper-nav__btn--next')!)
    await nextTick()
    expectCurrent(container, 1)
  })
})
