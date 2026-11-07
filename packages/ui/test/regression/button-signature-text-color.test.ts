/**
 * Button/Signature native foreground regressions. Compile source SCSS in memory
 * (no generated CSS writes) and inspect actual text nodes plus direct declarations.
 * The source-token resolver deliberately does NOT inherit view color: jsdom/Web
 * inheritance would hide this device bug. These checks are not native pixel tests.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createTextVNode, Fragment, h, nextTick, ref } from 'vue-lynx'
import { compile } from 'sass'
import postcss, { type Root } from 'postcss'
import path from 'node:path'
import Button from '../../src/primitives/wd-button/wd-button.vue'
import { buttonProps } from '../../src/primitives/wd-button/types'
import Signature from '../../src/components/wd-signature/wd-signature.vue'
import ConfigProvider from '../../src/components/wd-config-provider/wd-config-provider.vue'
import { cleanup, render } from '../render'
import { fireEvent } from '../fire-event'

type Declarations = Record<string, string>
const buttonCss = postcss.parse(compile(path.resolve(__dirname, '../../src/primitives/wd-button/index.scss')).css)
const themeCss = postcss.parse(compile(path.resolve(__dirname, '../../src/styles/theme/index.scss')).css)
const types = ['primary', 'success', 'info', 'warning', 'danger'] as const
const variants = ['base', 'plain', 'dashed', 'soft', 'subtle', 'text'] as const
const palette = { primary: 'primary-6', success: 'success-main', info: 'text-main', warning: 'warning-main', danger: 'danger-main' }
const activePalette = { primary: 'primary-7', success: 'success-clicked', info: 'text-secondary', warning: 'warning-clicked', danger: 'danger-clicked' }
const restores: Array<() => void> = []
const nativeQueries = vi.fn()

function declarations(element: Element, sheet: Root = buttonCss): Declarations {
  const values: Declarations = {}
  sheet.walkRules((rule) => {
    if (rule.parent?.type !== 'root' || !rule.selectors.some((selector) => element.matches(selector))) return
    rule.walkDecls((decl) => { values[decl.prop] = decl.value })
  })
  return values
}
function variables(element: Element): Declarations {
  const ancestors: Element[] = []
  for (let current: Element | null = element; current; current = current.parentElement) ancestors.unshift(current)
  const values: Declarations = {}
  for (const current of ancestors) {
    for (const sheet of [themeCss, buttonCss]) {
      for (const [key, value] of Object.entries(declarations(current, sheet))) if (key.startsWith('--')) values[key] = value
    }
    const style = (current as HTMLElement).style
    for (let index = 0; index < style.length; index++) {
      const key = style.item(index)
      if (key.startsWith('--') && style.getPropertyValue(key)) values[key] = style.getPropertyValue(key)
    }
  }
  return values
}
function resolveVars(value: string, values: Declarations): string {
  let resolved = value
  for (let iteration = 0; iteration < 40 && resolved.includes('var('); iteration++) {
    const previous = resolved
    resolved = resolved.replace(/var\((--[\w-]+)(?:,\s*([^()]*))?\)/g,
      (_, name, fallback) => values[name] ?? fallback ?? `unresolved:${name}`)
    if (resolved === previous) break
  }
  expect(resolved, `unresolved source color ${value}`).not.toMatch(/var\(|unresolved:/)
  return resolved.trim()
}
function cssColor(value: string): string {
  const text = document.createElement('text')
  text.style.color = value
  expect(text.style.color, `invalid test color ${value}`).toBeTruthy()
  // Canonicalize this isolated, explicit color to RGB/RGBA (e.g. white -> rgb).
  // Never use component computedStyle/inheritance to prove its native foreground.
  return text.ownerDocument.defaultView!.getComputedStyle(text).color
}
function foreground(text: HTMLElement): string {
  const color = text.style.color || declarations(text).color
  expect(color, 'the native text itself must declare its foreground').toBeTruthy()
  expect(color).not.toMatch(/^(inherit|currentColor)$/i)
  return cssColor(resolveVars(color, variables(text)))
}
function expectedForeground(text: HTMLElement, type: typeof types[number], variant: typeof variants[number], active = false): string {
  const token = variant === 'base' ? (type === 'info' ? 'text-main' : 'text-white') : (active ? activePalette : palette)[type]
  return cssColor(resolveVars(`var(--wot-${token})`, variables(text)))
}
function label(button: Element): HTMLElement {
  const text = button.querySelector('.wd-button__text > text.wd-button__text-content') as HTMLElement
  expect(text, 'props and ordinary text slots must share the native label boundary').toBeTruthy()
  expect(text.tagName.toLowerCase()).toBe('text')
  expect(text.getAttribute('text-maxline')).toBe('1')
  expect(declarations(text)['font-size']).toBeTruthy()
  expect(declarations(text)['line-height']).toBe('1.4')
  return text
}
function mount(props: Record<string, any>, slots?: any) {
  const local = ref(props)
  const result = render({ setup: () => () => h('view', { style: { color: '#000000' } }, [h(Button, local.value, slots)]) } as any)
  return { ...result, local, button: () => result.container.querySelector('.wd-button') as HTMLElement }
}

/** Only this regression extends the existing test shim with the public native API. */
beforeEach(() => {
  nativeQueries.mockClear()
  const implementation = (globalThis as any).lynxTestingEnv.mainThread.globalThis.lynxWorkletImpl._refImpl
  const original = implementation.updateWorkletRef
  vi.spyOn(implementation, 'updateWorkletRef').mockImplementation((reference: any, element: HTMLElement) => {
    original(reference, element)
    const wrapper = implementation._workletRefMap[reference._wvid]?.current
    if (!wrapper) return
    wrapper.querySelectorAll = (selector: string) => {
      nativeQueries(selector)
      return [...element.querySelectorAll<HTMLElement>(selector)].map((text) => ({
        setStyleProperty: (key: string, value: string) => text.style.setProperty(key, value),
        getAttribute: (key: string) => text.getAttribute(key)
      }))
    }
  })
})
afterEach(() => {
  cleanup()
  restores.splice(0).reverse().forEach((restore) => restore())
  vi.restoreAllMocks()
})
function hoverClock() {
  const environment = (globalThis as any).lynxTestingEnv
  const mt = environment.mainThread.globalThis, bg = environment.backgroundThread.globalThis
  const originals = [mt.requestAnimationFrame, bg.requestAnimationFrame, (globalThis as any).requestAnimationFrame]
  let now = 1000
  const frames: Array<FrameRequestCallback> = []
  const schedule = (callback: FrameRequestCallback) => { frames.push(callback); return frames.length }
  mt.requestAnimationFrame = schedule; bg.requestAnimationFrame = schedule
  ;(globalThis as any).requestAnimationFrame = schedule
  vi.spyOn(Date, 'now').mockImplementation(() => now)
  restores.push(() => {
    mt.requestAnimationFrame = originals[0]; bg.requestAnimationFrame = originals[1]
    ;(globalThis as any).requestAnimationFrame = originals[2]
  })
  return {
    advance(milliseconds: number) {
      now += milliseconds
      const callbacks = frames.splice(0)
      environment.switchToMainThread()
      callbacks.forEach((callback) => callback(now))
      environment.switchToBackgroundThread()
    }
  }
}
function hover(button: Element, name: 'touchstart' | 'touchend' | 'touchcancel') {
  fireEvent[name](button, { touches: [{ clientX: 10, clientY: 10 }] })
}

