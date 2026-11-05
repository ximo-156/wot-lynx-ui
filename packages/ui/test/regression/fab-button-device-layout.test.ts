/**
 * Fab/Button device-layout contracts. Compile only the two SCSS sources in
 * memory: no generated CSS edits and no full build. jsdom proves VNode/event
 * wiring, NOT native painting; geometry, typography and palette contracts are
 * asserted independently of browser computed layout.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { compile } from 'sass'
import postcss from 'postcss'
import path from 'node:path'
import { h, nextTick, ref } from 'vue-lynx'
import Button from '../../src/primitives/wd-button/wd-button.vue'
import Fab from '../../src/components/wd-fab/wd-fab.vue'
import ConfigProvider from '../../src/components/wd-config-provider/wd-config-provider.vue'
import { GREEN, ORANGE, PRIMARY_COLOR, RED, THEME_TEXT_COLOR } from '../../src/common/theme'
import { registerIconSet } from '../../src/icons/registry'
import { cleanup, render } from '../render'
import { fireEvent } from '../fire-event'
import { pause } from '../../src/common/util'

const buttonCss = postcss.parse(compile(path.resolve(__dirname, '../../src/primitives/wd-button/index.scss')).css)
const fabCss = postcss.parse(compile(path.resolve(__dirname, '../../src/components/wd-fab/index.scss')).css)
function rule(selector: string, css = buttonCss): Record<string, string> {
  const declarations: Record<string, string> = {}
  css.walkRules((candidate) => {
    if (!candidate.selectors.includes(selector)) return
    candidate.walkDecls((decl) => { declarations[decl.prop] = decl.value })
  })
  expect(Object.keys(declarations).length, `missing source SCSS selector ${selector}`).toBeGreaterThan(0)
  return declarations
}
function nativeFlex(selector: string, direction = 'row', css = buttonCss) {
  const declarations = rule(selector, css)
  expect(declarations.display).toBe('flex')
  expect(declarations['flex-direction']).toBe(direction)
  expect(declarations['align-items']).toBe('center')
  expect(declarations['justify-content']).toBe('center')
}
function cssColor(color: string) {
  const element = document.createElement('span')
  element.style.color = color
  return element.style.color
}
afterEach(() => { cleanup(); vi.restoreAllMocks() })

const sizes = [ ['mini', 28, 14], ['small', 32, 16], ['medium', 40, 20], ['large', 44, 22] ] as const

describe('Button explicit native content and geometry', () => {
  it('plain slot text and props fallback share the same styled single-line text contract', () => {
    const { container } = render({ setup: () => () => h('view', null, [
      h(Button, null, () => '菜单'), h(Button, { text: '编辑' })
    ]) } as any)
    const labels = Array.from(container.querySelectorAll('.wd-button > .wd-button__content > .wd-button__text > text.wd-button__text-content'))
    expect(labels.map((label) => label.textContent)).toEqual(['菜单', '编辑'])
    expect(labels.every((label) => label.getAttribute('text-maxline') === '1')).toBe(true)
  })

  it('dynamic/structured slots keep their layout owner and caller-owned native hierarchy', async () => {
    const label = ref('菜单')
    const { container } = render({ setup: () => () => h(Button, { icon: 'edit' }, { default: () => [
      label.value, h('view', { class: 'caller-slot' }, [h('text', null, '保留结构')])
    ] }) } as any)
    label.value = '编辑'; await nextTick()
    expect(container.querySelector('.wd-button__text-content')!.textContent).toBe('编辑')
    expect(container.querySelector('.caller-slot')!.parentElement!.classList.contains('wd-button__text')).toBe(true)
    expect(container.querySelector('.caller-slot')!.closest('text')).toBeNull()
    expect(container.querySelector('.wd-button')!.classList.contains('is-icon')).toBe(false)
  })

  it('custom typography reaches the real text and clears without a duplicate native view line box', async () => {
    const customStyle = ref<Record<string, string>>({ color: '#123456', fontSize: '18px', lineHeight: '24px', height: '48px' })
    const { container } = render({ setup: () => () => h(Button, { customStyle: customStyle.value }, () => '文字') } as any)
    const root = container.querySelector('.wd-button') as HTMLElement
    const label = container.querySelector('.wd-button__text-content') as HTMLElement
    expect(root.style.height).toBe('48px')
    expect(root.style.fontSize).toBe('')
    expect(root.style.lineHeight).toBe('')
    expect(label.style.fontSize).toBe('18px')
    expect(label.style.lineHeight).toBe('24px')
    expect(label.style.color).toBe(cssColor('#123456'))
    customStyle.value = {}; await nextTick()
    expect(label.style.fontSize).toBe('')
    expect(label.style.lineHeight).toBe('')
    expect(label.style.color).toBe('')
  })

  it('centers geometric rows without overflow clipping or inherited view line-height', () => {
    for (const selector of ['.wd-button', '.wd-button__content', '.wd-button__text']) {
      nativeFlex(selector)
      const declarations = rule(selector)
      expect(declarations['flex-shrink']).toBe('0')
      expect(declarations['line-height']).toBeUndefined()
      expect(declarations['font-size']).toBeUndefined()
      expect(declarations.overflow).toBeUndefined()
    }
    expect(rule('.wd-button__text-content')['text-align']).toBe('center')
    // One direct-parent color hop is intentional; no intervening unstyled view.
    expect(rule('.wd-button__text-content').color).toBe('inherit')
    for (const type of ['primary', 'success', 'info', 'warning', 'danger']) {
      expect(rule(`.wd-button.is-${type} .wd-button__text`).color).not.toBe('inherit')
      for (const variant of ['plain', 'dashed', 'soft', 'subtle', 'text']) {
        expect(rule(`.wd-button.is-${variant}.is-${type} .wd-button__text`).color).not.toBe('inherit')
      }
    }
  })

  it.each(sizes)('%s uses native text metrics, explicit icon size, and equal circle axes', (size, height, iconSize) => {
    const declarations = rule(`.wd-button.is-${size}`)
    expect(declarations.height).toContain(`${height}px`)
    expect(declarations['line-height']).toBeUndefined()
    expect(declarations['font-size']).toBeUndefined()
    const text = rule(`.wd-button.is-${size} .wd-button__text-content`)
    expect(text['font-size']).toContain(`--wot-button-font-size-${size}`)
    expect(text['line-height']).toBe('1.4')
    const circle = rule(`.wd-button.is-${size}.is-icon`)
    expect(circle.width).toBe(declarations.height)
    // Width is the native geometry contract; retain the old minimum as a
    // compatible lower bound for compositions such as pagination buttons.
    expect(circle['min-width']).toBe(circle.width)
    expect(rule('.wd-button.is-icon.is-round').padding).toBe('0')
    const { container } = render(Button, { size, round: true, icon: 'edit' })
    expect(container.querySelector('.wd-button')!.className).toContain('is-icon')
    expect(container.querySelector('.wd-button__text')).toBeNull()
    const icon = container.querySelector('.wd-button__icon') as HTMLElement
    expect(icon.style.fontSize).toContain(`--wot-button-size-icon-${size}`)
    expect(icon.style.fontSize).toContain(`${iconSize}px`)
  })

  it('round text remains a pill, while a loading-only round button keeps circle geometry', async () => {
    const props = ref<Record<string, any>>({ round: true, loading: true })
    const { container } = render({ setup: () => () => h(Button, props.value) } as any)
    const root = container.querySelector('.wd-button')!
    expect(root.classList.contains('is-icon')).toBe(true)
    expect(container.querySelector('.wd-loading')).not.toBeNull()
    props.value = { round: true, text: '圆角' }; await nextTick()
    expect(root.classList.contains('is-round')).toBe(true)
    expect(root.classList.contains('is-icon')).toBe(false)
    expect(container.querySelector('.wd-button__text-content')!.textContent).toBe('圆角')
    expect(rule('.wd-button.is-block').width).toBe('100%')
  })

  it('CSS-icon/image/SVG branches receive the Button size rather than Icon default 14px', () => {
    registerIconSet({ key: 'button-device', type: 'svg', viewBox: '0 0 10 10', paths: { probe: 'M0 0H10V10H0Z' } })
    for (const props of [{ icon: 'test-css', cssIcon: true }, { icon: 'https://example.test/icon.png' }, { icon: 'button-device:probe' }]) {
      const { container } = render(Button, { ...props, size: 'large', round: true })
      const icon = container.querySelector('.wd-button__icon') as HTMLElement
      expect(icon.style.fontSize).toContain('--wot-button-size-icon-large')
      const graphic = container.querySelector('svg') as HTMLElement | null
      if (graphic) {
        expect(graphic.style.width).toContain('--wot-button-size-icon-large')
        expect(graphic.style.height).toBe(graphic.style.width)
        expect(graphic.getAttribute('content')).toContain('#ffffff')
      } else {
        expect(icon.style.width).toContain('--wot-button-size-icon-large')
        expect(icon.style.height).toBe(icon.style.width)
      }
    }
  })
})

const foregrounds = { primary: PRIMARY_COLOR, success: GREEN[6], warning: ORANGE[6], danger: RED[6], info: THEME_TEXT_COLOR.light }
describe('Button native icon/loading foreground contract', () => {
  for (const variant of ['base', 'plain', 'dashed', 'soft', 'subtle', 'text']) {
    for (const [type, nonSolidColor] of Object.entries(foregrounds)) {
      it(`${type}/${variant} gives icon and loading the correct concrete foreground`, async () => {
        const props = ref({ type, variant, icon: 'edit', text: '文字', loading: false })
        const { container } = render({ setup: () => () => h(Button, props.value as any) } as any)
        const color = variant === 'base' && type !== 'info' ? '#ffffff' : nonSolidColor
        expect((container.querySelector('.wd-button__icon') as HTMLElement).style.color).toBe(cssColor(color))
        props.value.loading = true; await nextTick()
        expect(container.querySelector('.wd-button__icon')).toBeNull()
        expect((container.querySelector('.wd-loading') as HTMLElement).style.color).toBe(cssColor(color))
        const spinner = container.querySelector('.wd-button__loading') as HTMLElement
        expect(spinner.style.width).toContain('--wot-button-loading-size')
        expect(spinner.style.height).toBe(spinner.style.width)
        expect(container.querySelector('.wd-loading__spinner-circular')!.getAttribute('content')).toContain(color)
        expect(container.querySelector('.wd-button__text-content')!.textContent).toBe('文字')
      })
    }
  }

  it('solid text tokens do not accidentally use plain text colors; custom loading color wins', async () => {
    const props = ref<Record<string, any>>({ loading: true, text: 'theme' })
    const { container } = render({ setup: () => () => h(ConfigProvider, { themeVars: {
      buttonPrimaryColor: '#5500aa', buttonMainColor: '#fedcba', buttonSuccessColor: '#228844'
    } }, () => h(Button, props.value)) } as any)
    const loading = () => (container.querySelector('.wd-loading') as HTMLElement).style.color
    expect(loading()).toBe(cssColor('#fedcba'))
    props.value.variant = 'plain'; await nextTick()
    expect(loading()).toBe(cssColor('#5500aa'))
    props.value.type = 'success'; await nextTick()
    expect(loading()).toBe(cssColor('#228844'))
    props.value.loadingColor = '#0000ff'; props.value.loadingProps = { color: '#ff0000', size: 26 }; await nextTick()
    expect(loading()).toBe(cssColor('#ff0000'))
    expect((container.querySelector('.wd-button__loading') as HTMLElement).style.width).toBe('26px')
  })

  it.each(['disabled', 'loading'])('%s keeps native tap from dispatching Button actions', (state) => {
    const click = vi.fn(), tap = vi.fn()
    const { container } = render(Button, { [state]: true, round: true, icon: 'edit', onClick: click, onTap: tap })
    fireEvent.tap(container.querySelector('.wd-button')!)
    expect(click).not.toHaveBeenCalled()
    expect(tap).not.toHaveBeenCalled()
  })
})

describe('Fab device anchor and Button composition', () => {
  it('has a positioned, centered, nonshrinking native trigger anchor with source-order-independent 60px geometry', () => {
    nativeFlex('.wd-fab__anchor', 'row', fabCss)
    expect(rule('.wd-fab__anchor', fabCss)['z-index']).toBe('0')
    expect(rule('.wd-fab', fabCss).position).toBe('fixed')
    const trigger = rule('.wd-fab .wd-fab__trigger.wd-button.is-round', fabCss)
    expect(trigger.width).toContain('--wot-fab-trigger-width')
    expect(trigger.height).toContain('--wot-fab-trigger-height')
    expect(trigger.width).toContain('60px'); expect(trigger.height).toContain('60px')
    expect(trigger.padding).toBe('0'); expect(trigger['flex-shrink']).toBe('0')
    for (const [size] of sizes) {
      expect(rule('.wd-fab .wd-fab__trigger', fabCss)[`--wot-button-size-icon-${size}`]).toContain('--wot-fab-trigger-icon-size')
    }
    // Four class selectors beat Button's three, even when Button CSS loads last.
    expect('.wd-fab .wd-fab__trigger.wd-button.is-round'.match(/\./g)!.length).toBeGreaterThan('.wd-button.is-medium.is-icon'.match(/\./g)!.length)
  })

  it('starts away from (0,0) without unsupported visibility and keeps showcase labels in action buttons', async () => {
    const { container } = render({ setup: () => () => h(Fab, { active: true }, { default: () => [
      h(Button, { size: 'small' }, () => '菜单一'), h(Button, { size: 'small', type: 'warning' }, () => '编辑')
    ] }) } as any)
    const root = container.querySelector('.wd-fab') as HTMLElement
    expect(root.style.left).toBe('314px'); expect(root.style.top).toBe('768px')
    expect((container.querySelector('.wd-fab__anchor') as HTMLElement).style.visibility).toBe('')
    await pause(40)
    const labels = Array.from(container.querySelectorAll('.wd-fab__actions .wd-button__text-content'))
    expect(labels.map((label) => label.textContent)).toEqual(['菜单一', '编辑'])
    for (const label of labels) {
      expect(label.tagName.toLowerCase()).toBe('text')
      expect(label.closest('.wd-button')).not.toBeNull()
      expect(label.getAttribute('text-maxline')).toBe('1')
    }
    expect(container.querySelectorAll('.wd-fab__trigger')).toHaveLength(1)
  })

  it('does not create collapsed actions and destroys their text only after the 300ms leave', async () => {
    const { container } = render({ setup: () => () => h(Fab, null, { default: () => h(Button, { size: 'small' }, () => '菜单文字') }) } as any)
    const trigger = container.querySelector('.wd-fab__trigger')!
    expect(container.querySelector('.wd-fab__actions')).toBeNull()
    expect(container.querySelector('.wd-button__text-content')).toBeNull()
    fireEvent.tap(trigger); await pause(50)
    const actions = container.querySelector('.wd-fab__actions') as HTMLElement
    expect(actions.querySelector('.wd-button__text-content')!.textContent).toBe('菜单文字')
    expect(actions.style.transitionDuration).toBe('300ms')
    fireEvent.tap(trigger); await nextTick()
    expect(container.querySelector('.wd-fab__actions'), 'leave must not synchronously remove the animated action view').not.toBeNull()
    await pause(100)
    expect(container.querySelector('.wd-fab__actions .wd-button__text-content')).not.toBeNull()
    await pause(300)
    expect(container.querySelector('.wd-fab__actions')).toBeNull()
    expect(container.querySelector('.wd-button__text-content')).toBeNull()
    expect(container.querySelector('.wd-fab__trigger')).toBe(trigger)
    fireEvent.tap(trigger); await pause(40)
    expect(container.querySelectorAll('.wd-fab__actions .wd-button__text-content')).toHaveLength(1)
  })

  it('default native tap still expands/collapses and custom trigger scope stays unchanged', async () => {
    const updates: boolean[] = []
    const { container } = render(Fab, { 'onUpdate:active': (active: boolean) => updates.push(active) })
    const button = container.querySelector('.wd-fab__trigger')!
    fireEvent.tap(button); await nextTick(); fireEvent.tap(button); await nextTick()
    expect(updates).toEqual([true, false])
    const scoped = render({ setup: () => () => h(Fab, { disabled: true }, { trigger: ({ disabled }: any) => h('view', { class: 'custom-trigger' }, [h('text', null, String(disabled))]) }) } as any)
    expect(scoped.container.querySelector('.custom-trigger')!.textContent).toBe('true')
    expect(scoped.container.querySelector('.wd-fab__trigger')).toBeNull()
  })
})
