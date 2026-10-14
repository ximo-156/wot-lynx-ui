import { describe, it, expect } from 'vitest'
import { styleToObject, objToStyle, addUnit, getRect, sanitizeSvgContent } from '../src/common/util'
import { render } from './render'
import WdCell from '../src/components/wd-cell/wd-cell.vue'
import WdText from '../src/components/wd-text/wd-text.vue'

describe('common/util', () => {
  it('objToStyle 生成样式字符串', () => {
    expect(objToStyle({ width: '30%', left: 0 })).toBe('width:30%;left:0')
  })

  it('styleToObject 解析样式字符串', () => {
    expect(styleToObject('width: 30%;left: 0')).toEqual({ width: '30%', left: '0' })
  })

  it('styleToObject 处理 data URI 中的分号', () => {
    const style = 'background-image: url("data:image/svg+xml;base64,PHN2Zy;test")'
    expect(styleToObject(style)).toEqual({
      'background-image': 'url("data:image/svg+xml;base64,PHN2Zy;test")'
    })
  })

  it('styleToObject 透传对象', () => {
    expect(styleToObject({ width: '30%' })).toEqual({ width: '30%' })
  })

  it('styleToObject 处理空值', () => {
    expect(styleToObject('')).toEqual({})
    expect(styleToObject(undefined)).toEqual({})
  })

  it('addUnit 自动补 px', () => {
    expect(addUnit(20)).toBe('20px')
    expect(addUnit('2em')).toBe('2em')
  })

  it('getRect 在测试环境解析为零尺寸矩形（不 reject）', async () => {
    const rect = await getRect('#not-exist')
    expect(rect).toBeTruthy()
    expect(rect.width).toBe(0)
    expect(rect.height).toBe(0)
  })

  it('getRect 在 lynx.createSelectorQuery 缺失时降级为零矩形（不 reject，避免未处理拒绝）', async () => {
    const lynx = (globalThis as any).lynx
    const original = lynx.createSelectorQuery
    delete lynx.createSelectorQuery
    try {
      const rect = await getRect('#track')
      expect(rect).toEqual({ left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 })
      // all 模式返回空数组，与"无匹配节点"语义一致
      const rects = await getRect('.wd-rate__item', true)
      expect(rects).toEqual([])
      // 降级会被告警一次（由 setup.ts 静默并记录），便于排查宿主能力缺失
      expect((globalThis as any).__metricDegradation.length).toBeGreaterThan(0)
    } finally {
      lynx.createSelectorQuery = original
    }
  })

  it('getRect 在 invoke 失败回调触发时降级为零矩形（不 reject）', async () => {
    const lynx = (globalThis as any).lynx
    const original = lynx.createSelectorQuery
    // 真机上查询失败（节点不存在 / 跨线程超时）时走 fail 回调
    lynx.createSelectorQuery = () => {
      const ref = {
        invoke(options: any) {
          if (options && typeof options.fail === 'function') {
            setTimeout(() => options.fail('node does not exist'), 0)
          }
          return { exec: () => {} }
        }
      }
      return { select: () => ref, selectAll: () => ref, in: () => ({ select: () => ref, selectAll: () => ref }), exec: () => {} }
    }
    try {
      const rect = await getRect('#track')
      expect(rect).toEqual({ left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 })
      const rects = await getRect('.wd-rate__item', true)
      expect(rects).toEqual([])
    } finally {
      lynx.createSelectorQuery = original
    }
  })

  it('getRect 在 success 返回空结果时降级为零矩形（不 reject）', async () => {
    const lynx = (globalThis as any).lynx
    const original = lynx.createSelectorQuery
    // 真机上"选择器未命中"时 success 收到 undefined（单选）或空数组（selectAll）
    lynx.createSelectorQuery = () => {
      const ref = {
        invoke(options: any) {
          if (options && typeof options.success === 'function') {
            setTimeout(() => options.success(undefined), 0)
          }
          return { exec: () => {} }
        }
      }
      const allRef = {
        invoke(options: any) {
          if (options && typeof options.success === 'function') {
            setTimeout(() => options.success([]), 0)
          }
          return { exec: () => {} }
        }
      }
      return { select: () => ref, selectAll: () => allRef, in: () => ({ select: () => ref, selectAll: () => allRef }), exec: () => {} }
    }
    try {
      const rect = await getRect('#track')
      expect(rect).toEqual({ left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 })
      // all 模式：空结果是合法的"无节点"语义，直接返回空数组
      const rects = await getRect('.wd-rate__item', true)
      expect(rects).toEqual([])
    } finally {
      lynx.createSelectorQuery = original
    }
  })
})