describe('Button direct native text foreground', () => {
  for (const theme of ['light', 'dark'] as const) {
    for (const type of types) {
      it.each(variants)(`${theme}/${type}/%s gives text prop and ordinary text slot the correct direct color`, (variant) => {
        const { container } = render({ setup: () => () => h(ConfigProvider, { theme }, () => h('view', { style: { color: 'black' } }, [
          h(Button, { type, variant, text: '实字' }), h(Button, { type, variant }, () => '文字插槽')
        ])) } as any)
        const buttons = [...container.querySelectorAll('.wd-button')]
        expect(buttons.map((button) => label(button).textContent)).toEqual(['实字', '文字插槽'])
        for (const button of buttons) {
          const text = label(button)
          expect(foreground(text)).toBe(expectedForeground(text, type, variant))
          expect(declarations(text).color).toBe(declarations(button.querySelector('.wd-button__text')!).color)
          expect(button.classList.contains('is-round'), 'keep the staged default pill geometry').toBe(true)
          expect(declarations(button)['line-height']).toBeUndefined()
        }
      })
    }
  }

  it('themeVars keeps solid main color independent from every non-solid type color', () => {
    const themeVars = {
      buttonMainColor: '#fedcba', buttonPrimaryColor: '#5500aa', buttonSuccessColor: '#126843',
      buttonInfoColor: '#293847', buttonWarningColor: '#995500', buttonDangerColor: '#aa1133'
    }
    const expected = { primary: '#5500aa', success: '#126843', info: '#293847', warning: '#995500', danger: '#aa1133' }
    const { container } = render({ setup: () => () => h(ConfigProvider, { theme: 'dark', themeVars }, () => h('view', null,
      types.flatMap((type) => variants.map((variant) => h(Button, { type, variant, text: `${type}/${variant}` })))
    )) } as any)
    for (const button of container.querySelectorAll('.wd-button')) {
      const [type, variant] = label(button).textContent!.split('/') as [typeof types[number], typeof variants[number]]
      expect(foreground(label(button))).toBe(cssColor(variant === 'base' && type !== 'info' ? '#fedcba' : expected[type]))
    }
  })

  it('reactive global defaults and local overrides update native text, preserving typography and clearing custom colors', async () => {
    const config = ref<Record<string, any>>({ type: 'warning', variant: 'plain' })
    const local = ref<Record<string, any>>({ text: '全局默认' })
    const { container } = render({ setup: () => () => h(ConfigProvider, { theme: 'light', button: config.value }, () => h(Button, local.value)) } as any)
    const button = container.querySelector('.wd-button')!, text = label(button)
    expect(foreground(text)).toBe(expectedForeground(text, 'warning', 'plain'))
    local.value = { type: 'danger', variant: 'base', text: '本地覆盖', customStyle: { color: '#123456', fontSize: '18px', lineHeight: '24px' } }
    await nextTick()
    expect(text.textContent).toBe('本地覆盖'); expect(foreground(text)).toBe(cssColor('#123456'))
    expect(text.style.fontSize).toBe('18px'); expect(text.style.lineHeight).toBe('24px')
    expect((button as HTMLElement).style.lineHeight).toBe('')
    local.value = { text: '重新继承' }; config.value = { type: 'info', variant: 'soft' }; await nextTick()
    expect(text.style.color).toBe(''); expect(text.style.fontSize).toBe(''); expect(text.style.lineHeight).toBe('')
    expect(foreground(text)).toBe(expectedForeground(text, 'info', 'soft'))
  })
})

