/**
 * Button shape contract (official wot-ui semantics, device feedback 2026-11-08):
 *
 * - 默认是「方圆角」（--wot-button-radius-main），不是胶囊；
 * - 只有显式 `round` 或全局 `button.round` 才是胶囊 / 图标按钮的正圆；
 * - 图标按钮的正圆由 `is-icon`（宽高同值）+ `is-round` 共同决定，正方形不受影响；
 * - Dialog 的 text 操作按钮保持直角（结构性圆角，优先级高于胶囊规则）。
 *
 * SCSS 在内存里编译，断言落在源码而不是可能过期的生成 CSS 上。
 * 这些检查证明类名/级联/几何契约，不替代真机像素验收。
 */
import { afterEach, describe, expect, it } from 'vitest'
import { computed, defineComponent, h, nextTick, provide, ref } from 'vue-lynx'
import postcss from 'postcss'
import path from 'node:path'
import Button from '@wot-lynx/primitives/wd-button'
import { buttonProps } from '@wot-lynx/primitives/wd-button/types'
import ConfigProvider from '../../src/components/wd-config-provider/wd-config-provider.vue'
import {
  CONFIG_PROVIDER_KEY, DEFAULT_GLOBAL_CONFIG, mergeConfig,
  type ButtonConfig, type GlobalConfig
} from '@wot-lynx/core/composables/global-config'
import { useConfigProvider } from '@wot-lynx/core/composables/useConfigProvider'
import { useGlobalConfig } from '@wot-lynx/core/composables/useGlobalConfig'
import { cleanup, render } from '../render'
import { compileScss } from '../helpers/scss'
import { compPath } from '../helpers/component-roots'

const buttonCss = postcss.parse(compileScss(compPath('wd-button', 'index.scss')))
const dialogCss = postcss.parse(compileScss(compPath('wd-dialog', 'index.scss')))
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

