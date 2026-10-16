/**
 * 内置图标注册表回归测试 — src/icons/registry.ts 与 wd-icon 的多集合渲染。
 *
 * 覆盖：
 * - wot 集（data.ts，SVG path）存量行为：不带前缀的名字优先命中 wot 集；
 * - iconfont 集（sets/iconfont.ts，.ttf 字体）：非重名图标直接用，重名图标
 *   （如 menu）经 `集合键:图标名` 寻址；渲染为 <text> 字形（Lynx 无 ::before）；
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

/** 码点 hex -> 字形字符 */
const glyphOf = (hex: string) => String.fromCharCode(parseInt(hex, 16))

describe('icons/registry', () => {
  it('内置两个集合：wot（302，SVG）+ iconfont（180，字体）', () => {
    const sets = listIconSets()
    expect(sets.map((s) => s.key)).toEqual(['wot', 'iconfont'])
    expect(sets[0].count).toBe(302)
    expect(sets[1].count).toBe(180)
  })

  it('存量 wot 图标不带前缀即可解析（SVG 行为不变）', () => {
    const icon = resolveIcon('close')
    expect(icon).not.toBeNull()
    expect(icon!.type).toBe('svg')
    expect(icon!.setKey).toBe('wot')
    expect(icon!.paths).toHaveLength(1)
    expect(hasIcon('check-circle')).toBe(true)
  })

  it('iconfont 集非重名图标直接可用（字体回退查找）', () => {
    const icon = resolveIcon('pdf')
    expect(icon).not.toBeNull()
    expect(icon!.type).toBe('font')
    expect(icon!.setKey).toBe('iconfont')
    if (icon!.type !== 'font') throw new Error('unreachable')
    expect(icon!.fontFamily).toBe('wd-iconfont')
    expect(icon!.unicode).toMatch(/^[0-9a-f]{4}$/)
  })

  it('重名图标：不带前缀命中 wot 集，带 iconfont: 前缀命中字体集', () => {
    expect(resolveIcon('menu')!.setKey).toBe('wot')
    const prefixed = resolveIcon('iconfont:menu')
    expect(prefixed).not.toBeNull()
    expect(prefixed!.type).toBe('font')
    expect(prefixed!.setKey).toBe('iconfont')
    // 两套字形不同（wot 是 SVG path，iconfont 是字体码点）
    expect(resolveIcon('menu')!.type).toBe('svg')
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

  it('listIcons 去重：全量名单 = 302 + 146（34 个重名只保留 wot 字形）', () => {
    expect(listIcons()).toHaveLength(302 + 146)
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
  it('wot SVG 图标：content 含 1 个 path', () => {
    const { container } = render(Icon, { name: 'close', size: 20 })
    const content = container.querySelector('svg')!.getAttribute('content')!
    expect((content.match(/<path/g) || []).length).toBe(1)
    expect(content).toContain('viewBox="0 0 1024 1024"')
    cleanup()
  })

  it('iconfont 字体图标：渲染 text 字形（非 svg）', () => {
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

  it('未知图标名不渲染图标节点', () => {
    const { container } = render(Icon, { name: 'no-such-icon' })
    expect(container.querySelector('svg')).toBeNull()
    expect(container.querySelector('text')).toBeNull()
    expect(container.querySelector('.wd-icon')).not.toBeNull()
    cleanup()
  })
})