describe('Button native text hover transitions', () => {
  it.each(['light', 'dark'] as const)('%s keeps all type/variant text colors correct while pressed and after release', (theme) => {
    const themeVars = {
      buttonPrimaryColorActive: '#440088', buttonSuccessColorActive: '#115533', buttonInfoColorActive: '#445566',
      buttonWarningColorActive: '#774400', buttonDangerColorActive: '#881122'
    }
    const active = { primary: '#440088', success: '#115533', info: '#445566', warning: '#774400', danger: '#881122' }
    const { container } = render({ setup: () => () => h(ConfigProvider, { theme, themeVars }, () => h('view', null,
      types.flatMap((type) => variants.map((variant) => h(Button, { type, variant, text: `${type}/${variant}`, hoverStartTime: 0, hoverStayTime: 0 })))
    )) } as any)
    for (const button of container.querySelectorAll('.wd-button')) {
      const text = label(button)
      const [type, variant] = text.textContent!.split('/') as [typeof types[number], typeof variants[number]]
      const original = foreground(text)
      hover(button, 'touchstart')
      expect(text.style.color).toBe('var(--wot-button-current-text-active)')
      expect(foreground(text)).toBe(variant === 'base' ? expectedForeground(text, type, variant) : cssColor(active[type]))
      hover(button, 'touchend')
      expect(text.style.color).toBe(''); expect(foreground(text)).toBe(original)
    }
    // 5 类型 × 6 变体逐个解析源 SCSS 变量（纯 CPU，无定时器）：并行跑全量
    // 套件时稳定超过默认 5s，显式放宽（与其它重负载用例一致）。
  }, 30_000)

  it('honors hover delays, queries only at color transitions, and cancel/short taps do not leave active text', () => {
    const clock = hoverClock(), mounted = mount({ text: '延迟按压', variant: 'plain', hoverStartTime: 40, hoverStayTime: 90 })
    const button = mounted.button(), text = label(button)
    hover(button, 'touchstart'); clock.advance(20); clock.advance(19)
    expect(text.style.color).toBe(''); expect(nativeQueries).not.toHaveBeenCalled()
    clock.advance(1)
    expect(text.style.color).toBe('var(--wot-button-current-text-active)'); expect(nativeQueries).toHaveBeenCalledTimes(1)
    hover(button, 'touchend'); clock.advance(40); clock.advance(49)
    expect(text.style.color).toBe('var(--wot-button-current-text-active)'); expect(nativeQueries).toHaveBeenCalledTimes(1)
    clock.advance(1); expect(text.style.color).toBe(''); expect(nativeQueries).toHaveBeenCalledTimes(2)
    hover(button, 'touchstart'); clock.advance(40); hover(button, 'touchcancel'); clock.advance(100)
    expect(text.style.color).toBe('')
    hover(button, 'touchstart'); clock.advance(10); hover(button, 'touchend'); clock.advance(100)
    expect(text.style.color).toBe('')
  })

  it.each(['disabled', 'loading'])('%s keeps the direct foreground and ignores both hover and taps', (state) => {
    const click = vi.fn()
    const mounted = mount({ [state]: true, text: '不可操作', hoverStartTime: 0, onClick: click })
    const button = mounted.button(), text = label(button)
    hover(button, 'touchstart'); fireEvent.tap(button)
    expect(text.style.color).toBe(''); expect(foreground(text)).toBe(cssColor('white'))
    expect(click).not.toHaveBeenCalled(); expect(nativeQueries).not.toHaveBeenCalled()
  })

  it('invalidates active native text on variant/loading changes and preserves new custom colors from old release frames', async () => {
    const clock = hoverClock(), mounted = mount({ text: '状态变化', variant: 'plain', hoverStartTime: 0, hoverStayTime: 90 })
    const button = mounted.button(), text = label(button)
    hover(button, 'touchstart'); hover(button, 'touchend')
    mounted.local.value.customStyle = { color: '#123456' }; await nextTick()
    clock.advance(90); expect(text.style.color).toBe(cssColor('#123456'))
    hover(button, 'touchstart'); hover(button, 'touchcancel'); expect(text.style.color).toBe(cssColor('#123456'))
    mounted.local.value.customStyle = ''; await nextTick(); expect(text.style.color).toBe('')
    hover(button, 'touchstart'); mounted.local.value.variant = 'soft'; await nextTick()
    expect(text.style.color).toBe(''); expect(foreground(text)).toBe(expectedForeground(text, 'primary', 'soft'))
    hover(button, 'touchstart'); mounted.local.value.loading = true; await nextTick()
    expect(text.style.color).toBe(''); hover(button, 'touchcancel'); expect(text.style.color).toBe('')
  })

  it('colors every normalized fragment leaf but does not mutate explicit caller text, layouts, or nested Button labels', async () => {
    const words = ref(['前', '后'])
    const mounted = mount({ hoverStartTime: 0, hoverStayTime: 0 }, { default: () => [
      ...words.value.map((word) => h(Fragment, { key: word }, [createTextVNode(word)])),
      h(Fragment, null, [' ', 0]),
      h('text', { class: 'caller-text', style: { color: '#123456' } }, '自定文字'),
      h('view', { class: 'caller-layout' }, [h(Button, { text: '内层', variant: 'plain', type: 'danger' })])
    ] })
    const button = mounted.button()
    const normalized = () => [...button.querySelectorAll<HTMLElement>('.wd-button__text > text.wd-button__text-content')].filter((text) => text.closest('.wd-button') === button)
    expect(normalized().map((text) => text.textContent)).toEqual(['前', '后', ' ', '0'])
    hover(button, 'touchstart')
    expect(normalized().every((text) => text.style.color === 'var(--wot-button-current-text-active)')).toBe(true)
    expect((button.querySelector('.caller-text') as HTMLElement).style.color).toBe(cssColor('#123456'))
    expect(label(button.querySelector('.caller-layout .wd-button')!).style.color).toBe('')
    hover(button, 'touchcancel')
    words.value = ['后', '新', '前']; await nextTick()
    expect(normalized().map((text) => text.textContent)).toEqual(['后', '新', '前', ' ', '0'])
    expect(button.querySelector('.caller-layout')!.closest('text')).toBeNull()
    hover(button, 'touchstart'); hover(button, 'touchend')
    expect(normalized().every((text) => text.style.color === '')).toBe(true)
  })
})

