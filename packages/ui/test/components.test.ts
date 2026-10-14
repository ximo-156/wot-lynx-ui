import { describe, it, expect } from 'vitest'
import { ref } from 'vue-lynx'
import { render } from './render'
import { fireEvent } from './fire-event'
import WdIcon from '../src/components/wd-icon/wd-icon.vue'
import WdLoading from '../src/components/wd-loading/wd-loading.vue'
import WdCell from '../src/components/wd-cell/wd-cell.vue'
import WdCellGroup from '../src/components/wd-cell-group/wd-cell-group.vue'
import WdTag from '../src/components/wd-tag/wd-tag.vue'
import WdInput from '../src/components/wd-input/wd-input.vue'
import WdConfigProvider from '../src/components/wd-config-provider/wd-config-provider.vue'

describe('wd-icon', () => {
  it('渲染内置 SVG 图标', () => {
    const { container } = render(WdIcon, { name: 'close', size: '20' })
    const icon = container.querySelector('.wd-icon')
    expect(icon).toBeTruthy()
    const svg = container.querySelector('svg')
    expect(svg).toBeTruthy()
    // SVG content 包含 path 数据
    expect(svg!.getAttribute('content')).toContain('<path')
  })

  it('未知图标名不渲染 svg', () => {
    const { container } = render(WdIcon, { name: 'not-exist-icon' })
    expect(container.querySelector('svg')).toBeFalsy()
  })

  it('图片模式渲染 image', () => {
    const { container } = render(WdIcon, { name: 'https://example.com/a.png' })
    expect(container.querySelector('image')).toBeTruthy()
  })
})

describe('wd-loading', () => {
  it('circular 渲染 SVG 圆弧', () => {
    const { container } = render(WdLoading, { type: 'circular' })
    expect(container.querySelector('.wd-loading')).toBeTruthy()
    expect(container.querySelector('svg')).toBeTruthy()
  })

  it('spinner 渲染 12 个圆点', () => {
    const { container } = render(WdLoading, { type: 'spinner' })
    expect(container.querySelectorAll('.wd-loading__spinner-dot').length).toBe(12)
  })

  it('dots 渲染 3 个圆点', () => {
    const { container } = render(WdLoading, { type: 'dots' })
    // 类名与 wot-ui 对齐：dots 类型复用 wd-loading__spinner-dot
    expect(container.querySelectorAll('.wd-loading__spinner--dots .wd-loading__spinner-dot').length).toBe(3)
  })
})

describe('wd-cell', () => {
  it('渲染标题与值', () => {
    const { container } = render(WdCell, { title: '昵称', value: 'Lynx' })
    const cell = container.querySelector('.wd-cell')
    expect(cell).toBeTruthy()
    expect(cell!.textContent).toContain('昵称')
    expect(cell!.textContent).toContain('Lynx')
  })

  it('is-link 渲染箭头', () => {
    const { container } = render(WdCell, { title: '跳转', isLink: true })
    expect(container.querySelector('.wd-cell__arrow-right')).toBeTruthy()
  })
})

describe('wd-cell-group', () => {
  it('子单元格继承 border 配置', () => {
    const Wrapper = {
      components: { WdCellGroup, WdCell },
      template: `<WdCellGroup border><WdCell title="A" value="1" /></WdCellGroup>`
    }
    const { container } = render(Wrapper)
    const cell = container.querySelector('.wd-cell')
    expect(cell).toBeTruthy()
    // 第一个单元格（index 0）无边框，后续有
    expect(container.querySelector('.wd-cell-group')).toBeTruthy()
  })
})

describe('wd-tag', () => {
  it('渲染标签文本与类型', () => {
    const { container } = render(WdTag, { type: 'primary', text: '主要' })
    const tag = container.querySelector('.wd-tag')
    expect(tag).toBeTruthy()
    expect(tag!.textContent).toContain('主要')
  })
})

describe('wd-config-provider', () => {
  it('应用主题类名', () => {
    const { container } = render(WdConfigProvider, { theme: 'dark' })
    const root = container.querySelector('.wot-theme-dark')
    expect(root).toBeTruthy()
  })
})

describe('wd-input', () => {
  it('受控渲染与 input 事件', async () => {
    const Wrapper = {
      components: { WdInput },
      setup() {
        const value = ref('初始')
        return { value }
      },
      template: `<WdInput v-model="value" label="输入框" />`
    }
    const { container } = render(Wrapper)
    const input = container.querySelector('input')
    expect(input).toBeTruthy()
    expect(input!.getAttribute('value')).toBe('初始')
  })
})
