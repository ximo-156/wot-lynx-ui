/** Independent wot-ui 2.3.2 behavioral regressions: real events, positive paths and cancellation. */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { h, nextTick, ref } from 'vue-lynx'
import { cleanup, render } from './render'
import { fireEvent } from './fire-event'
import { configureUniAdapter } from '../src/common/uni'
import PickerView from '../src/components/wd-picker-view/wd-picker-view.vue'
import Slider from '../src/components/wd-slider/wd-slider.vue'
import Rate from '../src/components/wd-rate/wd-rate.vue'
import Search from '../src/components/wd-search/wd-search.vue'
import Input from '../src/primitives/wd-input/wd-input.vue'
import Form from '../src/components/wd-form/wd-form.vue'
import FormItem from '../src/components/wd-form-item/wd-form-item.vue'
import Segmented from '../src/components/wd-segmented/wd-segmented.vue'
import KeyboardKey from '../src/components/wd-keyboard/key/index.vue'
import ImgCropper from '../src/components/wd-img-cropper/wd-img-cropper.vue'
import Signature from '../src/components/wd-signature/wd-signature.vue'
import MonthPanel from '../src/components/wd-calendar-view/monthPanel/month-panel.vue'
import YearPanel from '../src/components/wd-calendar-view/yearPanel/year-panel.vue'
import Radio from '../src/components/wd-radio/wd-radio.vue'
import RadioGroup from '../src/components/wd-radio-group/wd-radio-group.vue'
import Checkbox from '../src/components/wd-checkbox/wd-checkbox.vue'

const restores: Array<() => void> = []
afterEach(() => {
  cleanup()
  restores.splice(0).forEach((restore) => restore())
  configureUniAdapter({ createSelectorQuery: undefined, getImageInfo: undefined, createCanvasContext: undefined, canvasToTempFilePath: undefined })
  delete (globalThis as any).__wdRectStub
  vi.clearAllTimers()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

function mount(component: any, initial: Record<string, any>) {
  const props = ref(initial)
  let instance: any
  const result = render({
    setup: () => () => h(component, { ...props.value, ref: (value: any) => { instance = value } })
  } as any)
  return { ...result, props, instance: () => instance }
}
function node(container: Element, selector: string): Element {
  const element = container.querySelector(selector)
  expect(element, selector).not.toBeNull()
  return element!
}
async function flush() { await nextTick(); await Promise.resolve(); await nextTick() }
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => { resolve = done })
  return { promise, resolve }
}
describe('official selection glyph regression', () => {
  it('radio and checkbox render original wot-ui glyphs for every live shape and checked state', async () => {
    const type = ref<'circle' | 'square' | 'dot' | 'button'>('circle')
    const selected = ref('selected'), checked = ref(true), indeterminate = ref(false)
    const { container } = render({
      setup: () => () => h('view', null, [
        h(RadioGroup as any, { modelValue: selected.value, type: type.value }, {
          default: () => [h(Radio as any, { value: 'selected' }), h(Radio as any, { value: 'other' })]
        }),
        h(Checkbox as any, { modelValue: checked.value, type: type.value, indeterminate: indeterminate.value })
      ])
    } as any)
    // Independent official 2.3.2 iconfont codepoints, not a lookup into the local registry.
    const glyphs: Record<string, string> = {
      'check-circle-fill': '\ue747', 'uncheck-circle': '\ue734',
      'check-square-fill': '\ue725', 'uncheck-square': '\ue733',
      'check-circle-radio-fill': '\ue723', check: '\ue726', 'minus-circle-fill': '\ue72d'
    }
    function assertGlyph(element: Element, name: string) {
      const icon = element.querySelector('.wd-icon')
      if (!name) { expect(icon).toBeNull(); return }
      expect(icon?.classList.contains(`wd-icon-${name}`)).toBe(true)
      const glyph = node(element, '.wd-icon__glyph') as HTMLElement
      expect(glyph.textContent).toBe(glyphs[name])
      expect(glyph.style.fontFamily).toBe('wd-wot-icons')
    }
    const shapes = [
      ['circle', 'check-circle-fill', 'uncheck-circle'],
      ['square', 'check-square-fill', 'uncheck-square'],
      ['dot', 'check-circle-radio-fill', 'uncheck-circle'],
      ['button', 'check', '']
    ] as const
    for (const [shape, on, off] of shapes) {
      type.value = shape; selected.value = 'selected'; checked.value = true; indeterminate.value = false
      await flush()
      let radios = container.querySelectorAll('.wd-radio')
      assertGlyph(radios[0], on); assertGlyph(radios[1], off)
      assertGlyph(node(container, '.wd-checkbox'), on)
      selected.value = 'other'; checked.value = false
      await flush()
      radios = container.querySelectorAll('.wd-radio')
      assertGlyph(radios[0], off); assertGlyph(radios[1], on)
      assertGlyph(node(container, '.wd-checkbox'), off)
      indeterminate.value = true
      await flush()
      assertGlyph(node(container, '.wd-checkbox'), shape === 'button' ? '' : 'minus-circle-fill')
      checked.value = true
      await flush()
      assertGlyph(node(container, '.wd-checkbox'), shape === 'button' ? 'check' : 'minus-circle-fill')
    }
    expect(container.querySelector('[class*="__icon--empty"], [class*="__icon--dot"], [class*="__icon--circle"], [class*="__icon--square"]')).toBeNull()
  })
})

