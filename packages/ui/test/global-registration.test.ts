/**
 * wotLynxUI 全局注册回归测试。
 *
 * 背景（真机 603 "Can't find ui tag" / 页面空白）：
 * 1. <script setup> 组件运行时没有 name 属性，只有编译器注入的 __name
 *    （如 'wd-button'）。旧代码 `component.name || 'WdComponent'` 把全部
 *    组件注册到同一个 'WdComponent' 名下；
 * 2. 即便取到 kebab-case 名，Vue 的 resolveComponent 也无法用
 *    PascalCase 标签 <WdButton> 命中 'wd-button' 注册名。
 * 两者都会使标签退化为原生元素，Lynx 找不到对应 LynxUI 而整页空白。
 */
import { describe, it, expect } from 'vitest'
import { render } from './render'
import wotLynxUI from '../src/index'

describe('wotLynxUI 全局注册', () => {
  it('同时注册 kebab-case 与 PascalCase 两种组件名', () => {
    const names: string[] = []
    const mockApp = {
      component(name: string) {
        names.push(name)
        return mockApp
      }
    }
    wotLynxUI.install(mockApp as any)

    // 每个组件都应有两个注册名
    expect(names).toContain('wd-button')
    expect(names).toContain('WdButton')
    expect(names).toContain('wd-config-provider')
    expect(names).toContain('WdConfigProvider')
    expect(names).toContain('wd-swipe-action')
    expect(names).toContain('WdSwipeAction')

    // 回归点：不得再全部回退到 'WdComponent'
    expect(names).not.toContain('WdComponent')
    // 注册名数量应为组件数的两倍（kebab + Pascal）
    expect(names.length % 2).toBe(0)
    expect(new Set(names).size).toBe(names.length)
  })

  it('全局注册后 PascalCase 标签无需 import 即可渲染', () => {
    const Root = {
      template: `<WdConfigProvider><WdButton type="primary">全局按钮</WdButton></WdConfigProvider>`
    }
    const { container } = render(Root, undefined, [wotLynxUI])
    const button = container.querySelector('.wd-button')
    expect(button).toBeTruthy()
    expect(button!.textContent).toContain('全局按钮')
    expect(button!.classList.contains('is-primary')).toBe(true)
  })
})
