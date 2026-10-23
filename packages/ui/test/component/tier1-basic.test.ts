/**
 * Tier 1 基础组件冒烟测试。
 *
 * 验证重写后的 12 个基础组件能在双线程测试环境完整挂载渲染，
 * 并对关键交互（button click / transition 显隐）做行为断言。
 * 后续每个 tier 的各组件测试参照本文件的范式编写。
 */
import { describe, it, expect } from 'vitest'
import { h } from 'vue-lynx'
import { render, cleanup } from '../render'
import { fireEvent } from '../fire-event'
import Button from '../../src/primitives/wd-button/wd-button.vue'
import Cell from '../../src/primitives/wd-cell/wd-cell.vue'
import CellGroup from '../../src/components/wd-cell-group/wd-cell-group.vue'
import ConfigProvider from '../../src/components/wd-config-provider/wd-config-provider.vue'
import Divider from '../../src/components/wd-divider/wd-divider.vue'
import Gap from '../../src/components/wd-gap/wd-gap.vue'
import Icon from '../../src/primitives/wd-icon/wd-icon.vue'
import Loading from '../../src/primitives/wd-loading/wd-loading.vue'
import Overlay from '../../src/primitives/wd-overlay/wd-overlay.vue'
import RootPortal from '../../src/primitives/wd-root-portal/wd-root-portal.vue'
import Text from '../../src/components/wd-text/wd-text.vue'
import Transition from '../../src/primitives/wd-transition/wd-transition.vue'
import { registerIconSet } from '../../src/icons/registry'

describe('Tier 1 基础组件', () => {
  describe('渲染冒烟', () => {
    it('WdButton 默认渲染', () => {
      const { container } = render(Button, { text: '按钮' })
      expect(container.querySelector('.wd-button')).not.toBeNull()
      cleanup()
    })

    it('WdButton 各 type × size × variant 组合渲染', () => {
      for (const type of ['primary', 'success', 'info', 'warning', 'danger']) {
        for (const size of ['mini', 'small', 'medium', 'large']) {
          for (const variant of ['base', 'plain', 'dashed', 'soft', 'subtle', 'text']) {
            const { container } = render(Button, { type, size, variant, text: 'x' })
            const el = container.querySelector('.wd-button')
            expect(el, `${type}/${size}/${variant}`).not.toBeNull()
            expect(el!.classList.contains(`is-${type}`)).toBe(true)
            expect(el!.classList.contains(`is-${size}`)).toBe(true)
            if (variant !== 'base') {
              expect(el!.classList.contains(`is-${variant}`)).toBe(true)
            }
            cleanup()
          }
        }
      }
    })

    it('WdButton 禁用与加载态', () => {
      const { container } = render(Button, { disabled: true, text: '禁用' })
      expect(container.querySelector('.wd-button')!.classList.contains('is-disabled')).toBe(true)
      cleanup()

      const r2 = render(Button, { loading: true, text: '加载' })
      expect(r2.container.querySelector('.wd-button')!.classList.contains('is-loading')).toBe(true)
      expect(r2.container.querySelector('.wd-loading')).not.toBeNull()
      cleanup()
    })

    it('WdCell / WdCellGroup 渲染与分组配置下发', () => {
      const { container } = render(CellGroup, { border: true, title: '分组' }, [
        {
          install(app: any) {
            app.component('WdCell', Cell)
          }
        } as any
      ])
      expect(container.querySelector('.wd-cell-group')).not.toBeNull()
      expect(container.querySelector('.wd-cell-group__title')).not.toBeNull()
      cleanup()
    })

    it('WdConfigProvider 默认挂亮色主题类', () => {
      const { container } = render(ConfigProvider)
      expect(container.querySelector('.wot-theme-light')).not.toBeNull()
      cleanup()

      const dark = render(ConfigProvider, { theme: 'dark' })
      expect(dark.container.querySelector('.wot-theme-dark')).not.toBeNull()
      cleanup()
    })

    it('WdDivider / WdGap / WdText / WdIcon / WdLoading / WdOverlay / WdRootPortal / WdTransition 渲染', () => {
      const cases: Array<[any, Record<string, any>, string]> = [
        [Divider, {}, '.wd-divider'],
        [Divider, { vertical: true }, '.wd-divider--vertical'],
        [Gap, { height: 20 }, '.wd-gap'],
        [Text, { text: '文本', type: 'primary' }, '.wd-text'],
        [Icon, { name: 'close' }, '.wd-icon'],
        [Loading, { type: 'circular' }, '.wd-loading'],
        [Loading, { type: 'spinner' }, '.wd-loading__spinner--spinner'],
        [Overlay, { show: true }, '.wd-overlay'],
        [RootPortal, {}, '.wd-root-portal'],
        [Transition, { show: true }, '.wd-transition']
      ]
      for (const [comp, props, selector] of cases) {
        const { container } = render(comp, props)
        expect(container.querySelector(selector), selector).not.toBeNull()
        cleanup()
      }
    })
  })

  describe('交互行为', () => {
    it('WdButton 点击 emit click', () => {
      let clicked = 0
      const { container } = render(
        {
          setup() {
            return () =>
              h(Button, { text: '点我', onClick: () => clicked++ })
          }
        } as any
      )
      const button = container.querySelector('.wd-button')!
      fireEvent.tap(button)
      expect(clicked).toBe(1)
      cleanup()
    })

    it('WdButton 禁用时点击不触发', () => {
      let clicked = 0
      const { container } = render(
        {
          setup() {
            return () => h(Button, { text: '禁用', disabled: true, onClick: () => clicked++ })
          }
        } as any
      )
      fireEvent.tap(container.querySelector('.wd-button')!)
      expect(clicked).toBe(0)
      cleanup()
    })

    it('WdIcon 渲染内置字体图标（码点字形经 text 子节点）', () => {
      const { container } = render(Icon, { name: 'close', size: 20 })
      const text = container.querySelector('text')
      expect(text).not.toBeNull()
      // 裸名优先官方图标集：close -> e728（wot-ui 2.3.2 官方字体 wd-wot-icons）
      expect(text!.textContent).toBe(String.fromCharCode(0xe728))
      cleanup()
    })

    it('WdIcon 注册 SVG 集后渲染 svg content（过白名单安全网）', () => {
      registerIconSet({
        key: 'tier1-svg',
        type: 'svg',
        viewBox: '0 0 1024 1024',
        paths: { 'tier1-close': 'M512 0h1024v1024H512z' }
      })
      const { container } = render(Icon, { name: 'tier1-close', size: 20 })
      const svg = container.querySelector('svg')
      expect(svg).not.toBeNull()
      expect(svg!.getAttribute('content')).toContain('<path')
      expect(svg!.getAttribute('content')).toContain('viewBox="0 0 1024 1024"')
      cleanup()
    })
  })
})