const rect = (left = 0, width = 200, height = 100) => ({ id: '', left, top: 0, right: left + width, bottom: height, width, height })
const stars = (left = 0, count = 5) => Array.from({ length: count }, (_, index) => rect(left + index * 30, 24, 24))
function geometry(provider: (selector: string, all: boolean) => any = (_selector, all) => all ? stars() : rect()) {
  configureUniAdapter({ createSelectorQuery: () => {
    const query: any = {
      in: () => query,
      select: (selector: string) => selected(selector, false),
      selectAll: (selector: string) => selected(selector, true),
      exec() {}
    }
    function selected(selector: string, all: boolean) {
      return { invoke: (options: any) => { options.success?.(provider(selector, all)); return query } }
    }
    return query
  } })
  ;(globalThis as any).__wdRectStub = (element: any) => {
    if (element?.classList?.contains('wd-rate__item')) {
      const index = Array.prototype.indexOf.call(element.parentNode.children, element)
      return stars()[Math.max(0, index)]
    }
    return rect()
  }
}
function pickerStart(container: Element, toY = -50) {
  const column = node(container, '.wd-picker-view__column')
  const content = node(container, '.wd-picker-view__column-content')
  // fireEvent intentionally does not bubble: dispatch the native child/parent bindings separately.
  fireEvent.touchstart(content, { touches: [{ clientY: 0 }] })
  fireEvent.touchstart(column, { touches: [{ clientY: 0 }] })
  fireEvent.touchmove(content, { touches: [{ clientY: toY }] })
  return content
}
function pickerEnd(content: Element, toY = -50) {
  fireEvent.touchend(content, { touches: [], changedTouches: [{ clientY: toY }] })
}
function canvasHost() {
  const calls: Array<[string, any[]]> = []
  const ctx: any = {}
  for (const method of ['save', 'restore', 'clearRect', 'translate', 'rotate', 'drawImage', 'setFillStyle', 'fillRect', 'setLineJoin', 'setLineCap', 'setStrokeStyle', 'setLineWidth', 'beginPath', 'moveTo', 'lineTo', 'stroke']) {
    ctx[method] = (...args: any[]) => calls.push([method, args])
  }
  ctx.draw = (_reserve: boolean, done: () => void) => done()
  const exports: any[] = []
  configureUniAdapter({ createCanvasContext: () => ctx, canvasToTempFilePath: (options: any) => exports.push(options) })
  return { calls, exports }
}
function imageHost() {
  configureUniAdapter({ getImageInfo: (options: any) => options.success({ width: 200, height: 100 }) })
}
function confirmCrop(container: Element) {
  const buttons = container.querySelectorAll('.wd-img-cropper__footer .wd-button')
  expect(buttons.length).toBeGreaterThan(0)
  fireEvent.tap(buttons[buttons.length - 1])
}


