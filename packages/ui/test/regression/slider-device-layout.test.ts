/**
 * Slider 设备布局契约：双线程真实节点 + SCSS 内存编译后的直接声明。
 * 不读取尚未重建的 index.css，不继承 view 的字体，也不使用 JSDOM 几何冒充真机。
 * 200px 轨道桩只服务手势数值；文字像素、越界绘制及原生命中/滚动仲裁仍需实机验收。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { h, nextTick, ref } from 'vue-lynx'
import postcss from 'postcss'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { cleanup, render } from '../render'
import { fireEvent } from '../fire-event'
import Slider from '@wot-lynx/ui-form/wd-slider'
import type { SliderTheme, SliderValue } from '@wot-lynx/ui-form/wd-slider/types'
import { compileScss } from '../helpers/scss'
import { compPath } from '../helpers/component-roots'

const filename = compPath('wd-slider', 'index.scss')
const rules: Array<{ selector: string; specificity: number; declarations: Record<string, string> }> = []
postcss.parse(compileScss(filename)).walkRules((rule) => {
  if (rule.parent?.type !== 'root') return
  const declarations: Record<string, string> = {}
  rule.walkDecls((decl) => { declarations[decl.prop] = decl.value })
  for (const selector of rule.selectors) {
    // Slider 的选择器仅使用类/后代组合；尊重 specificity，不能让后面的低权重规则顶掉锚点。
    rules.push({ selector, specificity: (selector.match(/\.[\w-]+/g) || []).length, declarations })
  }
})

/** 只取匹配这个元素的规则，刻意不做父 view 的字体继承。 */
function ownStyle(element: Element): Record<string, string> {
  const result: Record<string, { specificity: number; value: string }> = {}
  for (const rule of rules) {
    if (!element.matches(rule.selector)) continue
    for (const [property, value] of Object.entries(rule.declarations)) {
      if (!result[property] || rule.specificity >= result[property].specificity) {
        result[property] = { specificity: rule.specificity, value }
      }
    }
  }
  return Object.fromEntries(Object.entries(result).map(([property, entry]) => [property, entry.value]))
}

/** 仅展开本断言涉及的 token 回退；保留 calc/百分比，不模拟排版引擎。 */
function resolveTokens(value: string, overrides: Record<string, string> = {}): string {
  for (let depth = 0; depth < 30; depth++) {
    const next = value.replace(/var\((--[\w-]+)(?:,\s*([^()]*))?\)/g, (match, name, fallback) =>
      overrides[name] ?? fallback?.trim() ?? match
    )
    if (next === value) return value
    value = next
  }
  throw new Error('cyclic slider token fallback')
}

const geometry = { id: '', left: 0, top: 0, right: 200, bottom: 200, width: 200, height: 200 }
let restoreRects: (() => void) | undefined
beforeEach(() => {
  vi.useFakeTimers()
  const lynx = (globalThis as any).lynxTestingEnv.backgroundThread.globalThis.lynx
  const original = lynx.createSelectorQuery
  lynx.createSelectorQuery = () => ({
    select: () => ({
      invoke: (options: any) => {
        options.success?.(geometry)
        return { exec() {} }
      }
    })
  })
  restoreRects = () => { lynx.createSelectorQuery = original }
})
afterEach(() => {
  cleanup()
  restoreRects?.()
  restoreRects = undefined
  vi.useRealTimers()
})

async function flush() {
  await vi.advanceTimersByTimeAsync(20)
  await nextTick()
}

function expectText(element: Element | null, content?: string) {
  expect(element, '实际 text 需要专属 class，不能仅存在匿名文案').toBeTruthy()
  const text = element!
  expect(text.tagName.toLowerCase()).toBe('text')
  if (content !== undefined) expect(text.textContent).toBe(content)
  expect(text.getAttribute('text-maxline')).toBe('1')
  const style = ownStyle(text)
  for (const property of ['font-size', 'line-height', 'color']) {
    expect(style[property], `${property} 必须直接声明在 text`).toBeTruthy()
    expect(style[property]).not.toMatch(/^(inherit|currentColor)$/i)
  }
  expect(style['white-space']).toBe('nowrap')
  return style
}

const layouts = [false, true].flatMap((vertical) =>
  (['default', 'capsule'] as SliderTheme[]).flatMap((theme) =>
    [false, true].map((range) => ({ vertical, theme, range, name: `${vertical ? 'vertical' : 'horizontal'}/${theme}/${range ? 'range' : 'single'}` }))
  )
)

