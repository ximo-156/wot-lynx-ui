/** Native-style single-event bubbling, smooth MTS ink and persistent native handoff. */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { h } from 'vue-lynx'
import { render, cleanup } from '../render'
import { pause } from '@wot-lynx/core/common/util'
import { fireEvent } from '../fire-event'
import Signature from '@wot-lynx/ui-form/wd-signature'
import { configureHost } from '@wot-lynx/core/common/host'
import { getStrokeSegments, segmentStyle } from '../../../ui-form/src/wd-signature/stroke'
import type { Line } from '@wot-lynx/ui-form/wd-signature/types'

const RECT = { id: '', left: 10, top: 20, right: 310, bottom: 220, width: 300, height: 200 }
const restores: Array<() => void> = []
function installRects(query?: (options: any) => void) {
  ;(globalThis as any).__wdRectStub = () => RECT
  const env = (globalThis as any).lynxTestingEnv
  // The shim switches a shared realm while promise callbacks run. Both SDK
  // objects need the same query; production uses a module-local lexical SDK.
  for (const sdk of new Set([env.backgroundThread.globalThis.lynx, env.mainThread.globalThis.lynx].filter(Boolean))) {
    const runtime = sdk as any
    const original = runtime.createSelectorQuery
    runtime.createSelectorQuery = () => ({ select: () => ({ invoke: (options: any) => {
      if (query) query(options)
      else options.success?.(RECT)
      return { exec() {} }
    } }) })
    restores.push(() => { if (original) runtime.createSelectorQuery = original; else delete runtime.createSelectorQuery })
  }
  restores.push(() => { delete (globalThis as any).__wdRectStub })
}
async function frames(count = 3) {
  const env = (globalThis as any).lynxTestingEnv
  for (let index = 0; index < count; index++) {
    env.switchToBackgroundThread(); await pause(0)
    env.switchToMainThread(); await pause(0)
    env.switchToBackgroundThread(); await pause()
  }
}
async function until(check: () => boolean, attempts = 12) {
  for (let index = 0; index < attempts && !check(); index++) await frames(1)
  expect(check()).toBe(true)
}
function mount(props: Record<string, any> = {}) {
  let instance: any
  const confirms: any[] = []
  const mounted = render({ setup: () => () => h(Signature, { ...props,
    onConfirm: (value: any) => { confirms.push(value); props.onConfirm?.(value) },
    ref: (value: any) => { instance = value }
  }) } as any)
  return { ...mounted, instance: () => instance, confirms }
}
function canvas(container: Element) { return container.querySelector('.wd-signature__content-canvas')! }
function pool(container: Element) { return [...container.querySelectorAll<HTMLElement>('.wd-signature__live-segment')] }
function tip(container: Element) { return [...container.querySelectorAll<HTMLElement>('.wd-signature__tip-segment')] }
function strokes(container: Element) { return [...container.querySelectorAll('.wd-signature__stroke:not(.wd-signature__fallback)')] }
function nativeSegments(container: Element) { return [...container.querySelectorAll<HTMLElement>('.wd-signature__stroke:not(.wd-signature__fallback) .wd-signature__segment')] }
function dispatch(container: Element, phase: 'start' | 'move' | 'end' | 'cancel', point?: [number, number], timestamp = 0) {
  const terminal = phase === 'end' || phase === 'cancel'
  const touch = point ? { clientX: point[0], clientY: point[1], identifier: 1 } : undefined
  fireEvent[`touch${phase}`](canvas(container), { timestamp, bubbles: true, cancelable: true,
    touches: terminal ? [] : touch ? [touch] : [], changedTouches: terminal && touch ? [touch] : [] })
}
async function drawStroke(container: Element, points: Array<[number, number]>, times?: number[]) {
  dispatch(container, 'start', points[0], times?.[0] ?? 100)
  await frames(1)
  for (let index = 1; index < points.length; index++) {
    dispatch(container, 'move', points[index], times?.[index] ?? 100 + index * 16)
    await frames(1)
  }
  dispatch(container, 'end', points.at(-1), times?.at(-1) ?? 100 + points.length * 16)
  await frames()
}
function exportSvg(mounted: ReturnType<typeof mount>): string {
  mounted.instance().confirm()
  const result = mounted.confirms.at(-1)
  expect(result.success).toBe(true)
  expect(result.tempFilePath).toMatch(/^data:image\/svg\+xml;utf8,/)
  return decodeURIComponent(result.tempFilePath.split(',')[1])
}
function acknowledge(stroke: Element) {
  fireEvent.layoutchange(stroke, { detail: { width: RECT.width, height: RECT.height } })
}

