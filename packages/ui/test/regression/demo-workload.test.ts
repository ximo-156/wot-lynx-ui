/** Workload budgets are node/lifecycle assertions, not a device FPS benchmark. */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, onBeforeUnmount, onMounted } from 'vue-lynx'
import DemoApp from '../../../demo/src/App.vue'
import DeviceApp from '../../../demo/src/device-test/App.vue'
import ShowcaseLayout from '../../../demo/src/showcase/ShowcaseLayout'
import DemoSection from '../../../demo/src/showcase/DemoSection'
import wotLynxUI from '../../src/index'
import { cleanup, render } from '../render'
import { fireEvent } from '../fire-event'

async function select(container: Element, prefix: string, name: string) {
  fireEvent.tap(container.querySelector(`#${prefix}-directory-toggle`)!)
  await nextTick()
  const item = container.querySelector(`#${prefix}-select-${name}`)
  expect(item, `missing accessible demo ${name}`).not.toBeNull()
  fireEvent.tap(item!)
  await nextTick()
}

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.useRealTimers() })

describe('bounded demo workload', () => {
  it.each([['main', DemoApp, 450], ['device-test', DeviceApp, 600]] as const)('%s does not mount the full catalog on startup', async (_name, component, limit) => {
    const { container } = render(component as any, {}, [wotLynxUI])
    await nextTick()
    expect(container.querySelector('.wd-button')).not.toBeNull()
    expect(container.querySelectorAll('*').length).toBeLessThan(limit)
    expect(container.querySelector('.wd-calendar-view')).toBeNull()
    expect(container.querySelector('.wd-signature')).toBeNull()
    expect(container.querySelector('.wd-count-down')).toBeNull()
    expect(container.querySelector('.wd-count-to')).toBeNull()
    expect(container.querySelector('.showcase__browser')?.getAttribute('render-mode')).toBe('single')
    expect(container.querySelector('wd-button')).toBeNull()
  })

  it('keeps all device catalogs reachable without duplicating live interaction cases', async () => {
    const { container } = render(DeviceApp, {}, [wotLynxUI])
    await select(container, 'device-tests', 'slider')
    expect(container.querySelectorAll('.wd-slider')).toHaveLength(3)
    expect(container.querySelector('.wd-calendar-view')).toBeNull()
    await select(container, 'device-tests', 'catalog')
    expect(container.querySelectorAll('.wd-slider')).toHaveLength(0)
    expect(container.querySelectorAll('.demo-section')).toHaveLength(1)
    await select(container, 'showcase', 'cascader')
    expect(container.querySelector('.wd-cascader')).not.toBeNull()
    expect(container.querySelectorAll('.demo-section')).toHaveLength(1)
    expect(container.querySelector('.wd-calendar-view')).toBeNull()
    fireEvent.tap(container.querySelector('.demo-section .wd-button')!)
    await nextTick()
    expect(container.querySelector('.wd-cascader__popup')?.textContent).toContain('选择地区')
    // Navigation unmounts the modal, including its page scroll-lock lease.
    await select(container, 'showcase', 'calendar-view')
    expect(container.querySelector('#device-test-page')!.getAttribute('scroll-enable')).toBe('true')
    expect(container.querySelector('.wd-calendar-view')).not.toBeNull()
    expect(container.querySelector('.wd-cascader')).toBeNull()
    await select(container, 'showcase', 'button')
    expect(container.querySelector('.wd-calendar-view')).toBeNull()
    expect(container.querySelectorAll('*').length).toBeLessThan(650)
  }, 30_000)

  it('registers raw touch diagnostics only while explicitly enabled', async () => {
    const env = (globalThis as any).lynxTestingEnv
    const listeners = vi.spyOn(env.jsdom.window.Element.prototype, 'addEventListener')
    const { container } = render(DeviceApp, {}, [wotLynxUI])
    await select(container, 'device-tests', 'slider')
    const probe = container.querySelector('#slider-native-probe')!
    const registrations = () => listeners.mock.calls.filter((args, index) =>
      listeners.mock.contexts[index] === probe && args[0] === 'bindEvent:touchmove').length
    expect(registrations(), 'disabled diagnostics must not cross to JS for every touchmove').toBe(0)
    const toggle = [...container.querySelectorAll('.wd-button')].find(button => button.textContent?.includes('显示滑块诊断'))!
    fireEvent.tap(toggle)
    await nextTick()
    expect(registrations()).toBe(1)
    fireEvent.touchstart(probe, { touches: [{ identifier: 1, clientX: 10, clientY: 10 }] })
    fireEvent.touchmove(probe, { touches: [{ identifier: 1, clientX: 20, clientY: 10 }] })
    await nextTick()
    expect(container.textContent).toContain('原生移动 1 / 有效移动 0')
    fireEvent.tap(toggle)
    await nextTick()
    expect(container.textContent).not.toContain('原生移动')
  })

  it('preserves checklist progress and controlled values across section unmounts', async () => {
    const device = render(DeviceApp, {}, [wotLynxUI])
    fireEvent.tap(device.container.querySelector('.checklist__item')!)
    await nextTick()
    expect(device.container.querySelector('.progress__count')!.textContent).toContain('已完成 1 /')
    await select(device.container, 'device-tests', 'slider')
    await select(device.container, 'device-tests', 'button')
    expect(device.container.querySelectorAll('.checklist__box--on')).toHaveLength(1)
    expect(device.container.querySelector('.progress__count')!.textContent).toContain('已完成 1 /')
    cleanup()
    const main = render(DemoApp, {}, [wotLynxUI])
    fireEvent.tap(main.container.querySelector('.demo-section .wd-button')!)
    await nextTick()
    await select(main.container, 'showcase', 'form')
    await select(main.container, 'showcase', 'button')
    expect(main.container.querySelector('.page__subtitle')!.textContent).toMatch(/· 1$/)
  })

  it('does not evaluate inactive slots and disposes their periodic work on navigation', async () => {
    vi.useFakeTimers()
    const slots = { a: vi.fn(), b: vi.fn() }
    const ticks = { a: 0, b: 0 }
    const mounted = { a: 0, b: 0 }
    const unmounted = { a: 0, b: 0 }
    const Probe = defineComponent({
      props: { name: { type: String, required: true } },
      setup(props) {
        const name = props.name as 'a' | 'b'
        let timer: ReturnType<typeof setInterval>
        onMounted(() => {
          mounted[name]++
          timer = setInterval(() => { ticks[name]++ }, 100)
        })
        onBeforeUnmount(() => { clearInterval(timer); unmounted[name]++ })
        return () => h('text', { class: `probe-${name}` }, name)
      }
    })
    const { container } = render({
      setup: () => () => h(ShowcaseLayout, { browse: true, idPrefix: 'test-browser' }, {
        default: () => (['a', 'b'] as const).map(name => h(DemoSection, { name, title: name }, {
          default: () => { slots[name](); return h(Probe, { name }) }
        }))
      })
    })
    await nextTick()
    expect(slots.b).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(300)
    expect(ticks).toEqual({ a: 3, b: 0 })
    await select(container, 'test-browser', 'b')
    expect(unmounted.a).toBe(1)
    await vi.advanceTimersByTimeAsync(300)
    expect(ticks).toEqual({ a: 3, b: 3 })
    await select(container, 'test-browser', 'a')
    expect(mounted).toEqual({ a: 2, b: 1 })
    expect(unmounted.b).toBe(1)
    fireEvent.tap(container.querySelector('#test-browser-stress-toggle')!)
    await nextTick()
    expect(container.querySelectorAll('.probe-a, .probe-b')).toHaveLength(2)
    expect(container.querySelector('.showcase__browser')!.getAttribute('render-mode')).toBe('stress')
    fireEvent.tap(container.querySelector('#test-browser-stress-toggle')!)
    await nextTick()
    expect(container.querySelectorAll('.probe-a, .probe-b')).toHaveLength(1)
    cleanup()
    const before = { ...ticks }
    await vi.advanceTimersByTimeAsync(1000)
    expect(ticks).toEqual(before)
  })
})
