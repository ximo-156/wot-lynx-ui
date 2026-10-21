/**
 * WdConfigProvider / useConfigProvider / WdRootPortal 行为回归。
 *
 * 锁定的对齐点（wot-ui 2.3.2）：
 * - useConfigProvider() 通过独立键 __CONFIG_PROVIDER__ 提供 themeStyle + globalConfig，
 *   子组件（含 WdRootPortal）读到 Hook 主题变量，而不是只有 ConfigProvider 组件生效；
 * - Hook 的 theme / themeVars 以 MaybeRef 形式暴露，运行期可改；
 * - 嵌套 ConfigProvider：内层未显式传 theme 时继承 Hook 主题，显式传则覆盖；
 * - 变量与 customStyle 撤回后必须逐键清除（Lynx SetStyle 合并语义）；
 * - data-theme 在 vue-lynx 0.5.1 上会抛 `Cannot use __SetAttribute for data-theme`，
 *   主题由 wot-theme-* 类承担（已记录的平台差异）。
 */
import { describe, it, expect } from 'vitest'
import { h, ref, defineComponent } from 'vue-lynx'
import { render, cleanup } from './render'
import { pause } from '../src/common/util'
import ConfigProvider from '../src/components/wd-config-provider/wd-config-provider.vue'
import RootPortal from '../src/components/wd-root-portal/wd-root-portal.vue'
import Button from '../src/components/wd-button/wd-button.vue'
import { useConfigProvider, USE_CONFIG_PROVIDER_KEY } from '../src/composables/useConfigProvider'
import { CONFIG_PROVIDER_KEY } from '../src/composables/global-config'

const styleOf = (el: Element | null): string => (el ? el.getAttribute('style') || '' : '')

/** 极简 CSS 变量读取（jsdom 不解析 CSS 变量，按字符串断言） */
function cssVar(el: Element | null, name: string): string | undefined {
  const style = styleOf(el)
  const match = new RegExp(`(?:^|;)\\s*${name}\\s*:\\s*([^;]+)`).exec(style)
  return match ? match[1].trim() : undefined
}

function mountWithHook(hookOptions: () => Record<string, any>, child?: () => any) {
  const Host = defineComponent({
    setup() {
      useConfigProvider(hookOptions())
      return () => h('view', { class: 'host' }, [child ? child() : null])
    }
  })
  return render(Host)
}

describe('useConfigProvider：官方 Hook 契约', () => {
  it('独立注入键 __CONFIG_PROVIDER__ 与组件树键 CONFIG_PROVIDER_KEY 不混用', () => {
    expect(USE_CONFIG_PROVIDER_KEY).toBe('__CONFIG_PROVIDER__')
    expect(CONFIG_PROVIDER_KEY).not.toBe(USE_CONFIG_PROVIDER_KEY)
  })

  it('Hook 提供 themeStyle 与 globalConfig 给后代组件', async () => {
    const { container } = mountWithHook(
      () => ({ theme: 'dark', themeVars: { primaryColor: '#123456' } }),
      () => h(RootPortal, {}, () => 'x')
    )
    await pause(0)
    const root = container.querySelector('wd-root-portal, .wd-root-portal')
    expect(root).not.toBeNull()
    expect(root!.className).toContain('wot-theme-dark')
    expect(cssVar(root, '--wot-primary-color')).toBe('#123456')
    cleanup()
  })

  it('Hook 选项可以是 ref：运行期修改即时反映', async () => {
    const theme = ref('light')
    const vars = ref<Record<string, string>>({ primaryColor: '#111111' })
    const { container } = mountWithHook(
      () => ({ theme, themeVars: vars }),
      () => h(RootPortal, { class: 'portal' }, () => 'x')
    )
    await pause(0)
    let root = container.querySelector('.wd-root-portal')!
    expect(root.className).toContain('wot-theme-light')
    expect(cssVar(root, '--wot-primary-color')).toBe('#111111')

    vars.value = { primaryColor: '#222222' }
    theme.value = 'dark'
    await pause(0)
    await pause(0)
    root = container.querySelector('.wd-root-portal')!
    expect(root.className).toContain('wot-theme-dark')
    expect(cssVar(root, '--wot-primary-color')).toBe('#222222')
    cleanup()
  })
})

