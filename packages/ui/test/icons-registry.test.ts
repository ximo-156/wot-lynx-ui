/**
 * 内置图标注册表回归测试 — src/icons/registry.ts 与 wd-icon 的字体渲染。
 *
 * 覆盖：
 * - 内置单集合 iconfont（sets/iconfont.ts，180 个，.ttf 字体）：不带前缀
 *   直接解析，渲染为 <text> 字形（Lynx 无 ::before）；
 * - `集合键:图标名` 寻址（如 iconfont:menu）精确命中指定集合；
 * - registerIconSet 扩展入口：运行时注册新集合（SVG / 字体）即可用。
 */
import { describe, it, expect } from 'vitest'
import { render, cleanup } from './render'
import Icon from '../src/components/wd-icon/wd-icon.vue'
import {
  hasIcon,
  listIcons,
  listIconSets,
  registerIconSet,
  resolveIcon
} from '../src/icons/registry'
import type { FontIconSet, IconSet, SvgIconSet } from '../src/icons/types'
import { wotIconsSet } from '../src/icons/sets/wot-icons'
import { iconfontSet } from '../src/icons/sets/iconfont'

/** 码点 hex -> 字形字符 */
const glyphOf = (hex: string) => String.fromCharCode(parseInt(hex, 16))

describe('icons/registry', () => {
  it('官方 305 字形优先，原 180 扩展字形仍在独立集合', () => {
    const sets = listIconSets()
    expect(sets.map((s) => s.key)).toEqual(['wot', 'iconfont'])
    expect(sets.map((s) => s.count)).toEqual([305, 180])
    for (const [name, unicode] of Object.entries(wotIconsSet.unicodes)) {
      expect(resolveIcon(name)).toMatchObject({ setKey: 'wot', type: 'font', fontFamily: 'wd-wot-icons', unicode })
      expect(resolveIcon(`wot:${name}`)).toMatchObject({ setKey: 'wot', unicode })
    }
    for (const [name, unicode] of Object.entries(iconfontSet.unicodes)) {
      expect(resolveIcon(`iconfont:${name}`)).toMatchObject({ setKey: 'iconfont', type: 'font', fontFamily: 'wd-iconfont', unicode })
      if (!(name in wotIconsSet.unicodes)) expect(resolveIcon(name)).toMatchObject({ setKey: 'iconfont', unicode })
    }
  })

  it('内置图标不带前缀即可解析（字体渲染）', () => {
    const icon = resolveIcon('close')
    expect(icon).not.toBeNull()
    expect(icon!.type).toBe('font')
    expect(icon!.setKey).toBe('wot')
    if (icon!.type !== 'font') throw new Error('unreachable')
    expect(icon!.fontFamily).toBe('wd-wot-icons')
    expect(icon!.unicode).toMatch(/^[0-9a-f]{4}$/)
    expect(hasIcon('pdf')).toBe(true)
  })

  it('带 iconfont: 前缀同样命中内置集合', () => {
    const prefixed = resolveIcon('iconfont:menu')
    expect(prefixed).not.toBeNull()
    expect(prefixed!.type).toBe('font')
    expect(prefixed!.setKey).toBe('iconfont')
  })

  it('未知名字 / 未知集合键 / 空值均返回 null', () => {
    expect(resolveIcon('')).toBeNull()
    expect(resolveIcon('no-such-icon')).toBeNull()
    expect(resolveIcon('iconfont:no-such-icon')).toBeNull()
    expect(resolveIcon('no-such-set:menu')).toBeNull()
    expect(hasIcon('no-such-icon')).toBe(false)
  })

  it('图片 URL 不会被误判为内置图标', () => {
    expect(resolveIcon('https://example.com/a.png')).toBeNull()
    expect(hasIcon('https://example.com/a.png')).toBe(false)
  })

  it('listIcons 返回两集合的完整去重名单', () => {
    const expected = new Set([...Object.keys(wotIconsSet.unicodes), ...Object.keys(iconfontSet.unicodes)])
    expect(new Set(listIcons())).toEqual(expected)
    expect(listIcons()).toHaveLength(expected.size)
    expect(listIcons('wot')).toHaveLength(305)
    expect(listIcons('iconfont')).toHaveLength(180)
    expect(listIcons('no-such-set')).toEqual([])
  })

  it('registerIconSet：运行时注册新集合即可用（扩展入口）', () => {
    const customSvgSet: SvgIconSet = {
      key: 'test-custom',
      type: 'svg',
      viewBox: '0 0 24 24',
      paths: {
        'custom-star': 'M12 2l3 7h7l-5.5 4.5L18 21l-6-4-6 4 1.5-7.5L2 9h7z'
      }
    }
    registerIconSet(customSvgSet)

    const star = resolveIcon('custom-star')
    expect(star).not.toBeNull()
    expect(star!.type).toBe('svg')
    expect(star!.setKey).toBe('test-custom')
    if (star!.type !== 'svg') throw new Error('unreachable')
    expect(star!.viewBox).toBe('0 0 24 24')

    // 注册一套字体集亦可
    const customFontSet: FontIconSet = {
      key: 'test-custom-font',
      type: 'font',
      fontFamily: 'test-font',
      unicodes: { 'test-a': 'e001' }
    }
    registerIconSet(customFontSet)
    const fontIcon = resolveIcon('test-custom-font:test-a')
    expect(fontIcon).not.toBeNull()
    if (fontIcon!.type !== 'font') throw new Error('unreachable')
    expect(fontIcon!.fontFamily).toBe('test-font')
    expect(fontIcon!.unicode).toBe('e001')

    expect(listIconSets().map((s) => s.key)).toContain('test-custom')
    expect(listIconSets().map((s) => s.key)).toContain('test-custom-font')
  })

  it('registerIconSet：同键重复注册整体覆盖', () => {
    registerIconSet({ key: 'test-override', type: 'font', fontFamily: 'f', unicodes: { a: 'e001' } })
    registerIconSet({ key: 'test-override', type: 'font', fontFamily: 'f', unicodes: { b: 'e002' } })
    expect(resolveIcon('test-override:a')).toBeNull()
    expect(resolveIcon('test-override:b')!.setKey).toBe('test-override')
  })

  it('registerIconSet：拒绝残缺集合', () => {
    registerIconSet({ key: '', type: 'font', fontFamily: 'f', unicodes: {} } as unknown as IconSet)
    registerIconSet({ key: 'bad', type: 'svg', viewBox: '0 0 1 1' } as unknown as IconSet)
    expect(resolveIcon('bad:x')).toBeNull()
  })
})