describe('Slider 设备排版与端点锚点', () => {
  it.each(layouts)('$name：文字出口、刻度与端点定位不依赖祖先继承或 auto 起边', async ({ vertical, theme, range }) => {
    const { container } = render(Slider, {
      modelValue: range ? [20, 80] : 50,
      vertical, theme, range, showExtremeValue: true, popoverVisible: 'always',
      marks: { 0: '0', 50: '50', 100: '100' }
    })
    await flush()
    const labels = Array.from(container.querySelectorAll('.wd-slider__scale-desc-text'))
    expect(labels.map((text) => text.textContent)).toEqual(['0', '50', '100'])
    labels.forEach((text) => expectText(text))
    expectText(container.querySelector('.wd-slider__value--min .wd-slider__value-text'), '0')
    expectText(container.querySelector('.wd-slider__value--max .wd-slider__value-text'), '100')

    for (const wrapper of container.querySelectorAll('.wd-slider__scale-desc, .wd-slider__value, .wd-slider__dot-popover')) {
      const style = ownStyle(wrapper)
      for (const property of ['font-size', 'line-height', 'color', 'white-space']) {
        expect(style[property], `定位 view 不应承担 ${property}`).toBeUndefined()
      }
    }
    for (const label of labels) {
      // 保留小 tick 中的文案结构；没有为数字 100 硬编码宽度/高度。
      expect(label.parentElement!.parentElement!.classList.contains('wd-slider__scale-item')).toBe(true)
      const style = ownStyle(label.parentElement!)
      expect(style.position).toBe('absolute')
      expect(style.top).not.toBe('auto')
      expect(style.left).not.toBe('auto')
      expect(style.width).toBeUndefined()
      if (vertical) {
        expect(style.left).toContain('calc(100% - ')
        expect(style.left).toContain(theme === 'capsule' ? '--wot-slider-marks-desc-capsule-spacing' : '--wot-slider-marks-desc-spacing')
        expect(style.right).toBe('auto')
        expect(style.transform).toBe('translate(-100%, -50%)')
      }
    }

    const dots = Array.from(container.querySelectorAll('.wd-slider__dot'))
    expect(dots).toHaveLength(range ? 2 : 1)
    for (const [index, dot] of dots.entries()) {
      const style = ownStyle(dot)
      expect(style.position).toBe('absolute')
      expect(resolveTokens(style.width)).toBe('24px')
      expect(resolveTokens(style.height)).toBe('24px')
      const end = !range || index === 1
      expect(style.left).toBe(vertical ? '50%' : end ? '100%' : '0')
      expect(style.top).toBe(vertical && end ? '100%' : '0')
      expect(style.transform).toBe(vertical ? 'translate(-50%, -50%)' : 'translateX(-50%)')
      if (vertical) expect(style.bottom).toBe('auto')
      else expect(style.right).toBe('auto')
      expect(ownStyle(dot.querySelector('.wd-slider__dot-slider')!).overflow).not.toBe('hidden')
    }
    const popovers = Array.from(container.querySelectorAll('.wd-slider__dot-popover'))
    expect(popovers).toHaveLength(dots.length)
    for (const popover of popovers) {
      const style = ownStyle(popover)
      expect(style.position).toBe('absolute')
      expect(style['pointer-events']).toBe('none')
      expect(style.bottom).toBe('auto')
      expect(style.top).toBe(vertical ? '50%' : 'calc(0px - var(--wot-slider-dot-popover-gap, var(--wot-n-3, 3px)))')
      expect(style.transform).toBe(vertical ? 'translateY(-50%)' : 'translate(-50%, -100%)')
      expect(style.transform).not.toContain('scale(')
      expect(style.opacity).toBeUndefined()
      expectText(popover.querySelector('.wd-slider__dot-popover-text'))
    }
    // 样式合并仍由主代理的 __line 输出承担；dot 锚点没有接管 MT 的进度尺寸。
    const line = container.querySelector('.wd-slider__line') as HTMLElement
    expect(line.style.getPropertyValue(vertical ? 'height' : 'width')).toBe(range ? '60%' : '50%')
    expect(line.style.getPropertyValue(vertical ? 'width' : 'height')).toBe('100%')
  })

  it.each([false, true])('气泡按自身盒高/宽度定位，字体和 padding 可变而非硬编码（vertical=%s）', async (vertical) => {
    const { container } = render(Slider, { modelValue: 100, vertical, popoverVisible: 'always' })
    await flush()
    const popover = container.querySelector('.wd-slider__dot-popover')!
    const style = ownStyle(popover)
    const text = expectText(popover.querySelector('.wd-slider__dot-popover-text'), '100')
    const overrides = {
      '--wot-slider-dot-popover-gap': '9px',
      '--wot-slider-dot-popover-font-size': '22px',
      '--wot-slider-dot-popover-line-height': '30px',
      '--wot-slider-dot-popover-padding': '8px 16px'
    }
    expect(resolveTokens(text['font-size'], overrides)).toBe('22px')
    expect(resolveTokens(text['line-height'], overrides)).toBe('30px')
    expect(resolveTokens(text.padding, overrides)).toBe('8px 16px')
    expect(resolveTokens(vertical ? style.left : style.top, overrides)).toBe(vertical ? 'calc(100% + 9px)' : 'calc(0px - 9px)')
    expect(style.width).toBeUndefined()
    expect(style.height).toBeUndefined()
    expect(text.width).toBeUndefined()
    expect(text.height).toBeUndefined()
  })

  it('零进度与重合范围仍保留有尺寸、有明确起边的滑块', async () => {
    for (const props of [{ modelValue: 0 }, { modelValue: [50, 50], range: true }, { modelValue: 100, min: 100, max: 100 }]) {
      const { container } = render(Slider, props)
      await flush()
      expect((container.querySelector('.wd-slider__line') as HTMLElement).style.width).toBe('0%')
      for (const dot of container.querySelectorAll('.wd-slider__dot')) {
        const style = ownStyle(dot)
        expect(resolveTokens(style.width)).toBe('24px')
        expect(resolveTokens(style.height)).toBe('24px')
        expect(style.top).toBe('0')
        expect(style.left).not.toBe('auto')
      }
    }
  })
})

