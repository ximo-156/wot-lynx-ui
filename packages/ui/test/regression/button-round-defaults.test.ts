/**
 * Button pill defaults and opt-outs. SCSS is compiled in memory so assertions
 * check the source rather than potentially stale generated CSS. These checks
 * prove classes/cascade and native geometry contracts, not Android/iOS pixels.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { computed, defineComponent, h, nextTick, provide, ref } from 'vue-lynx'
import { compile } from 'sass'
import postcss from 'postcss'
import path from 'node:path'
import Button from '../../src/primitives/wd-button/wd-button.vue'
import { buttonProps } from '../../src/primitives/wd-button/types'
import ConfigProvider from '../../src/components/wd-config-provider/wd-config-provider.vue'
import {
  CONFIG_PROVIDER_KEY, DEFAULT_GLOBAL_CONFIG, mergeConfig,
  type ButtonConfig, type GlobalConfig
} from '../../src/composables/global-config'
import { useConfigProvider } from '../../src/composables/useConfigProvider'
import { useGlobalConfig } from '../../src/composables/useGlobalConfig'
import { cleanup, render } from '../render'

const buttonCss = postcss.parse(compile(path.resolve(__dirname, '../../src/primitives/wd-button/index.scss')).css)
const dialogCss = postcss.parse(compile(path.resolve(__dirname, '../../src/components/wd-dialog/index.scss')).css)
function rule(selector: string, css = buttonCss): Record<string, string> {
  const declarations: Record<string, string> = {}
  css.walkRules((candidate) => {
    if (!candidate.selectors.includes(selector)) return
    candidate.walkDecls((decl) => { declarations[decl.prop] = decl.value })
  })
  expect(Object.keys(declarations).length, `missing source SCSS selector ${selector}`).toBeGreaterThan(0)
  return declarations
}
function isRound(container: Element): boolean {
  return container.querySelector('.wd-button')!.classList.contains('is-round')
}
afterEach(cleanup)

const variants = ['base', 'plain', 'dashed', 'soft', 'subtle', 'text'] as const

describe('Button default round resolution', () => {
  it('keeps the prop unset for inheritance while the shared global default is true', () => {
    expect(buttonProps.round.default).toBeUndefined()
    expect(DEFAULT_GLOBAL_CONFIG.button.round).toBe(true)
    expect(mergeConfig(null, {}).button.round).toBe(true)
    expect(mergeConfig(null, { button: { size: 'small', round: undefined } }).button.round).toBe(true)
  })

  it.each(['mini', 'small', 'medium', 'large'] as const)('%s defaults every variant to a pill without a ConfigProvider', (size) => {
    const { container } = render(defineComponent({
      setup: () => () => h('view', null, variants.map((variant) => h(Button, { size, variant, text: variant })))
    }))
    const buttons = [...container.querySelectorAll('.wd-button')]
    expect(buttons).toHaveLength(variants.length)
    expect(buttons.every((button) => button.classList.contains('is-round'))).toBe(true)
  })

  it('supports explicit false and restores the standalone default when the prop is removed', async () => {
    const local = ref<{ round?: boolean }>({})
    const { container } = render(defineComponent({
      setup: () => () => h(Button, { text: 'button', ...local.value })
    }))
    expect(isRound(container)).toBe(true)
    local.value = { round: false }; await nextTick()
    expect(isRound(container)).toBe(false)
    local.value = { round: true }; await nextTick()
    expect(isRound(container)).toBe(true)
    local.value = { round: false }; await nextTick()
    local.value = {}; await nextTick()
    expect(isRound(container)).toBe(true)
    local.value = { round: undefined }; await nextTick()
    expect(isRound(container)).toBe(true)
  })

  it('also falls back to true when an injected config has no button.round value', async () => {
    // Do not use DEFAULT_GLOBAL_CONFIG here: a true shared default must not hide
    // a stale false fallback in Button's own effectiveRound calculation.
    const bucket = ref<ButtonConfig>({})
    const { container } = render(defineComponent({
      setup() {
        provide(CONFIG_PROVIDER_KEY, {
          globalConfig: computed<GlobalConfig>(() => ({ theme: 'light', themeVars: {}, button: bucket.value, tag: {} })),
          themeStyle: computed(() => ({}))
        })
        return () => h(Button, { text: 'injected' })
      }
    }))
    expect(isRound(container)).toBe(true)
    bucket.value = { round: false }; await nextTick()
    expect(isRound(container)).toBe(false)
    bucket.value = { round: undefined }; await nextTick()
    expect(isRound(container)).toBe(true)
  })

  it('an empty Provider or unrelated button options retain the shared round default', async () => {
    const config = ref<ButtonConfig>({})
    const { container } = render(defineComponent({
      setup: () => () => h(ConfigProvider, { button: config.value }, () => h(Button, { text: 'provider' }))
    }))
    expect(isRound(container)).toBe(true)
    config.value = { size: 'small', variant: 'plain' }; await nextTick()
    expect(isRound(container)).toBe(true)
    expect(container.querySelector('.wd-button')!.classList.contains('is-small')).toBe(true)
  })

  it('global false remains reactive, local true/false win, and removing overrides restores inheritance', async () => {
    const config = ref<ButtonConfig>({ round: false })
    const local = ref<{ round?: boolean }>({})
    const { container } = render(defineComponent({
      setup: () => () => h(ConfigProvider, { button: config.value }, () => h(Button, { text: 'override', ...local.value }))
    }))
    expect(isRound(container)).toBe(false)
    local.value = { round: true }; await nextTick()
    expect(isRound(container)).toBe(true)
    local.value = {}; await nextTick()
    expect(isRound(container)).toBe(false)
    local.value = { round: false }; config.value = { round: true }; await nextTick()
    expect(isRound(container)).toBe(false)
    local.value = {}; await nextTick()
    expect(isRound(container)).toBe(true)
    config.value = { round: false }; await nextTick()
    expect(isRound(container)).toBe(false)
    config.value = { round: undefined }; await nextTick()
    expect(isRound(container)).toBe(true)
  })

  it('nested Providers inherit false through empty/undefined buckets and can explicitly opt back in', async () => {
    const inner = ref<ButtonConfig>({})
    const { container } = render(defineComponent({
      setup: () => () => h(ConfigProvider, { button: { round: false } }, () =>
        h(ConfigProvider, { button: inner.value }, () => h(Button, { text: 'nested' })))
    }))
    expect(isRound(container)).toBe(false)
    inner.value = { size: 'small', round: undefined }; await nextTick()
    expect(isRound(container)).toBe(false)
    inner.value = { round: true }; await nextTick()
    expect(isRound(container)).toBe(true)
    inner.value = {}; await nextTick()
    expect(isRound(container)).toBe(false)
  })

  it('useConfigProvider shares the pill default and preserves reactive global opt-out', async () => {
    const config = ref<ButtonConfig>({})
    const { container } = render(defineComponent({
      setup() {
        useConfigProvider({ button: config })
        return () => h(Button, { text: 'hook' })
      }
    }))
    expect(isRound(container)).toBe(true)
    config.value = { round: false }; await nextTick()
    expect(isRound(container)).toBe(false)
    config.value = {}; await nextTick()
    expect(isRound(container)).toBe(true)
  })

  it('Hook defaults do not override inherited false, while explicit Hook values and public defaults remain available', async () => {
    const hookButton = ref<ButtonConfig>({})
    const Probe = defineComponent({
      setup() {
        const globalConfig = useGlobalConfig()
        return () => h('view', null, [
          h('text', { class: 'hook-round-value' }, String(globalConfig.value.button.round)),
          h(ConfigProvider, { button: { round: false } }, () =>
            h(ConfigProvider, {}, () => h(Button, { text: 'nested under hook' })))
        ])
      }
    })
    const { container } = render(defineComponent({
      setup() {
        useConfigProvider({ theme: 'dark', button: hookButton })
        return () => h(Probe)
      }
    }))
    const publicRound = () => container.querySelector('.hook-round-value')!.textContent
    expect(publicRound()).toBe('true')
    expect(isRound(container)).toBe(false)
    expect([...container.querySelectorAll('.wd-config-provider')].every((provider) => provider.classList.contains('wot-theme-dark'))).toBe(true)
    hookButton.value = { round: true }; await nextTick()
    expect(isRound(container)).toBe(true)
    hookButton.value = { round: undefined }; await nextTick()
    expect(publicRound()).toBe('true')
    expect(isRound(container)).toBe(false)
    hookButton.value = { round: false }; await nextTick()
    expect(publicRound()).toBe('false')
    expect(isRound(container)).toBe(false)
    hookButton.value = {}; await nextTick()
    expect(publicRound()).toBe('true')
    expect(isRound(container)).toBe(false)
  })

  it('merging global opt-outs does not mutate defaults or erase false with undefined', () => {
    const input = { round: false }
    const parent = mergeConfig(null, { button: input })
    const child = mergeConfig(parent, { button: { size: 'small', round: undefined } })
    expect(parent.button.round).toBe(false)
    expect(child.button).toEqual({ round: false, size: 'small' })
    expect(mergeConfig(parent, { button: { round: true } }).button.round).toBe(true)
    expect(input).toEqual({ round: false })
    expect(DEFAULT_GLOBAL_CONFIG.button.round).toBe(true)
  })
})

describe('Button pill styles preserve opt-out and structural compositions', () => {
  it('keeps ordinary radius tokens independent from the full radius used by is-round', () => {
    const ordinary = rule('.wd-button')['border-radius']
    expect(ordinary).toContain('--wot-button-radius-main')
    expect(ordinary).toContain('--wot-radius-main')
    expect(ordinary).toContain('--wot-n-4, 4px')
    expect(ordinary).not.toContain('full')
    const round = rule('.wd-button.is-round')['border-radius']
    expect(round).toContain('--wot-button-radius-full')
    expect(round).toContain('--wot-radius-full')
    expect(rule('.wd-button__border')['border-radius']).toBe('inherit')
  })

  it('all variants leave structured Dialog text action corners more specific than the pill rule', () => {
    const roundSelectors: string[] = []
    buttonCss.walkRules((candidate) => {
      candidate.walkDecls('border-radius', (decl) => {
        if (decl.value.includes('--wot-button-radius-full')) roundSelectors.push(...candidate.selectors)
      })
    })
    // No redundant .is-<variant>.is-round selectors: they would tie Dialog's
    // square text-action rule and make button CSS loaded last break its edges.
    expect(roundSelectors).toEqual(['.wd-button.is-round'])
    const textAction = '.wd-dialog__actions.is-text .wd-dialog__actions-btn'
    expect(rule(textAction, dialogCss)['border-radius']).toBe('0')
    const classCount = (selector: string) => (selector.match(/\./g) || []).length
    expect(roundSelectors.every((selector) => classCount(selector) < classCount(textAction))).toBe(true)
  })

  it.each(['mini', 'small', 'medium', 'large'] as const)('%s icon-only defaults remain circles without changing label/block geometry', (size) => {
    const { container } = render(defineComponent({
      setup: () => () => h('view', null, [
        h(Button, { size, icon: 'edit' }),
        h(Button, { size, text: 'pill' }),
        h(Button, { size, text: 'block', block: true })
      ])
    }))
    const [icon, label, block] = [...container.querySelectorAll('.wd-button')]
    expect(icon.classList.contains('is-icon')).toBe(true)
    expect([icon, label, block].every((button) => button.classList.contains('is-round'))).toBe(true)
    expect(label.classList.contains('is-icon')).toBe(false)
    expect(block.classList.contains('is-block')).toBe(true)
    expect(rule(`.wd-button.is-${size}.is-icon`).width).toBe(rule(`.wd-button.is-${size}`).height)
    expect(rule('.wd-button.is-icon.is-round').padding).toBe('0')
    expect(rule('.wd-button.is-block').width).toBe('100%')
  })
})