describe('WdConfigProvider：主题继承与覆盖', () => {
  it('无 Hook 时按 props 下发主题类与 CSS 变量', async () => {
    const { container } = render(ConfigProvider, {
      theme: 'dark',
      themeVars: { primaryColor: '#755FFE', textColor: '#2D273D' }
    })
    await pause(0)
    const root = container.querySelector('.wd-config-provider')!
    expect(root.className).toContain('wot-theme-dark')
    expect(cssVar(root, '--wot-primary-color')).toBe('#755FFE')
    expect(cssVar(root, '--wot-text-color')).toBe('#2D273D')
    cleanup()
  })

  it('内层未显式传 theme 时继承 Hook 主题（官方缺口修正）', async () => {
    const { container } = mountWithHook(
      () => ({ theme: 'dark', themeVars: { secondaryColor: '#9A89FF' } }),
      () => h(ConfigProvider, { themeVars: { primaryColor: '#445566' } }, () => h(Button, {}, () => 'btn'))
    )
    await pause(0)
    const root = container.querySelector('.wd-config-provider')!
    expect(root.className).toContain('wot-theme-dark')
    // 内层变量覆盖外层同名项，并叠加 Hook 变量
    expect(cssVar(root, '--wot-primary-color')).toBe('#445566')
    expect(cssVar(root, '--wot-secondary-color')).toBe('#9A89FF')
    cleanup()
  })

  it('显式 theme prop 覆盖 Hook 主题', async () => {
    const { container } = mountWithHook(
      () => ({ theme: 'dark' }),
      () => h(ConfigProvider, { theme: 'light' })
    )
    await pause(0)
    expect(container.querySelector('.wd-config-provider')!.className).toContain('wot-theme-light')
    cleanup()
  })

  it('themeVars / customStyle 撤回后逐键清除（Lynx 合并语义）', async () => {
    const vars = ref<Record<string, string>>({ primaryColor: '#aa0000', textColor: '#00aa00' })
    const custom = ref<Record<string, string>>({ fontSize: '20px', color: '#000' })
    const Host = defineComponent({
      setup: () => () => h(ConfigProvider, { themeVars: vars.value, customStyle: custom.value }, () => h('view'))
    })
    const { container } = render(Host)
    await pause(0)
    let root = container.querySelector('.wd-config-provider')!
    expect(cssVar(root, '--wot-primary-color')).toBe('#aa0000')

    vars.value = {}
    custom.value = {}
    await pause(0)
    await pause(0)
    root = container.querySelector('.wd-config-provider')!
    // 变量撤回后保留空声明（覆盖继承值），而不是让旧值残留
    expect(cssVar(root, '--wot-primary-color') ?? '').toBe('')
    expect(cssVar(root, '--wot-text-color') ?? '').toBe('')
    // 普通 customStyle 键必须真正消失
    expect(styleOf(root)).not.toContain('font-size')
    cleanup()
  })

  it('不使用 data-theme 属性（vue-lynx SET_PROP 不支持 dataset）', async () => {
    const { container } = render(ConfigProvider, { theme: 'dark' })
    await pause(0)
    const root = container.querySelector('.wd-config-provider')!
    expect(root.hasAttribute('data-theme')).toBe(false)
    cleanup()
  })
})

describe('WdRootPortal：镜像主题变量', () => {
  it('多个 Provider / Portal 独立下发变量，保留普通样式并清除撤回变量', async () => {
    const vars = ref<Record<string, string>>({ primary6: '#123456' })
    const Host = defineComponent({
      setup: () => () => h('view', {}, [
        h(ConfigProvider, { themeVars: vars.value, customStyle: { padding: '12px' } }, () => h(RootPortal, { customStyle: { margin: '3px' } })),
        h(ConfigProvider, { themeVars: { primary6: '#abcdef' }, customStyle: { padding: '8px' } }, () => h(RootPortal))
      ])
    })
    const { container } = render(Host)
    await pause(0)
    const providers = [...container.querySelectorAll('.wd-config-provider')] as HTMLElement[]
    const portals = [...container.querySelectorAll('.wd-root-portal')] as HTMLElement[]
    expect(providers.map(el => el.style.getPropertyValue('--wot-primary-6'))).toEqual(['#123456', '#abcdef'])
    expect(portals.map(el => el.style.getPropertyValue('--wot-primary-6'))).toEqual(['#123456', '#abcdef'])
    expect(providers[0].style.padding).toBe('12px')
    expect(portals[0].style.margin).toBe('3px')
    vars.value = {}
    await pause(0)
    await pause(0)
    expect(providers[0].style.getPropertyValue('--wot-primary-6')).toBe('')
    expect(portals[0].style.getPropertyValue('--wot-primary-6')).toBe('')
    expect(providers[1].style.getPropertyValue('--wot-primary-6')).toBe('#abcdef')
    expect(portals[1].style.getPropertyValue('--wot-primary-6')).toBe('#abcdef')
    expect(providers[0].style.padding).toBe('12px')
    cleanup()
  })
  it('嵌套在 ConfigProvider 内时继承主题类与变量', async () => {
    const { container } = render(ConfigProvider, {
      theme: 'dark',
      themeVars: { primaryColor: '#abcdef' }
    })
    // 上面 render 只挂载了 Provider；改用组合宿主验证继承
    cleanup()

    const Host = defineComponent({
      setup: () => () => h(ConfigProvider, { theme: 'dark', themeVars: { primaryColor: '#abcdef' } }, () => h(RootPortal, { class: 'inner-portal' }))
    })
    const mounted = render(Host)
    await pause(0)
    const portal = mounted.container.querySelector('.wd-root-portal')!
    expect(portal.className).toContain('wot-theme-dark')
    expect(cssVar(portal, '--wot-primary-color')).toBe('#abcdef')
    cleanup()
  })
})