afterEach(() => { cleanup(); restores.splice(0).reverse().forEach(restore => restore()) })

describe('wd-signature continuous MTS drawing', () => {
  it('draws a true round-capped curve and a live tip without a background render erasing it', async () => {
    installRects()
    const mounted = mount()
    await frames()
    dispatch(mounted.container, 'start', [60, 120], 10)
    await frames()
    dispatch(mounted.container, 'move', [160, 220], 20)
    const elements = pool(mounted.container)
    await until(() => Number.parseFloat(elements[0].style.width) > 70)
    // First stable half: (50,100) -> (100,150), length sqrt(50²+50²) + 3.
    expect(Number.parseFloat(elements[0].style.width)).toBeCloseTo(Math.hypot(50, 50) + 3)
    expect(Number.parseFloat(elements[0].style.left)).toBeCloseTo((150 - Math.hypot(50, 50) - 3) / 2)
    expect(Number.parseFloat(elements[0].style.top)).toBeCloseTo(123.5)
    expect(elements[0].style.transform).toBe('rotate(45deg)')
    expect(elements[0].style.borderRadius).toBe('1.5px')
    expect(Number.parseFloat(tip(mounted.container)[0].style.width)).toBeCloseTo(Math.hypot(50, 50) + 3)
    const original = elements[0].getAttribute('style')
    dispatch(mounted.container, 'move', [260, 220], 30)
    await frames()
    expect(elements[0].getAttribute('style')).toBe(original)
    // The curved corner is subdivided, not one long straight chord.
    expect(elements.filter(element => Number.parseFloat(element.style.width) > 0).length).toBeGreaterThan(2)
    expect(tip(mounted.container)[0].style.transform).toBe('rotate(0deg)')
  })

  it('one bubbling stroke emits once, remains native ink on release, and exports the same quadratic path', async () => {
    installRects()
    const events: string[] = []
    const mounted = mount({ onStart: () => events.push('start'), onSigning: () => events.push('signing'), onEnd: () => events.push('end') })
    await frames()
    await drawStroke(mounted.container, [[60, 120], [160, 220], [260, 220]])
    expect(events).toEqual(['start', 'signing', 'signing', 'end'])
    expect(strokes(mounted.container)).toHaveLength(1)
    expect(mounted.container.querySelector('svg')).toBeNull() // No asynchronous image handoff.
    const line: Line = { color: '#000', width: 3, points: [{ x: 50, y: 100, t: 0 }, { x: 150, y: 200, t: 1 }, { x: 250, y: 200, t: 2 }] }
    const expected = getStrokeSegments(line).map(segment => segmentStyle(segment, line.color))
    const persisted = nativeSegments(mounted.container)
    expect(persisted).toHaveLength(expected.length)
    expected.forEach((style, index) => {
      expect(Number.parseFloat(persisted[index].style.width)).toBeCloseTo(Number.parseFloat(style.width))
      expect(Number.parseFloat(persisted[index].style.left)).toBeCloseTo(Number.parseFloat(style.left))
    })
    expect(exportSvg(mounted)).toContain('M 50 100 Q 50 100 100 150 Q 150 200 200 200 Q 250 200 250 200')
    // Hide the live pool only when its own retained native stroke has landed.
    acknowledge(strokes(mounted.container)[0]); await frames()
    expect(pool(mounted.container)[0].style.width).toBe('0px')
    expect(persisted[0].style.width).not.toBe('0px')
  })

  it('an old stroke handoff cannot erase the next active stroke; terminal stray moves are ignored', async () => {
    installRects()
    const mounted = mount()
    await frames()
    await drawStroke(mounted.container, [[60, 120], [160, 120]])
    const previous = strokes(mounted.container)[0]
    dispatch(mounted.container, 'start', [60, 150], 200); await frames()
    dispatch(mounted.container, 'move', [160, 150], 216); await frames()
    const activeSegment = pool(mounted.container).find(element => Number.parseFloat(element.style.top) > 120 && Number.parseFloat(element.style.width) > 0)!
    const width = activeSegment.style.width
    expect(Number.parseFloat(width)).toBeGreaterThan(0)
    acknowledge(previous); await frames()
    expect(activeSegment.style.width).toBe(width)
    dispatch(mounted.container, 'end', [160, 150], 232); await frames()
    acknowledge(strokes(mounted.container)[1]); await frames()
    const shape = nativeSegments(mounted.container).map(element => element.getAttribute('style'))
    dispatch(mounted.container, 'move', [250, 190], 250); await frames()
    expect(pool(mounted.container)[0].style.width).toBe('0px')
    expect(nativeSegments(mounted.container).map(element => element.getAttribute('style'))).toEqual(shape)
  })

  it('retains all different positions from the same timestamp instead of dropping coalesced input', async () => {
    installRects()
    const mounted = mount()
    await frames()
    await drawStroke(mounted.container, [[60, 120], [160, 120], [260, 120]], [100, 100, 100])
    const svg = exportSvg(mounted)
    expect(svg).toContain('M 50 100 Q 50 100 100 100 Q 150 100 200 100 Q 250 100 250 100')
  })

  it('captures a final changedTouch even when there is no move event, and renders a tap as a dot', async () => {
    installRects()
    const mounted = mount()
    await frames()
    dispatch(mounted.container, 'start', [60, 120], 100)
    dispatch(mounted.container, 'end', [160, 120], 101)
    await frames()
    expect(exportSvg(mounted)).toContain('Q 150 100 150 100')
    mounted.instance().clear(); await frames()
    dispatch(mounted.container, 'start', [60, 120], 200)
    dispatch(mounted.container, 'end', [60, 120], 201)
    await frames()
    expect(nativeSegments(mounted.container)).toHaveLength(1)
    expect(nativeSegments(mounted.container)[0].style.width).toBe('3px')
    expect(nativeSegments(mounted.container)[0].style.height).toBe('3px')
    expect(exportSvg(mounted)).toContain('<circle cx="50" cy="100" r="1.5"')
    acknowledge(strokes(mounted.container)[0]); await frames()
    expect(tip(mounted.container)[0].style.width).toBe('0px') // Owner serial still matches after clear.
  })

  it('uses the same event time and pressure widths for MTS, retained strokes and export', async () => {
    installRects()
    const mounted = mount({ pressure: true, minWidth: 2, maxWidth: 6, penColor: '#123456' })
    await frames()
    dispatch(mounted.container, 'start', [60, 120], 0); await frames()
    dispatch(mounted.container, 'move', [260, 120], 1); await frames()
    const live = pool(mounted.container).filter(element => Number.parseFloat(element.style.width) > 0).map(element => Number.parseFloat(element.style.height))
    dispatch(mounted.container, 'move', [270, 120], 1000); await frames()
    dispatch(mounted.container, 'end', [270, 120], 1001); await frames()
    const persisted = nativeSegments(mounted.container)
    live.forEach((width, index) => expect(Number.parseFloat(persisted[index].style.height)).toBeCloseTo(width))
    const widths = [...exportSvg(mounted).matchAll(/stroke-width="([\d.]+)"/g)].map(match => Number(match[1]))
    expect(widths).toHaveLength(persisted.length)
    widths.forEach((width, index) => {
      expect(width).toBeGreaterThanOrEqual(2); expect(width).toBeLessThanOrEqual(6)
      expect(width).toBeCloseTo(Number.parseFloat(persisted[index].style.height))
    })
    expect(new Set(widths).size).toBeGreaterThan(1)
  })

  it('keeps a quickly ended stroke when its geometry arrives late, without starting a ghost stroke', async () => {
    const queries: any[] = []
    installRects(options => queries.push(options))
    const mounted = mount()
    await frames()
    dispatch(mounted.container, 'start', [60, 120], 0)
    dispatch(mounted.container, 'move', [160, 120], 1)
    dispatch(mounted.container, 'end', [160, 120], 2)
    await frames(1)
    queries.forEach(options => options.success?.(RECT))
    await frames()
    expect(strokes(mounted.container)).toHaveLength(1)
    expect(exportSvg(mounted)).toContain('M 50 100 Q 50 100 100 100 Q 150 100 150 100')
    expect(mounted.instance().$.setupState.currentLine).toBeUndefined()
    expect(mounted.instance().$.setupState.drawing).toBe(false)
  })

  it('clear cancels late geometry, and zero measurements do not replace a known offset', async () => {
    const queries: any[] = []
    let defer = false
    installRects(options => { if (defer) queries.push(options); else options.success?.(RECT) })
    const mounted = mount()
    await frames()
    defer = true
    dispatch(mounted.container, 'start', [60, 120], 100)
    dispatch(mounted.container, 'end', [160, 120], 101)
    await frames(1)
    mounted.instance().clear()
    queries.forEach(options => options.success?.(RECT)); await frames()
    expect(strokes(mounted.container)).toHaveLength(0)
    expect(exportSvg(mounted)).not.toMatch(/<(?:path|circle)\b/)
    queries.length = 0
    dispatch(mounted.container, 'start', [60, 120], 200)
    dispatch(mounted.container, 'end', [160, 120], 201)
    await frames(1)
    queries.forEach(options => options.success?.({ left: 0, top: 0, width: 0, height: 0 })); await frames()
    expect(exportSvg(mounted)).toContain('M 50 100')
    expect(canvas(mounted.container).getAttribute('gesture-measured')).toBe('true')
  })

  it('continues visible drawing after the bounded pool fills, and exports the full long stroke', async () => {
    installRects()
    const mounted = mount()
    await frames()
    dispatch(mounted.container, 'start', [60, 120], 0); await frames()
    for (let index = 1; index <= 150; index++) dispatch(mounted.container, 'move', [index % 2 ? 80 : 60, 120], index)
    await frames()
    expect(canvas(mounted.container).getAttribute('gesture-fallback'), JSON.stringify({
      count: mounted.instance().$.setupState.currentLine?.sampleCount,
      points: mounted.instance().$.setupState.currentLine?.points.length,
      drawing: mounted.instance().$.setupState.drawing
    })).toBe('true')
    expect(mounted.container.querySelectorAll('.wd-signature__fallback .wd-signature__segment').length).toBeGreaterThan(512)
    dispatch(mounted.container, 'end', [60, 120], 151); await frames()
    expect(nativeSegments(mounted.container).length).toBeGreaterThan(512)
    const svg = exportSvg(mounted)
    expect([...svg.matchAll(/\bQ /g)]).toHaveLength(151)
    expect(svg).toContain('Q 50 100 50 100')
  }, 15_000)

  it('keeps multiple strokes through undo/redo and clears ink, including an active stroke without history', async () => {
    installRects()
    const mounted = mount({ enableHistory: true })
    await frames()
    await drawStroke(mounted.container, [[60, 120], [160, 120]])
    await drawStroke(mounted.container, [[60, 150], [160, 150]])
    expect(strokes(mounted.container)).toHaveLength(2)
    mounted.instance().revoke(); await frames(); expect(strokes(mounted.container)).toHaveLength(1)
    mounted.instance().restore(); await frames(); expect(strokes(mounted.container)).toHaveLength(2)
    mounted.instance().clear(); await frames(); expect(strokes(mounted.container)).toHaveLength(0)
    dispatch(mounted.container, 'start', [60, 120], 500); await frames()
    dispatch(mounted.container, 'move', [160, 120], 516); await frames()
    expect(Number.parseFloat(pool(mounted.container)[0].style.width)).toBeGreaterThan(0)
    mounted.instance().revoke(); await frames()
    expect(pool(mounted.container).every(element => element.style.width === '0px')).toBe(true)
    expect(tip(mounted.container).every(element => element.style.width === '0px')).toBe(true)
    expect(exportSvg(mounted)).not.toMatch(/<(?:path|circle)\b/)
  })

  it('keeps A visible when B starts before A geometry or native handoff completes', async () => {
    const queries: any[] = []
    let delayed = false
    installRects(options => { if (delayed) queries.push(options); else options.success?.(RECT) })
    const mounted = mount()
    await frames()
    delayed = true
    await drawStroke(mounted.container, [[60, 120], [160, 120]])
    expect(strokes(mounted.container)).toHaveLength(0)
    const oldSegment = pool(mounted.container).find(element => Number.parseFloat(element.style.width) > 0)!
    const oldStyle = oldSegment.getAttribute('style')
    dispatch(mounted.container, 'start', [60, 150], 300); await frames()
    dispatch(mounted.container, 'move', [160, 150], 316); await frames()
    expect(oldSegment.getAttribute('style')).toBe(oldStyle)
    const active = pool(mounted.container).find(element => Number.parseFloat(element.style.top) > 120 && Number.parseFloat(element.style.width) > 0)!
    expect(active).toBeDefined()
    const activeStyle = active.getAttribute('style')
    queries.forEach(options => options.success?.(RECT)); await frames()
    acknowledge(strokes(mounted.container)[0]); await frames()
    expect(oldSegment.style.width).toBe('0px')
    expect(active.getAttribute('style')).toBe(activeStyle)
    // A repeated acknowledgement cannot erase slots subsequently reused by B.
    dispatch(mounted.container, 'move', [180, 150], 332); await frames()
    const before = pool(mounted.container).map(element => element.getAttribute('style'))
    acknowledge(strokes(mounted.container)[0]); await frames()
    expect(pool(mounted.container).map(element => element.getAttribute('style'))).toEqual(before)
    dispatch(mounted.container, 'end', [180, 150], 348); await frames()
    expect(strokes(mounted.container)).toHaveLength(2)
  })

  it('waits for valid fallback geometry and native materialization before releasing live ink', async () => {
    const queries: any[] = []
    let delayed = false
    installRects(options => {
      if (delayed) queries.push(options)
      else options.success?.({ left: 0, top: 0, width: 0, height: 0 })
    })
    const mounted = mount()
    await frames()
    delayed = true
    dispatch(mounted.container, 'start', [60, 120], 0); await frames(1)
    await until(() => queries.length > 0)
    // Fill the same bounded pool with a few highly curved moves. Holding an
    // initial query through 150 dispatches can cross getRect's real timeout
    // under a concurrent full suite, which tests timeout rather than late ACK.
    for (let index = 1; index <= 10; index++) dispatch(mounted.container, 'move', [index % 2 ? 5000 : 60, 120], index)
    await frames(1)
    expect(canvas(mounted.container).getAttribute('gesture-fallback')).toBe('false')
    expect(mounted.container.querySelector('.wd-signature__fallback')).toBeNull()
    expect(pool(mounted.container).some(element => Number.parseFloat(element.style.width) > 0)).toBe(true)
    queries.forEach(options => options.success?.(RECT))
    await until(() => !!mounted.container.querySelector('.wd-signature__fallback'))
    const fallback = mounted.container.querySelector('.wd-signature__fallback')!
    expect(pool(mounted.container).some(element => Number.parseFloat(element.style.width) > 0)).toBe(true)
    acknowledge(fallback); await frames()
    expect(pool(mounted.container).every(element => element.style.width === '0px')).toBe(true)
    expect(tip(mounted.container).every(element => element.style.width === '0px')).toBe(true)
    expect(fallback.querySelectorAll('.wd-signature__segment').length).toBeGreaterThan(512)
    // Geometry and pool availability can improve, but fallback stays latched.
    dispatch(mounted.container, 'move', [100, 120], 151); await frames()
    expect(canvas(mounted.container).getAttribute('gesture-fallback')).toBe('true')
    expect(mounted.container.querySelector('.wd-signature__fallback')).not.toBeNull()
  }, 15_000)

  it('waits for pending stroke geometry before a quick confirm and drops a cleared pending export', async () => {
    const queries: any[] = []
    installRects(options => queries.push(options))
    const mounted = mount()
    await frames()
    dispatch(mounted.container, 'start', [60, 120], 0)
    dispatch(mounted.container, 'end', [160, 120], 1)
    mounted.instance().confirm()
    expect(mounted.confirms).toHaveLength(0)
    await frames(1)
    queries.forEach(options => options.success?.(RECT)); await frames()
    expect(mounted.confirms).toHaveLength(1)
    expect(decodeURIComponent(mounted.confirms[0].tempFilePath)).toContain('M 50 100')
    queries.length = 0
    dispatch(mounted.container, 'start', [60, 150], 100)
    dispatch(mounted.container, 'end', [160, 150], 101)
    mounted.instance().confirm(); await frames(1)
    mounted.instance().clear()
    queries.forEach(options => options.success?.(RECT)); await frames()
    expect(mounted.confirms).toHaveLength(1)
  })

  it.each(['throw', 'reject'])('uses cached geometry when the main-thread invoke fails by %s', async mode => {
    installRects()
    const mounted = mount()
    await frames()
    ;(globalThis as any).__wdRectStub = () => {
      if (mode === 'throw') throw new Error('no UI method')
      return Promise.reject(new Error('UI method rejected'))
    }
    dispatch(mounted.container, 'start', [60, 120], 100); await frames()
    dispatch(mounted.container, 'move', [160, 120], 116); await frames()
    expect(Number.parseFloat(pool(mounted.container)[0].style.width)).toBeGreaterThan(0)
    dispatch(mounted.container, 'end', [160, 120], 132); await frames()
    expect(exportSvg(mounted)).toContain('M 50 100')
  })

  it('exports the same quadratic geometry through a standard Canvas 2D context without clearing visible ink', async () => {
    installRects()
    const ctx = { clearRect: vi.fn(), fillRect: vi.fn(), beginPath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(),
      quadraticCurveTo: vi.fn(), stroke: vi.fn(), lineCap: '', lineJoin: '', strokeStyle: '', lineWidth: 0 }
    const exportImage = vi.fn((options: any) => options.success({ tempFilePath: '/signature.png' }))
    configureHost({ createCanvasContext: () => ctx, canvasToTempFilePath: exportImage })
    restores.push(() => configureHost(null))
    const mounted = mount({ exportScale: 2, penColor: '#123456' })
    await frames()
    await drawStroke(mounted.container, [[60, 120], [160, 220], [260, 220]])
    const visible = nativeSegments(mounted.container).map(element => element.getAttribute('style'))
    mounted.instance().confirm()
    expect(ctx.moveTo).toHaveBeenCalledWith(50, 100)
    expect(ctx.quadraticCurveTo.mock.calls).toEqual([[50, 100, 100, 150], [150, 200, 200, 200], [250, 200, 250, 200]])
    expect(ctx.lineTo).not.toHaveBeenCalled()
    expect(ctx.lineCap).toBe('round'); expect(ctx.lineJoin).toBe('round')
    expect(ctx.strokeStyle).toBe('#123456'); expect(ctx.lineWidth).toBe(3)
    expect(exportImage.mock.calls[0][0]).toMatchObject({ width: 300, height: 200, destWidth: 600, destHeight: 400, fileType: 'png' })
    expect(mounted.confirms).toEqual([{ success: true, tempFilePath: '/signature.png', width: 600, height: 400 }])
    expect(nativeSegments(mounted.container).map(element => element.getAttribute('style'))).toEqual(visible)
  })

  it('disabled gestures do not draw, and scroll arbitration remains local to the enabled canvas', async () => {
    installRects()
    const events = { start: vi.fn(), signing: vi.fn(), end: vi.fn() }
    const mounted = mount({ disabled: true, onStart: events.start, onSigning: events.signing, onEnd: events.end })
    await frames()
    await drawStroke(mounted.container, [[60, 120], [160, 120]])
    expect(strokes(mounted.container)).toHaveLength(0)
    expect(events.start).not.toHaveBeenCalled(); expect(events.signing).not.toHaveBeenCalled(); expect(events.end).not.toHaveBeenCalled()
    expect(canvas(mounted.container).getAttribute('flatten')).toBe('false')
    expect(mounted.instance().$.setupState.canvasStyle['touch-action']).toBe('auto')
    mounted.unmount()
    const enabled = mount()
    await frames()
    expect(enabled.instance().$.setupState.canvasStyle['touch-action']).toBe('none')
    expect(canvas(enabled.container).getAttribute('consume-slide-event')).toContain('-180')
    for (const element of [...pool(enabled.container), ...tip(enabled.container)]) {
      expect(element.getAttribute('user-interaction-enabled')).toBe('false')
      expect(element.style.pointerEvents).toBe('none')
    }
  })
})