describe('Button shape resolution (square by default)', () => {
  it('keeps the prop unset for inheritance while the shared global default is false', () => {
    expect(buttonProps.round.default).toBeUndefined()
    expect(DEFAULT_GLOBAL_CONFIG.button.round).toBe(false)
    expect(mergeConfig(null, {}).button.round).toBe(false)
    expect(mergeConfig(null, { button: { size: 'small', round: undefined } }).button.round).toBe(false)
  })

  it.each(['mini', 'small', 'medium', 'large'] as const)('%s defaults every variant to the official squared radius', (size) => {
    const { container } = render(defineComponent({
      setup: () => () => h('view', null, variants.map((variant) => h(Button, { size, variant, text: variant })))
    }))
    const buttons = [...container.querySelectorAll('.wd-button')]
    expect(buttons).toHaveLength(variants.length)
    expect(buttons.every((button) => !button.classList.contains('is-round'))).toBe(true)
    expect(buttons.every((button) => button.classList.contains(`is-${size}`))).toBe(true)
  })

  it('explicit round switches to the pill and removing it restores the squared default', async () => {
    const local = ref<{ round?: boolean }>({})
    const { container } = render(defineComponent({
      setup: () => () => h(Button, { text: 'button', ...local.value })
    }))
    expect(isRound(container)).toBe(false)
    local.value = { round: true }; await nextTick()
    expect(isRound(container)).toBe(true)
    local.value = { round: false }; await nextTick()
    expect(isRound(container)).toBe(false)
    local.value = {}; await nextTick()
    expect(isRound(container)).toBe(false)
    local.value = { round: undefined }; await nextTick()
    expect(isRound(container)).toBe(false)
  })

  it('inherits a global round=true, and local values still win', async () => {
    const config = ref<ButtonConfig>({ round: true })
    const local = ref<{ round?: boolean }>({})
    const { container } = render(defineComponent({
      setup: () => () => h(ConfigProvider, { button: config.value }, () => h(Button, { text: 'override', ...local.value }))
    }))
    expect(isRound(container)).toBe(true)
    local.value = { round: false }; await nextTick()
    expect(isRound(container)).toBe(false)
    local.value = {}; await nextTick()
    expect(isRound(container)).toBe(true)
    config.value = { round: false }; await nextTick()
    expect(isRound(container)).toBe(false)
    config.value = { round: undefined }; await nextTick()
    expect(isRound(container)).toBe(false)
  })

  it('nested Providers inherit false through empty/undefined buckets and can explicitly opt back in', async () => {
    const inner = ref<ButtonConfig>({})
    const { container } = render(defineComponent({
      setup: () => () => h(ConfigProvider, { button: { round: true } }, () =>
        h(ConfigProvider, { button: inner.value }, () => h(Button, { text: 'nested' })))
    }))
    expect(isRound(container)).toBe(true)
    inner.value = { round: false }; await nextTick()
    expect(isRound(container)).toBe(false)
    inner.value = {}; await nextTick()
    expect(isRound(container)).toBe(true)
  })

  it('useConfigProvider shares the squared default and preserves reactive global opt-in', async () => {
    const config = ref<ButtonConfig>({})
    const { container } = render(defineComponent({
      setup() {
        useConfigProvider({ button: config })
        return () => h(Button, { text: 'hook' })
      }
    }))
    expect(isRound(container)).toBe(false)
    config.value = { round: true }; await nextTick()
    expect(isRound(container)).toBe(true)
    config.value = {}; await nextTick()
    expect(isRound(container)).toBe(false)
  })

  it('Hook defaults stay reactive and the public default remains false', async () => {
    const hookButton = ref<ButtonConfig>({})
    const Probe = defineComponent({
      setup() {
        const globalConfig = useGlobalConfig()
        return () => h('view', null, [
          h('text', { class: 'hook-round-value' }, String(globalConfig.value.button.round)),
          h(Button, { text: 'hook' })
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
    expect(publicRound()).toBe('false')
    expect(isRound(container)).toBe(false)
    hookButton.value = { round: true }; await nextTick()
    expect(publicRound()).toBe('true')
    expect(isRound(container)).toBe(true)
    hookButton.value = { round: undefined }; await nextTick()
    expect(publicRound()).toBe('false')
    expect(isRound(container)).toBe(false)
  })

  it('merging global opt-ins does not mutate defaults or erase true with undefined', () => {
    const input = { round: true }
    const parent = mergeConfig(null, { button: input })
    const child = mergeConfig(parent, { button: { size: 'small', round: undefined } })
    expect(parent.button.round).toBe(true)
    expect(child.button).toEqual({ round: true, size: 'small' })
    expect(mergeConfig(parent, { button: { round: false } }).button.round).toBe(false)
    expect(input).toEqual({ round: true })
    expect(DEFAULT_GLOBAL_CONFIG.button.round).toBe(false)
  })
})

describe('Button shape styles preserve rectangles, pills and circles', () => {
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

  it.each(['mini', 'small', 'medium', 'large'] as const)('%s keeps squares square and only round icons become circles', (size) => {
    const { container } = render(defineComponent({
      setup: () => () => h('view', null, [
        h(Button, { size, icon: 'edit' }),
        h(Button, { size, icon: 'edit', round: true }),
        h(Button, { size, text: 'square' }),
        h(Button, { size, text: 'pill', round: true }),
        h(Button, { size, text: 'block', block: true })
      ])
    }))
    const [iconSquare, iconCircle, label, pill, block] = [...container.querySelectorAll('.wd-button')]
    // 正方形：图标按钮默认也是方角，宽高仍相等（不是圆）
    expect(iconSquare.classList.contains('is-icon')).toBe(true)
    expect(iconSquare.classList.contains('is-round')).toBe(false)
    // 圆形：显式 round 的图标按钮才是正圆，且无文字内边距
    expect(iconCircle.classList.contains('is-icon')).toBe(true)
    expect(iconCircle.classList.contains('is-round')).toBe(true)
    expect(rule(`.wd-button.is-${size}.is-icon`).width).toBe(rule(`.wd-button.is-${size}`).height)
    expect(rule('.wd-button.is-icon.is-round').padding).toBe('0')
    // 椭圆：文字按钮只有 round 才是胶囊
    expect(label.classList.contains('is-round')).toBe(false)
    expect(pill.classList.contains('is-round')).toBe(true)
    // 方块：block 只改宽度，不改形状
    expect(block.classList.contains('is-block')).toBe(true)
    expect(block.classList.contains('is-round')).toBe(false)
    expect(rule('.wd-button.is-block').width).toBe('100%')
  })
})
