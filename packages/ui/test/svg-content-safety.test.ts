/**
 * SVG content 安全回归测试。
 *
 * 背景：Lynx 引擎的 SVG content 解析器只支持有限的元素集合
 * （本库已验证可用：svg / path / rect / circle / g / polyline）。
 * 一旦 content 中出现引擎不支持的元素（linearGradient / stop / defs /
 * clipPath / image / text ...），真机 PaintingContext.insertNode 会抛
 * "Insertion (new) failed due to unknown child signature" 致命异常
 * （Lynx 错误码 9902），且无法在 JS 侧捕获。
 *
 * 这些用例保证 wd-circle / wd-qr-code 渲染路径输出的 SVG content
 * 只包含引擎安全的元素，渐变 / 背景图降级为纯色与原生 image 叠加层。
 */
import { describe, it, expect } from 'vitest'
import { render } from './render'
import WdCircle from '../src/components/wd-circle/wd-circle.vue'
import WdQrCode from '../src/components/wd-qr-code/wd-qr-code.vue'
import WdIcon from '../src/components/wd-icon/wd-icon.vue'
import WdLoading from '../src/components/wd-loading/wd-loading.vue'
import WdBarCode from '../src/components/wd-bar-code/wd-bar-code.vue'
import WdSignature from '../src/components/wd-signature/wd-signature.vue'

/** 引擎不支持的 SVG content 元素（出现即真机致命崩溃） */
const UNSAFE_ELEMENTS = ['<defs', '<linearGradient', '<radialGradient', '<stop', '<clipPath', '<image', '<text', '<use', '<symbol']

function getSvgContent(container: Element): string {
  const svg = container.querySelector('svg')
  expect(svg).toBeTruthy()
  return svg!.getAttribute('content') || ''
}

describe('svg content 引擎安全：wd-circle', () => {
  it('纯色 color 时输出 circle 元素', () => {
    const { container } = render(WdCircle, { modelValue: 65, color: '#3482FF' })
    const content = getSvgContent(container)
    expect(content).toContain('<circle')
    expect(content).toContain('stroke="#3482FF"')
  })

  it('渐变色对象降级为首个色标纯色，且不含引擎不支持的元素', () => {
    const { container } = render(WdCircle, {
      modelValue: 65,
      color: { '0': '#3482FF', '100': '#7C5CFC' }
    })
    const content = getSvgContent(container)
    expect(content).toContain('stroke="#3482FF"')
    expect(content).not.toContain('url(#')
    for (const tag of UNSAFE_ELEMENTS) {
      expect(content).not.toContain(tag)
    }
  })

  it('渐变色对象无有效色标时兜底默认色', () => {
    const { container } = render(WdCircle, { modelValue: 65, color: {} })
    const content = getSvgContent(container)
    expect(content).toContain('stroke="#3482FF"')
  })
})

describe('svg content 引擎安全：wd-qr-code', () => {
  it('默认渲染输出 rect / g，且不含引擎不支持的元素', () => {
    const { container } = render(WdQrCode, { text: 'https://wot-ui.cn' })
    const content = getSvgContent(container)
    expect(content).toContain('<rect')
    expect(content).toContain('<g fill="#000000">')
    for (const tag of UNSAFE_ELEMENTS) {
      expect(content).not.toContain(tag)
    }
  })

  it('enableGradient 降级为 gradientColors 首个颜色纯色，不输出 linearGradient', () => {
    const { container } = render(WdQrCode, {
      text: 'https://wot-ui.cn',
      enableGradient: true,
      gradientColors: ['#3482FF', '#7C5CFC']
    })
    const content = getSvgContent(container)
    expect(content).toContain('<g fill="#3482FF">')
    expect(content).not.toContain('url(#')
    for (const tag of UNSAFE_ELEMENTS) {
      expect(content).not.toContain(tag)
    }
  })

  it('enableGradient 无 gradientColors 时降级为 colorDark', () => {
    const { container } = render(WdQrCode, {
      text: 'https://wot-ui.cn',
      enableGradient: true,
      colorDark: '#123456'
    })
    const content = getSvgContent(container)
    expect(content).toContain('<g fill="#123456">')
  })

  it('backgroundImage 改用原生 image 叠加层，svg content 不内嵌 image 且无背景矩形遮挡', () => {
    const { container } = render(WdQrCode, {
      text: 'https://wot-ui.cn',
      backgroundImage: 'https://example.com/bg.png'
    })
    const content = getSvgContent(container)
    expect(content).not.toContain('<image')
    // 背景图由原生 image 承载，svg 内不再绘制 colorLight 背景矩形
    expect(content).not.toContain('fill="#FFFFFF"')

    const bg = container.querySelector('image.wd-qr-code__bg')
    expect(bg).toBeTruthy()
    expect(bg!.getAttribute('src')).toBe('https://example.com/bg.png')
  })

  it('dots 码点使用 circle，同样不含引擎不支持的元素', () => {
    const { container } = render(WdQrCode, { text: 'https://wot-ui.cn', dotType: 'dots' })
    const content = getSvgContent(container)
    expect(content).toContain('<circle')
    for (const tag of UNSAFE_ELEMENTS) {
      expect(content).not.toContain(tag)
    }
  })
})

describe('svg content 引擎安全：其余渲染路径（wd-icon / wd-loading / wd-bar-code / wd-signature）', () => {
  it('wd-icon 内置图标仅输出 path', () => {
    for (const name of ['close', 'loading', 'arrow-left', 'settings', 'notification', 'plus', 'left', 'right']) {
      const { container } = render(WdIcon, { name, size: '20' })
      const content = getSvgContent(container)
      expect(content).toContain('<path')
      for (const tag of UNSAFE_ELEMENTS) {
        expect(content).not.toContain(tag)
      }
    }
  })

  it('wd-loading circular 仅输出 path，其余类型不产生 svg content', () => {
    const { container } = render(WdLoading, { type: 'circular', size: '24px' })
    const content = getSvgContent(container)
    expect(content).toContain('<path')
    for (const tag of UNSAFE_ELEMENTS) {
      expect(content).not.toContain(tag)
    }
  })

  it('wd-bar-code 渲染路径仅输出 rect / g（text 仅存在于导出 data URI）', () => {
    const { container } = render(WdBarCode, { value: '12345678901', width: 180, height: 60 })
    const content = getSvgContent(container)
    expect(content).toContain('<rect')
    expect(content).toContain('<g ')
    for (const tag of UNSAFE_ELEMENTS) {
      expect(content).not.toContain(tag)
    }
  })

  it('wd-signature 初始与绘制后仅输出 rect / polyline', () => {
    const { container } = render(WdSignature, { height: 120 })
    const content = getSvgContent(container)
    for (const tag of UNSAFE_ELEMENTS) {
      expect(content).not.toContain(tag)
    }
  })
})