describe('sanitizeSvgContent（SVG content 引擎白名单安全网）', () => {
  it('白名单元素原样返回', () => {
    const safe = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><g fill="#000"><rect x="0" y="0" width="4" height="4"/><circle cx="5" cy="5" r="2"/><path d="M0 0 L10 10"/><polyline points="0,0 5,5"/></g></svg>'
    expect(sanitizeSvgContent(safe)).toBe(safe)
  })

  it('空内容与非标记内容原样返回', () => {
    expect(sanitizeSvgContent('')).toBe('')
    expect(sanitizeSvgContent('plain text')).toBe('plain text')
  })

  it('移除白名单外自闭合元素', () => {
    const input = '<svg><rect x="0" y="0" width="4" height="4"/><image href="a.png" x="0" y="0" width="4" height="4"/></svg>'
    const output = sanitizeSvgContent(input)
    expect(output).toContain('<rect')
    expect(output).not.toContain('<image')
    expect(output).not.toContain('a.png')
  })

  it('移除白名单外元素及其整个子树', () => {
    const input = '<svg><defs><linearGradient id="g"><stop offset="0" stop-color="#f00"/></linearGradient></defs><rect width="4" height="4" fill="url(#g)"/></svg>'
    const output = sanitizeSvgContent(input)
    expect(output).not.toContain('<defs')
    expect(output).not.toContain('linearGradient')
    expect(output).not.toContain('<stop')
    expect(output).toContain('<rect')
  })

  it('统计同名嵌套，正确匹配闭标签', () => {
    const input = '<svg><g><defs><defs></defs></defs><rect width="1" height="1"/></g></svg>'
    const output = sanitizeSvgContent(input)
    expect(output).not.toContain('defs')
    expect(output).toContain('<rect')
    expect(output).toContain('</g>')
  })

  it('属性值中的 > 与引号不破坏标签切分', () => {
    const input = '<svg><path d="M0 0 L10 10" fill="rgb(0,0,0)"/><text data-x="a>b">t</text><rect width="2" height="2"/></svg>'
    const output = sanitizeSvgContent(input)
    expect(output).toContain('M0 0 L10 10')
    expect(output).not.toContain('<text')
    expect(output).not.toContain('>t<')
    expect(output).toContain('<rect')
  })

  it('孤立闭标签被移除', () => {
    expect(sanitizeSvgContent('<svg></text></svg>')).toBe('<svg></svg>')
  })
})

describe('内联样式绑定（vue-lynx 仅支持对象形式）', () => {
  it('customStyle 字符串被正确应用', () => {
    const { container } = render(WdCell, {
      title: '测试',
      customStyle: 'padding-top: 8px'
    })
    const cell = container.querySelector('.wd-cell') as HTMLElement
    expect(cell.style.paddingTop).toBe('8px')
  })

  it('wd-text 的 size / lineHeight 自动补单位（避免 Lynx 1303 CSS length need units）', () => {
    const { container } = render(WdText, {
      text: '文本',
      size: '14',
      lineHeight: '20'
    })
    const text = container.querySelector('.wd-text') as HTMLElement
    expect(text.style.fontSize).toBe('14px')
    expect(text.style.lineHeight).toBe('20px')
  })
})