describe('Slider normal 气泡的结构显隐', () => {
  it.each([false, true].flatMap((vertical) => [false, true].map((range) => ({ vertical, range }))))('vertical=$vertical/range=$range：只挂活动端，松手不重建握把或回滚 MT 位置', async ({ vertical, range }) => {
    const value = ref<SliderValue>(range ? [20, 80] : 50)
    const { container } = render({
      setup: () => () => h(Slider as any, {
        vertical, range, modelValue: value.value,
        'onUpdate:modelValue': (next: SliderValue) => { value.value = next }
      })
    } as any)
    await flush()
    const line = container.querySelector('.wd-slider__line') as HTMLElement
    const dots = Array.from(container.querySelectorAll('.wd-slider__dot'))
    const grips = dots.map((dot) => dot.querySelector('.wd-slider__dot-slider')!)
    expect(container.querySelectorAll('.wd-slider__dot-popover')).toHaveLength(0)
    for (const [index, dot] of dots.entries()) {
      const grip = grips[index]
      expect(grip).toBeTruthy()
      expect(grip.getAttribute('gesture-index')).toBe(String(index))
      const timestamp = 1_000 + index * 100
      const before = range ? [...(value.value as number[])] : [value.value as number, 0]
      const expectedValue = before[index] + 10 // 20px / 200px 轨道 * 100 的取值范围。
      const expectedSpan = range ? (index === 0 ? before[1] - expectedValue : expectedValue - before[0]) : expectedValue
      const start = { clientX: 100, clientY: 100, identifier: index + 1 }
      // 每帧只派发一次：握把 MT 先执行，再沿同一事件冒泡到 dot/bar 的 BG 处理器。
      fireEvent.touchstart(grip, { touches: [start], changedTouches: [start], timestamp, bubbles: true })
      await flush()
      expect(container.querySelectorAll('.wd-slider__dot-popover')).toHaveLength(1)
      expect(dot.querySelector('.wd-slider__dot-popover')).toBeTruthy()
      expect(dot.querySelector('.wd-slider__dot-slider')).toBe(grip)
      const move = { ...start, clientX: vertical ? 100 : 120, clientY: vertical ? 120 : 100 }
      fireEvent.touchmove(grip, { touches: [move], timestamp: timestamp + 1, bubbles: true })
      const mtStyle = line.getAttribute('style')
      expect(line.style.getPropertyValue(vertical ? 'height' : 'width'), '握把 MT 必须立即推进，不能以未变化样式假绿').toBe(`${expectedSpan}%`)
      await flush()
      expect(line.getAttribute('style'), '气泡文案/v-model 回写不得覆盖 MT 已推进的样式').toBe(mtStyle)
      expect(range ? (value.value as number[])[index] : value.value).toBe(expectedValue)
      expectText(dot.querySelector('.wd-slider__dot-popover-text'), String(expectedValue))
      fireEvent.touchend(grip, { touches: [], changedTouches: [move], timestamp: timestamp + 2, bubbles: true })
      await flush()
      expect(container.querySelectorAll('.wd-slider__dot-popover')).toHaveLength(0)
      expect(container.querySelector('.wd-slider__line')).toBe(line)
      dots.forEach((original, position) => {
        expect(container.querySelectorAll('.wd-slider__dot')[position]).toBe(original)
        expect(original.querySelector('.wd-slider__dot-slider')).toBe(grips[position])
      })
    }
  })

  it('切换 always/normal/never 只增删气泡子树', async () => {
    const mode = ref<'always' | 'normal' | 'never'>('normal')
    const { container } = render({
      setup: () => () => h(Slider, { modelValue: [20, 80], range: true, popoverVisible: mode.value })
    } as any)
    await flush()
    const dots = Array.from(container.querySelectorAll('.wd-slider__dot'))
    for (const next of ['always', 'normal', 'never'] as const) {
      mode.value = next
      await flush()
      expect(container.querySelectorAll('.wd-slider__dot-popover')).toHaveLength(next === 'always' ? 2 : 0)
      dots.forEach((dot, index) => expect(container.querySelectorAll('.wd-slider__dot')[index]).toBe(dot))
    }
  })
})