describe('WdIcon 渲染', () => {
  it('内置字体图标：渲染 text 字形（非 svg）', () => {
    const { container } = render(Icon, { name: 'pdf', size: 24 })
    expect(container.querySelector('svg')).toBeNull()
    const text = container.querySelector('text')
    expect(text).not.toBeNull()
    const resolved = resolveIcon('pdf')!
    if (resolved.type !== 'font') throw new Error('unreachable')
    expect(text!.textContent).toBe(glyphOf(resolved.unicode))
    cleanup()
  })

  it('命名空间名字渲染字体字形，根类名的 : 替换为 -', () => {
    const { container } = render(Icon, { name: 'iconfont:menu', size: 20 })
    expect(container.querySelector('.wd-icon-iconfont-menu')).not.toBeNull()
    const text = container.querySelector('text')
    expect(text).not.toBeNull()
    expect(text!.textContent).toBe(glyphOf('e6b2'))
    cleanup()
  })

  it('扩展注册的 SVG 集合：渲染 svg content', () => {
    registerIconSet({
      key: 'test-render-svg',
      type: 'svg',
      viewBox: '0 0 24 24',
      paths: { 'render-star': 'M12 2l3 7h7l-5.5 4.5L18 21l-6-4-6 4 1.5-7.5L2 9h7z' }
    })
    const { container } = render(Icon, { name: 'render-star', size: 20 })
    const content = container.querySelector('svg')!.getAttribute('content')!
    expect((content.match(/<path/g) || []).length).toBe(1)
    expect(content).toContain('viewBox="0 0 24 24"')
    cleanup()
  })

  it('未知图标名不渲染图标节点', () => {
    const { container } = render(Icon, { name: 'no-such-icon' })
    expect(container.querySelector('svg')).toBeNull()
    expect(container.querySelector('text')).toBeNull()
    expect(container.querySelector('.wd-icon')).not.toBeNull()
    cleanup()
  })
})