describe('official picker-view release and settling lifecycle', () => {
  it.each([true, false])('immediateChange=%s never commits during move; payload/order survives controlled feedback', async (immediateChange) => {
    vi.useFakeTimers()
    const order: string[] = []
    const change = vi.fn()
    const mounted = mount(PickerView, {
      modelValue: ['a'], columns: [['a', 'b', 'c']], immediateChange,
      onPickstart: () => order.push('start'), onPickend: () => order.push('end'),
      'onUpdate:modelValue': (value: any) => { order.push('update'); mounted.props.value.modelValue = value },
      onChange: (payload: any) => { order.push('change'); change(payload) }
    })
    await flush()
    const content = pickerStart(mounted.container)
    await flush()
    expect(order).toEqual(['start'])
    expect(change).not.toHaveBeenCalled()
    expect(content.getAttribute('style')).toContain('translateY(-50px)')
    pickerEnd(content)
    await flush()
    expect(order).toEqual(immediateChange ? ['start', 'update', 'change'] : ['start'])
    await vi.advanceTimersByTimeAsync(199)
    expect(order).toEqual(immediateChange ? ['start', 'update', 'change'] : ['start'])
    await vi.advanceTimersByTimeAsync(1)
    await flush()
    expect(order).toEqual(['start', 'update', 'change', 'end'])
    expect(change).toHaveBeenCalledExactlyOnceWith({
      selectedValues: ['b'], selectedOptions: [{ value: 'b', label: 'b' }],
      selectedLabels: ['b'], selectedIndexes: [1], columnIndex: 0
    })
    expect(mounted.props.value.modelValue).toEqual(['b'])
  })

  it.each(['model', 'columns', 'unmount'])('drops an obsolete settling callback after %s replacement', async (replacement) => {
    vi.useFakeTimers()
    const update = vi.fn(), change = vi.fn(), end = vi.fn()
    const mounted = mount(PickerView, {
      modelValue: ['a'], columns: [['a', 'b', 'c']],
      'onUpdate:modelValue': update, onChange: change, onPickend: end
    })
    await flush()
    pickerEnd(pickerStart(mounted.container))
    if (replacement === 'unmount') mounted.unmount()
    else if (replacement === 'model') mounted.props.value.modelValue = ['c']
    else { mounted.props.value.columns = [['x', 'y']]; mounted.props.value.modelValue = ['x'] }
    await flush()
    await vi.advanceTimersByTimeAsync(250)
    expect(update).not.toHaveBeenCalled()
    expect(change).not.toHaveBeenCalled()
    expect(end).not.toHaveBeenCalled()
    if (replacement !== 'unmount') expect(mounted.instance().getSelectedValues()).toEqual(replacement === 'model' ? ['c'] : ['x'])
  })

  it('live valueKey/labelKey changes reformat the same consumer options without mutation', async () => {
    const columns = [[{ value: 'a', label: 'A', code: 1, text: 'one' }, { value: 'b', label: 'B', code: 2, text: 'two' }]]
    const original = JSON.stringify(columns)
    const mounted = mount(PickerView, { columns, modelValue: ['b'] })
    expect(mounted.instance().getSelectedLabels()).toEqual(['B'])
    mounted.props.value = { columns, modelValue: ['2'], valueKey: 'code', labelKey: 'text' }
    await flush()
    expect(mounted.instance().getSelectedIndex()).toEqual([1])
    expect(mounted.instance().getSelectedValues()).toEqual([2])
    expect(mounted.instance().getSelectedLabels()).toEqual(['two'])
    expect(JSON.stringify(columns)).toBe(original)
    expect(mounted.container.textContent).toContain('two')
  })

  it('an empty middle column retains its position, has no stale option, and clears on columns=[]', async () => {
    const mounted = mount(PickerView, { columns: [[1, 2], [], [3, 4]], modelValue: ['2', undefined, 4] })
    expect(mounted.instance().getSelectedIndex()).toEqual([1, -1, 1])
    expect(mounted.instance().getSelectedValues()).toEqual([2, undefined, 4])
    expect(mounted.instance().getSelectedLabels()).toEqual(['2', '', '4'])
    expect(mounted.instance().getSelectedOptions()[1]).toEqual({})
    mounted.props.value.columns = []
    await flush()
    expect(mounted.instance().getSelectedIndex()).toEqual([])
    expect(mounted.instance().getSelectedOptions()).toEqual([])
    expect(mounted.container.querySelectorAll('.wd-picker-view__column')).toHaveLength(0)
  })

  it('live childrenKey/cascade changes and parent release choose the first enabled new descendant', async () => {
    const columns = [
      { code: 'a', text: 'A', nodes: [{ code: 'a1', text: 'A1' }, { code: 'a2', text: 'A2' }] },
      { code: 'b', text: 'B', nodes: [{ code: 'b0', text: 'B0', disabled: true }, { code: 'b1', text: 'B1' }] }
    ]
    const snapshot = JSON.stringify(columns)
    const update = vi.fn()
    const mounted = mount(PickerView, { columns, modelValue: ['a'], valueKey: 'code', labelKey: 'text', immediateChange: true })
    mounted.props.value = { ...mounted.props.value, cascade: true, childrenKey: 'nodes', modelValue: ['a', 'a2'], 'onUpdate:modelValue': update }
    await flush()
    expect(mounted.instance().getSelectedValues()).toEqual(['a', 'a2'])
    pickerEnd(pickerStart(mounted.container, -44), -44)
    await flush()
    expect(update).toHaveBeenLastCalledWith(['b', 'b1'])
    expect(mounted.instance().getSelectedIndex()).toEqual([1, 1])
    expect(JSON.stringify(columns)).toBe(snapshot)
  })
})


