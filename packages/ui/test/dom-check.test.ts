import { describe, it, expect } from 'vitest'
import { render } from './render'
import WdCell from '../src/components/wd-cell/wd-cell.vue'
import WdDivider from '../src/components/wd-divider/wd-divider.vue'
import WdTabbarItem from '../src/components/wd-tabbar-item/wd-tabbar-item.vue'
import WdTabbar from '../src/components/wd-tabbar/wd-tabbar.vue'
import WdButton from '../src/components/wd-button/wd-button.vue'

describe('DOM 结构核查', () => {
  it('cell is-border 渲染真实分隔线元素', () => {
    const { container } = render(WdCell, { title: '标题', border: true })
    expect(container.querySelector('.wd-cell__border')).toBeTruthy()
  })
  it('cell 无 border 不渲染分隔线', () => {
    const { container } = render(WdCell, { title: '标题' })
    expect(container.querySelector('.wd-cell__border')).toBeFalsy()
  })
  it('divider 渲染左右线段', () => {
    const { container } = render(WdDivider, null)
    const before = container.querySelector('.wd-divider__line--before')
    const after = container.querySelector('.wd-divider__line--after')
    expect(before).toBeTruthy()
    expect(after).toBeTruthy()
  })
  it('divider 带内容时渲染文本', () => {
    const Wrapper = {
      components: { WdDivider },
      template: `<wd-divider>文本</wd-divider>`
    }
    const { container } = render(Wrapper)
    expect(container.querySelector('.wd-divider__content')).toBeTruthy()
    expect(container.textContent).toContain('文本')
  })
  it('tabbar-item 激活态类名在 body 内（由 tabbar modelValue 驱动）', () => {
    const Wrapper = {
      components: { WdTabbar, WdTabbarItem },
      setup: () => ({ value: 0 }),
      template: `<wd-tabbar v-model="value"><wd-tabbar-item :name="0" title="首页" /></wd-tabbar>`
    }
    const { container } = render(Wrapper)
    expect(container.querySelector('.wd-tabbar-item__body .is-active')).toBeTruthy()
  })
  it('button 有图标时文字带 is-after-icon', () => {
    const { container } = render(WdButton, { icon: 'setting', text: '设置' })
    expect(container.querySelector('.wd-button__text.is-after-icon')).toBeTruthy()
  })
  it('button 无图标时文字不带 is-after-icon', () => {
    const { container } = render(WdButton, { text: '设置' })
    const text = container.querySelector('.wd-button__text')
    expect(text).toBeTruthy()
    expect(text!.classList.contains('is-after-icon')).toBe(false)
  })
})