describe('Signature footer public button variants and real text', () => {
  it('renders Clear outlined and Confirm solid with their own native text colors', () => {
    expect(buttonProps).not.toHaveProperty('plain'); expect(buttonProps).toHaveProperty('variant')
    const clear = vi.fn(), confirm = vi.fn()
    const { container } = render(Signature, { onClear: clear, onConfirm: confirm })
    const [clearButton, confirmButton] = [...container.querySelectorAll<HTMLElement>('.wd-signature__button')]
    expect(label(clearButton).textContent).toBe('清空'); expect(label(confirmButton).textContent).toBe('确认')
    expect(clearButton.classList.contains('is-plain')).toBe(true); expect(clearButton.hasAttribute('plain')).toBe(false)
    expect(clearButton.querySelector('.wd-button__border')).not.toBeNull()
    expect(confirmButton.classList.contains('is-plain')).toBe(false); expect(confirmButton.querySelector('.wd-button__border')).toBeNull()
    // No Provider here: source fallback must also be valid for standalone use.
    expect(foreground(label(clearButton))).not.toBe(cssColor('white'))
    expect(foreground(label(confirmButton))).toBe(cssColor('white'))
    fireEvent.tap(clearButton); fireEvent.tap(confirmButton)
    expect(clear).toHaveBeenCalledOnce(); expect(confirm).toHaveBeenCalledOnce()
    expect(confirm.mock.calls[0][0].tempFilePath).toMatch(/^data:image\/svg\+xml/)
  })

  it.each(['light', 'dark'] as const)('%s keeps history/Clear outlined and Confirm solid despite a global text variant', async (theme) => {
    const themeVars = { buttonPrimaryColor: '#5500aa', buttonMainColor: '#ffffff' }
    const { container } = render({ setup: () => () => h(ConfigProvider, { theme, themeVars, button: { variant: 'text' } }, () => h(Signature, { enableHistory: true })) } as any)
    const buttons = [...container.querySelectorAll<HTMLElement>('.wd-signature__button')]
    expect(buttons.map((button) => label(button).textContent)).toEqual(['撤销', '恢复', '清空', '确认'])
    for (const button of buttons.slice(0, 3)) {
      expect(button.classList.contains('is-plain')).toBe(true); expect(button.hasAttribute('plain')).toBe(false)
      expect(button.querySelector('.wd-button__border')).not.toBeNull()
      expect(foreground(label(button))).toBe(cssColor('#5500aa'))
    }
    expect(buttons[0].classList.contains('is-disabled')).toBe(true)
    expect(buttons[1].classList.contains('is-disabled')).toBe(true)
    expect(buttons[3].classList.contains('is-text')).toBe(false)
    expect(buttons[3].querySelector('.wd-button__border')).toBeNull()
    expect(foreground(label(buttons[3]))).toBe(cssColor('white'))
    const canvas = container.querySelector('.wd-signature__content-canvas')!
    fireEvent.touchstart(canvas, { touches: [{ clientX: 10, clientY: 20 }] })
    fireEvent.touchend(canvas, { touches: [], changedTouches: [{ clientX: 10, clientY: 20 }] }); await nextTick()
    expect(buttons[0].classList.contains('is-disabled')).toBe(false)
    fireEvent.tap(buttons[0]); await nextTick(); expect(buttons[1].classList.contains('is-disabled')).toBe(false)
    fireEvent.tap(buttons[1]); await nextTick(); expect(buttons[0].classList.contains('is-disabled')).toBe(false)
    fireEvent.tap(buttons[2]); await nextTick()
    expect(buttons[0].classList.contains('is-disabled')).toBe(true); expect(buttons[1].classList.contains('is-disabled')).toBe(true)
  })

  it('updates footer text props and retains history alias precedence', async () => {
    const props = ref<Record<string, any>>({ enableHistory: true, clearText: '擦除', confirmText: '保存', revokeText: '撤回优先', undoText: '撤回别名', restoreText: '恢复优先', redoText: '恢复别名' })
    const { container } = render({ setup: () => () => h(Signature, props.value) } as any)
    const buttons = [...container.querySelectorAll('.wd-signature__button')]
    expect(buttons.map((button) => label(button).textContent)).toEqual(['撤回优先', '恢复优先', '擦除', '保存'])
    props.value = { enableHistory: true, undoText: '撤回别名', redoText: '恢复别名' }; await nextTick()
    expect(buttons.map((button) => label(button).textContent)).toEqual(['撤回别名', '恢复别名', '清空', '确认'])
    expect(foreground(label(buttons[3]))).toBe(cssColor('white'))
  })

  it('leaves caller-owned footer content and its scoped actions unchanged', () => {
    const clear = vi.fn(), confirm = vi.fn()
    let scope: any
    const { container } = render({ setup: () => () => h(Signature, { onClear: clear, onConfirm: confirm }, {
      footer: (actions: any) => {
        scope = actions
        return h('view', { class: 'custom-footer' }, [h('text', { style: { color: '#123456' } }, '自定义 footer')])
      }
    }) } as any)
    expect(container.querySelector('.wd-signature__button')).toBeNull()
    expect((container.querySelector('.custom-footer text') as HTMLElement).style.color).toBe(cssColor('#123456'))
    expect(scope.canUndo).toBe(false); expect(scope.canRedo).toBe(false)
    scope.clear(); scope.confirm()
    expect(clear).toHaveBeenCalledOnce(); expect(confirm).toHaveBeenCalledOnce()
  })
})