describe('controlled controls, official continuous gestures and instance isolation', () => {
  it('child disabled=false inherits form=true; form-item=false overrides, child=true wins', async () => {
    const updates = [vi.fn(), vi.fn(), vi.fn()]
    const { container } = render({ setup: () => () => h(Form as any, { model: {}, disabled: true }, {
      default: () => [
        h(FormItem as any, { prop: 'a' }, { default: () => h(Input as any, { disabled: false, modelValue: 'a', 'onUpdate:modelValue': updates[0] }) }),
        h(FormItem as any, { prop: 'b', disabled: false }, { default: () => h(Input as any, { disabled: false, modelValue: 'b', 'onUpdate:modelValue': updates[1] }) }),
        h(FormItem as any, { prop: 'c', disabled: false }, { default: () => h(Input as any, { disabled: true, modelValue: 'c', 'onUpdate:modelValue': updates[2] }) })
      ]
    }) } as any)
    await flush()
    const controls = container.querySelectorAll('.wd-input')
    expect([...controls].map((item) => item.classList.contains('is-disabled'))).toEqual([true, false, true])
    for (const control of controls) fireEvent.input(node(control, 'input'), { detail: { value: 'new' } })
    expect(updates[0]).not.toHaveBeenCalled()
    expect(updates[1]).toHaveBeenCalledExactlyOnceWith('new')
    expect(updates[2]).not.toHaveBeenCalled()
  })

  it('search clear retains intended refocus on v-model feedback and official change/update/clear order', async () => {
    vi.useFakeTimers()
    const order: any[] = []
    const mounted = mount(Search, {
      modelValue: 'old', placeholderLeft: true, focusWhenClear: true,
      onChange: (payload: any) => order.push(['change', payload]),
      'onUpdate:modelValue': (value: string) => { order.push(['update', value]); mounted.props.value.modelValue = value },
      onClear: () => order.push(['clear'])
    })
    fireEvent.tap(node(mounted.container, '.wd-search__clear-icon'))
    await vi.advanceTimersByTimeAsync(100)
    await flush()
    expect(order).toEqual([['change', { value: '' }], ['update', ''], ['clear']])
    expect(mounted.instance().$.setupState.isFocused).toBe(true)
    expect(mounted.container.querySelector('input')).not.toBeNull()
  })

  it('search external replacement cancels delayed clear instead of erasing newer input', async () => {
    vi.useFakeTimers()
    const update = vi.fn()
    const mounted = mount(Search, { modelValue: 'old', placeholderLeft: true, 'onUpdate:modelValue': update })
    fireEvent.tap(node(mounted.container, '.wd-search__clear-icon'))
    mounted.props.value.modelValue = 'newer'
    await flush()
    await vi.advanceTimersByTimeAsync(100)
    expect(update).not.toHaveBeenCalled()
    expect(mounted.instance().$.setupState.inputValue).toBe('newer')
  })

  it('slider uses relative pointer deltas, updates during every move, then dragend before change without resampling end', async () => {
    geometry()
    const updates: any[] = [], order: any[] = []
    const mounted = mount(Slider, {
      modelValue: 20,
      'onUpdate:modelValue': (value: any) => { updates.push(value); mounted.props.value.modelValue = value },
      onDragstart: (value: any) => order.push(['start', value]), onDragmove: (value: any) => order.push(['move', value]),
      onDragend: (value: any) => order.push(['end', value]), onChange: (value: any) => order.push(['change', value])
    })
    await flush()
    const dot = node(mounted.container, '.wd-slider__dot'), bar = node(mounted.container, '.wd-slider__bar')
    fireEvent.touchstart(dot, { touches: [{ clientX: 45 }] }) // grab slightly off-center: value is still 20
    fireEvent.touchstart(bar, { touches: [{ clientX: 45 }] })
    await flush()
    for (const x of [85, 105]) {
      fireEvent.touchmove(dot, { touches: [{ clientX: x }] })
      fireEvent.touchmove(bar, { touches: [{ clientX: x }] })
      await flush()
    }
    expect(updates).toEqual([40, 50])
    expect(order.map((item) => item[0])).toEqual(['start', 'move', 'move'])
    fireEvent.touchend(dot, { touches: [], changedTouches: [{ clientX: 195 }] })
    await flush()
    expect(updates).toEqual([40, 50])
    expect(order.slice(-2)).toEqual([['end', { value: 50 }], ['change', 50]])
  })

  it('slider min/max/step/vertical can change before a new gesture in both threads', async () => {
    geometry()
    const update = vi.fn()
    const mounted = mount(Slider, { modelValue: 20, 'onUpdate:modelValue': update })
    await flush()
    mounted.props.value = { modelValue: 40, min: 0, max: 200, step: 20, vertical: true, 'onUpdate:modelValue': update }
    await flush()
    update.mockClear()
    const dot = node(mounted.container, '.wd-slider__dot'), bar = node(mounted.container, '.wd-slider__bar')
    fireEvent.touchstart(dot, { touches: [{ clientY: 20 }] })
    fireEvent.touchstart(bar, { touches: [{ clientY: 20 }] })
    await flush()
    fireEvent.touchmove(dot, { touches: [{ clientY: 60 }] })
    expect(node(mounted.container, '.wd-slider__line').getAttribute('style')).toContain('height: 60%')
    fireEvent.touchmove(bar, { touches: [{ clientY: 60 }] })
    await flush()
    expect(update).toHaveBeenLastCalledWith(120)
  })

  it('rate commits update then change on every native move, ignores gaps, and does not duplicate on end', async () => {
    geometry()
    const order: any[] = [], moves = vi.fn()
    const mounted = mount(Rate, {
      modelValue: 0, onTouchmove: moves,
      'onUpdate:modelValue': (value: number) => { order.push(['update', value]); mounted.props.value.modelValue = value },
      onChange: (payload: any) => order.push(['change', payload])
    })
    await flush()
    const root = node(mounted.container, '.wd-rate'), item = node(root, '.wd-rate__item')
    fireEvent.touchstart(item, { touches: [{ clientX: 5 }] })
    fireEvent.touchstart(root, { touches: [{ clientX: 5 }] })
    await flush()
    for (const clientX of [35, 65, 65, 28]) {
      fireEvent.touchmove(item, { touches: [{ clientX }] })
      fireEvent.touchmove(root, { touches: [{ clientX }] })
      await flush()
    }
    expect(order).toEqual([['update', 2], ['change', { value: 2 }], ['update', 3], ['change', { value: 3 }], ['update', 3], ['change', { value: 3 }]])
    expect(moves).toHaveBeenCalledTimes(4)
    fireEvent.touchend(root, { touches: [], changedTouches: [{ clientX: 145 }] })
    await flush()
    expect(order).toHaveLength(6)
  })

  it('rate live half/colors and disabled configuration alter worklet behavior without remounting', async () => {
    geometry()
    const mounted = mount(Rate, { modelValue: 0, activeColor: '#ff0000', color: '#cccccc' })
    await flush()
    const root = node(mounted.container, '.wd-rate'), item = node(root, '.wd-rate__item')
    fireEvent.touchstart(item, { touches: [{ clientX: 5 }] })
    await flush()
    fireEvent.touchmove(item, { touches: [{ clientX: 65 }] })
    expect(node(root, '.wd-rate__item-star').getAttribute('style')).toContain('rgb(255, 0, 0)')
    mounted.props.value = { ...mounted.props.value, activeColor: '#00ff00', allowHalf: true }
    await flush()
    fireEvent.touchmove(item, { touches: [{ clientX: 65 }] })
    expect(node(root, '.wd-rate__item-star').getAttribute('style')).toContain('rgb(0, 255, 0)')
    mounted.props.value.disabled = true
    await flush()
    const style = node(root, '.wd-rate__item-star').getAttribute('style')
    fireEvent.touchmove(item, { touches: [{ clientX: 145 }] })
    expect(node(root, '.wd-rate__item-star').getAttribute('style')).toBe(style)
  })

  it('rate consumes and forwards root tap/touchstart without merged array handlers', async () => {
    geometry()
    const registry = (globalThis as any).__VUE_LYNX_EVENT_REGISTRY__
    const before = new Set(registry?.handlers.keys() || [])
    const tap = vi.fn(), start = vi.fn(), move = vi.fn(), end = vi.fn(), cancel = vi.fn()
    const { container } = mount(Rate, { modelValue: 0, onTap: tap, onTouchstart: start, onTouchmove: move, onTouchend: end, onTouchcancel: cancel })
    await flush()
    const root = node(container, '.wd-rate')
    expect(() => fireEvent.tap(root)).not.toThrow()
    expect(() => fireEvent.touchstart(root, { touches: [{ clientX: 5 }] })).not.toThrow()
    expect(tap).toHaveBeenCalledOnce()
    expect(start).toHaveBeenCalledOnce()
    const handlers = (globalThis as any).__VUE_LYNX_EVENT_REGISTRY__?.handlers as Map<string, any>
    for (const [sign, handler] of handlers) if (!before.has(sign)) expect(typeof handler, sign).toBe('function')
  })

  it('multiple rate/segmented instances measure unique ID-scoped selectors rather than each other', async () => {
    const selectors: string[] = [], ids = new Map<string, number>()
    geometry((selector, all) => {
      selectors.push(selector)
      if (!all) return rect()
      const id = selector.split(' ')[0]
      if (!ids.has(id)) ids.set(id, ids.size)
      return selector.includes('segmented') ? [rect(0, 50 + ids.get(id)! * 50), rect(0, 50 + ids.get(id)! * 50)] : stars(ids.get(id)! * 500)
    })
    const first = vi.fn(), second = vi.fn()
    const { container } = render({ setup: () => () => h('view', {}, [
      h(Rate as any, { modelValue: 0, 'onUpdate:modelValue': first }),
      h(Rate as any, { modelValue: 0, 'onUpdate:modelValue': second }),
      h(Segmented as any, { value: 'b', options: ['a', 'b'] }),
      h(Segmented as any, { value: 'b', options: ['a', 'b'] })
    ]) } as any)
    await flush()
    // Segmented measures after its initial pause; avoid conflating this test with animation timing.
    await new Promise((resolve) => setTimeout(resolve, 50))
    const roots = container.querySelectorAll('.wd-rate')
    fireEvent.touchmove(roots[1], { touches: [{ clientX: 565 }] })
    await flush()
    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenLastCalledWith(3)
    const rateSelectors = [...new Set(selectors.filter((selector) => selector.includes('.wd-rate__item')))]
    const segmentedSelectors = [...new Set(selectors.filter((selector) => selector.includes('.wd-segmented__item')))]
    expect(rateSelectors).toHaveLength(2)
    expect(segmentedSelectors).toHaveLength(2)
    expect([...rateSelectors, ...segmentedSelectors].every((selector) => /^#wd-(rate|segmented)-.+ \./.test(selector))).toBe(true)
    const sliders = container.querySelectorAll('.wd-segmented__slider')
    expect(sliders[0].getAttribute('style')).not.toBe(sliders[1].getAttribute('style'))
  })

  it('keyboard loading becoming true during a press cancels it, but a subsequent valid press still works', async () => {
    const press = vi.fn()
    const mounted = mount(KeyboardKey, { text: '1', onPress: press })
    const wrapper = node(mounted.container, '.wd-key-wrapper')
    fireEvent.touchstart(wrapper, { touches: [{ clientX: 0, clientY: 0 }] })
    mounted.props.value.loading = true
    await flush()
    fireEvent.touchend(wrapper)
    expect(press).not.toHaveBeenCalled()
    mounted.props.value.loading = false
    await flush()
    fireEvent.touchstart(wrapper, { touches: [{ clientX: 0, clientY: 0 }] })
    fireEvent.touchend(wrapper)
    expect(press).toHaveBeenCalledExactlyOnceWith('1', '')
  })
})


describe('real host media export and stale callback cancellation', () => {
  it('cropper without raster host reports the missing capability, never fake-confirms, and stays open', async () => {
    imageHost()
    const confirm = vi.fn(), error = vi.fn(), update = vi.fn()
    const { container } = mount(ImgCropper, { modelValue: true, imgSrc: '/a.jpg', onConfirm: confirm, onImgloaderror: error, 'onUpdate:modelValue': update })
    await flush()
    confirmCrop(container)
    expect(confirm).not.toHaveBeenCalled()
    expect(update).not.toHaveBeenCalled()
    expect(error).toHaveBeenCalledWith(expect.objectContaining({ src: '/a.jpg', errMsg: expect.stringContaining('host adapters are required') }))
    expect(container.querySelector('.wd-img-cropper')).not.toBeNull()
  })

  it('cropper draws/exports the requested file type, quality and size, then confirm before controlled close', async () => {
    imageHost()
    const host = canvasHost(), order: any[] = []
    const mounted = mount(ImgCropper, {
      modelValue: true, imgSrc: '/a.jpg', fileType: 'jpg', quality: 0.4, exportScale: 3,
      onConfirm: (value: any) => order.push(['confirm', value]),
      'onUpdate:modelValue': (value: boolean) => { order.push(['update', value]); mounted.props.value.modelValue = value }
    })
    await flush()
    const image = node(mounted.container, '.wd-img-cropper__img')
    const cutW = Number(image.getAttribute('cut-w')), cutH = Number(image.getAttribute('cut-h'))
    confirmCrop(mounted.container)
    expect(order).toEqual([])
    expect(host.calls.some(([method]) => method === 'drawImage')).toBe(true)
    expect(host.exports).toHaveLength(1)
    expect(host.exports[0]).toMatchObject({ fileType: 'jpg', quality: 0.4, width: cutW * 3, height: Math.round(cutH * 3), destWidth: cutW * 3, destHeight: Math.round(cutH * 3) })
    host.exports[0].success({ tempFilePath: '/crop.jpg' })
    await flush()
    expect(order[0]).toEqual(['confirm', expect.objectContaining({ tempFilePath: '/crop.jpg', src: '/a.jpg', width: cutW * 3, height: cutH * 3 })])
    expect(order[1]).toEqual(['update', false])
    expect(mounted.container.querySelector('.wd-img-cropper')).toBeNull()
  })

  it('cropper export failure keeps the panel open and emits no success', async () => {
    imageHost()
    const host = canvasHost(), confirm = vi.fn(), error = vi.fn(), update = vi.fn()
    const { container } = mount(ImgCropper, { modelValue: true, imgSrc: '/a.jpg', onConfirm: confirm, onImgloaderror: error, 'onUpdate:modelValue': update })
    await flush()
    confirmCrop(container)
    host.exports[0].fail({ errMsg: 'disk full' })
    expect(error).toHaveBeenCalledWith({ src: '/a.jpg', errMsg: 'disk full' })
    expect(confirm).not.toHaveBeenCalled()
    expect(update).not.toHaveBeenCalled()
    expect(container.querySelector('.wd-img-cropper')).not.toBeNull()
  })

  it.each(['source', 'close', 'unmount'])('cropper drops late export callbacks after %s', async (replacement) => {
    imageHost()
    const host = canvasHost(), confirm = vi.fn(), error = vi.fn()
    const mounted = mount(ImgCropper, { modelValue: true, imgSrc: '/a.jpg', onConfirm: confirm, onImgloaderror: error })
    await flush()
    confirmCrop(mounted.container)
    if (replacement === 'source') mounted.props.value.imgSrc = '/b.jpg'
    else if (replacement === 'close') mounted.props.value.modelValue = false
    else mounted.unmount()
    await flush()
    host.exports[0].success({ tempFilePath: '/obsolete.png' })
    host.exports[0].fail({ errMsg: 'late failure' })
    expect(confirm).not.toHaveBeenCalled()
    expect(error).not.toHaveBeenCalled()
  })

  it('cropper only accepts current source image info; a late source callback cannot overwrite new dimensions', async () => {
    const requests: any[] = []
    configureUniAdapter({ getImageInfo: (options: any) => requests.push(options) })
    const mounted = mount(ImgCropper, { modelValue: true, imgSrc: '/a.jpg' })
    mounted.props.value.imgSrc = '/b.jpg'
    await flush()
    expect(requests).toHaveLength(2)
    requests[1].success({ width: 200, height: 100 })
    await flush()
    const width = node(mounted.container, '.wd-img-cropper__img').getAttribute('pic-w')
    requests[0].success({ width: 1, height: 2000 })
    await flush()
    expect(node(mounted.container, '.wd-img-cropper__img').getAttribute('pic-w')).toBe(width)
  })

  it('signature returns an honestly typed SVG data URI when no raster host exists', async () => {
    geometry()
    const confirm = vi.fn()
    const mounted = mount(Signature, { fileType: 'jpg', quality: 0.2, onConfirm: confirm })
    await flush()
    mounted.instance().confirm()
    const result = confirm.mock.calls[0][0]
    expect(result.success).toBe(true)
    expect(result.tempFilePath).toMatch(/^data:image\/svg\+xml;utf8,/)
    expect(decodeURIComponent(result.tempFilePath.split(',')[1])).toContain('<svg')
    expect(result.tempFilePath).not.toMatch(/^data:image\/(png|jpeg)/)
  })

  it('signature raster host receives fileType/quality/exportScale and surfaces real success and failure', async () => {
    geometry()
    const host = canvasHost(), confirm = vi.fn()
    const mounted = mount(Signature, { fileType: 'jpg', quality: 0.7, exportScale: 2, onConfirm: confirm })
    await flush()
    mounted.instance().confirm()
    expect(host.exports[0]).toMatchObject({ fileType: 'jpg', quality: 0.7, width: 200, height: 100, destWidth: 400, destHeight: 200 })
    expect(confirm).not.toHaveBeenCalled()
    host.exports[0].success({ tempFilePath: '/signature.jpg' })
    expect(confirm).toHaveBeenLastCalledWith({ tempFilePath: '/signature.jpg', success: true, width: 400, height: 200 })
    mounted.instance().confirm()
    host.exports[1].fail({ errMsg: 'write failed' })
    expect(confirm).toHaveBeenLastCalledWith({ tempFilePath: '', success: false, width: 400, height: 200 })
  })

  it.each(['clear', 'unmount'])('signature drops late raster export after %s', async (action) => {
    geometry()
    const host = canvasHost(), confirm = vi.fn()
    const mounted = mount(Signature, { onConfirm: confirm })
    await flush()
    mounted.instance().confirm()
    if (action === 'clear') mounted.instance().clear()
    else mounted.unmount()
    host.exports[0].success({ tempFilePath: '/obsolete.png' })
    host.exports[0].fail({ errMsg: 'obsolete error' })
    expect(confirm).not.toHaveBeenCalled()
  })

  it('signature disabled and clear cancel pending quick-stroke geometry without creating a ghost line', async () => {
    const queries: any[] = []
    configureUniAdapter({ createSelectorQuery: () => ({
      select: () => ({ invoke: (options: any) => { queries.push(options); return { exec() {} } } })
    }) })
    const mounted = mount(Signature, {})
    const canvas = node(mounted.container, '.wd-signature__content-canvas')
    fireEvent.touchstart(canvas, { touches: [{ clientX: 50, clientY: 50 }] })
    fireEvent.touchend(canvas, { changedTouches: [{ clientX: 50, clientY: 50 }], touches: [] })
    mounted.instance().clear()
    for (const query of queries) query.success?.(rect())
    await flush()
    const svg = String(node(mounted.container, 'svg').getAttribute('content'))
    expect(svg).not.toContain('<polyline')
    mounted.props.value.disabled = true
    await flush()
    fireEvent.touchstart(canvas, { touches: [{ clientX: 100, clientY: 100 }] })
    expect(mounted.instance().$.setupState.currentLine).toBeUndefined()
  })
})


describe('calendar bounds and validation race regression', () => {
  it.each([MonthPanel, YearPanel])('shrinking or empty date bounds do not index past panel titles', async (component) => {
    vi.useFakeTimers()
    const minDate = new Date(2024, 0, 1).getTime(), maxDate = new Date(2026, 11, 31).getTime()
    const mounted = mount(component, { type: component === YearPanel ? 'month' : 'date', panelHeight: 378, minDate, maxDate, value: new Date(2025, 0, 1).getTime(), showPanelTitle: true })
    await vi.advanceTimersByTimeAsync(100)
    const scroller = node(mounted.container, 'scroll-view')
    fireEvent.scroll(scroller, { detail: { scrollTop: 600 } })
    await flush()
    mounted.props.value.maxDate = minDate
    await flush()
    expect(mounted.container.textContent).toContain('2024')
    mounted.props.value.maxDate = minDate - 1
    await flush()
    expect(mounted.container.querySelector('scroll-view')).not.toBeNull()
    mounted.unmount()
    await vi.advanceTimersByTimeAsync(100)
  })

  it('a newer narrow validation prevents an older broad validation from overwriting that field', async () => {
    const old = deferred<any[]>(), recent = deferred<any[]>()
    const schema = { validate: vi.fn().mockReturnValueOnce(old.promise).mockReturnValueOnce(recent.promise) }
    let form: any
    const { container } = render({ setup: () => () => h(Form as any, { ref: (value: any) => { form = value }, model: { a: '', b: '' }, schema, resetOnChange: false }, {
      default: () => [h(FormItem as any, { prop: 'a' }), h(FormItem as any, { prop: 'b' })]
    }) } as any)
    await flush()
    const broad = form.validate()
    const narrow = form.validate('a')
    recent.resolve([])
    expect(await narrow).toEqual({ valid: true, errors: [] })
    old.resolve([{ path: ['a'], message: 'obsolete a' }, { path: ['b'], message: 'still b' }])
    expect((await broad).valid).toBe(false) // caller still receives its actual old validation result
    await flush()
    expect(container.textContent).not.toContain('obsolete a')
    expect(container.textContent).toContain('still b')
  })
})
