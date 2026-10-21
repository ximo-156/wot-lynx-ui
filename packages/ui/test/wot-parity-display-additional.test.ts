/** Actual official 2.3.2 display contracts through the Lynx two-thread test renderer.
 * These assertions cover API/interaction and CSS declarations, not native pixel parity.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { h, ref } from 'vue-lynx'
import { createEvent } from '@testing-library/dom'
import { render, cleanup } from './render'
import { fireEvent } from './fire-event'
import { pause } from '../src/common/util'
import { uni } from '../src/common/uni'
import Avatar from '../src/components/wd-avatar/wd-avatar.vue'
import AvatarGroup from '../src/components/wd-avatar-group/wd-avatar-group.vue'
import Badge from '../src/components/wd-badge/wd-badge.vue'
import Tag from '../src/components/wd-tag/wd-tag.vue'
import Img from '../src/components/wd-img/wd-img.vue'
import Empty from '../src/components/wd-empty/wd-empty.vue'
import Skeleton from '../src/components/wd-skeleton/wd-skeleton.vue'
import NoticeBar from '../src/components/wd-notice-bar/wd-notice-bar.vue'

const source = (name: string, file = 'index.css') => readFileSync(path.resolve(__dirname, `../src/components/${name}/${file}`), 'utf8')
const style = (el: Element) => (el as HTMLElement).style
const settle = () => pause(25)
function nativeEvent(el: Element, name: string, detail: Record<string, any> = {}) {
  const event = createEvent(`bindEvent:${name}`, el, {})
  Object.assign(event, { eventType: 'bindEvent', eventName: name, detail })
  fireEvent(el, event)
  return event
}

afterEach(() => { cleanup(); vi.restoreAllMocks() })

describe('official display additional: avatar / badge', () => {
  it('avatar slot > image > text > icon, click has no payload and tap forwards the event', () => {
    const clicks: any[][] = [], taps: any[] = []
    const { container } = render({ setup: () => () => h(Avatar, {
      src: 'avatar.png', text: 'A', icon: 'user', onClick: (...args: any[]) => clicks.push(args), onTap: (event: any) => taps.push(event)
    }, { default: () => h('text', { class: 'avatar-slot' }, 'slot') }) } as any)
    expect(container.querySelector('.avatar-slot')?.textContent).toBe('slot')
    expect(container.querySelector('.wd-img')).toBeNull()
    expect(container.querySelector('.wd-avatar__text')).toBeNull()
    fireEvent.tap(container.querySelector('.wd-avatar')!)
    expect(clicks).toEqual([[]])
    expect(taps).toHaveLength(1)
  })

  it('avatar custom size and colors clear back to preset CSS rather than retaining inline values', async () => {
    const size = ref<string | number>(80), color = ref('#ff0000'), bgColor = ref('#000000')
    const { container } = render({ setup: () => () => h(Avatar, { size: size.value, color: color.value, bgColor: bgColor.value, text: 'A' }) } as any)
    const root = container.querySelector('.wd-avatar')!
    expect(style(root).width).toBe('80px')
    // 官方：font-size = calc(size * 0.45)；DOM 归一化后为 calc(36px)
    expect(style(root).fontSize).toBe('calc(36px)')
    size.value = 'small'; color.value = ''; bgColor.value = ''
    await settle()
    expect(root.classList.contains('wd-avatar--small')).toBe(true)
    expect(style(root).width).toBe('')
    expect(style(root).height).toBe('')
    expect(style(root).fontSize).toBe('')
    expect(style(root).color).toBe('')
    expect(style(root).background).toBe('')
    expect(root.querySelector('text')?.getAttribute('text-maxline')).toBe('1')
    expect(source('wd-avatar')).toMatch(/\.wd-avatar__text\{[^}]*font-size:inherit/)
  })

  it('badge preserves number/string/max-zero semantics, dot and hidden priority', () => {
    for (const [props, content] of [
      [{ value: 0 }, null], [{ value: 0, showZero: true }, '0'], [{ value: '0' }, '0'],
      [{ value: 100, max: 99 }, '99+'], [{ value: '100', max: 99 }, '100'],
      [{ value: 5, max: 0 }, '5'], [{ value: 5, isDot: true }, ''], [{ value: 5, hidden: true }, null]
    ] as const) {
      const { container } = render(Badge as any, props)
      const badge = container.querySelector('.wd-badge__content')
      expect(badge?.textContent ?? null).toBe(content)
    }
  })

  it('badge offsets and background clear; border overlay does not consume padding', async () => {
    const top = ref<number | undefined>(4), right = ref<number | undefined>(6), bgColor = ref<string | undefined>('#ff0000'), border = ref(true)
    const { container } = render({ setup: () => () => h(Badge, { value: 9, top: top.value, right: right.value, bgColor: bgColor.value, border: border.value }) } as any)
    const badge = container.querySelector('.wd-badge__content')!
    expect(style(badge).top).toBe('4px')
    expect(style(badge).right).toBe('6px')
    expect(badge.querySelector('.wd-badge__border')).not.toBeNull()
    expect(source('wd-badge')).toMatch(/\.wd-badge__border\{[^}]*position:absolute/)
    expect(source('wd-badge')).not.toMatch(/\.wd-badge__content\.is-border\{[^}]*border-width/)
    top.value = undefined; right.value = undefined; bgColor.value = undefined; border.value = false
    await settle()
    expect(style(badge).top).toBe('')
    expect(style(badge).right).toBe('')
    expect(style(badge).backgroundColor).toBe('')
    expect(badge.querySelector('.wd-badge__border')).toBeNull()
  })
})

describe('official display additional: tag', () => {
  it('plain/dashed overlays preserve auto-size geometry, custom border and variant clearing', async () => {
    const variant = ref<any>('dark'), bgColor = ref('#112233'), color = ref('#ff0000')
    const { container } = render({ setup: () => () => h(Tag, { variant: variant.value, bgColor: bgColor.value, color: color.value }, {
      default: () => h('text', 'label')
    }) } as any)
    const root = container.querySelector('.wd-tag')!
    expect(style(root).background).not.toBe('')
    variant.value = 'plain'
    await settle()
    expect(style(root).background).toBe('')
    expect(root.querySelector('.wd-tag__border')).not.toBeNull()
    expect(style(root.querySelector('.wd-tag__border')!).borderColor).toBe('rgb(17, 34, 51)')
    expect(source('wd-tag')).not.toMatch(/\.wd-tag\.is-primary\.is-plain\{[^}]*border-width/)
    bgColor.value = ''; color.value = ''; variant.value = 'text'
    await settle()
    expect(root.querySelector('.wd-tag__border')).toBeNull()
    expect(style(root).borderColor).toBe('')
    expect(style(root.querySelector('.wd-tag__text')!).color).toBe('')
  })

  it('dynamic add/input/confirm/blur retains official payload and close does not click', async () => {
    const confirms: any[] = [], clicks: any[] = []
    const { container } = render({ setup: () => () => h(Tag, { dynamic: true, onConfirm: (event: any) => confirms.push(event), onClick: (event: any) => clicks.push(event) }) } as any)
    expect(container.querySelector('.wd-tag__add')?.classList.contains('wd-icon-plus')).toBe(true)
    fireEvent.tap(container.querySelector('.wd-tag__text')!)
    await settle()
    let input = container.querySelector('input')!
    expect(input).not.toBeNull()
    fireEvent.input(input, { detail: { value: 'new label' } })
    fireEvent.confirm(input, { detail: { value: 'new label' } })
    await settle()
    expect(confirms).toEqual([{ value: 'new label' }])
    expect(container.querySelector('input')).toBeNull()
    fireEvent.tap(container.querySelector('.wd-tag__text')!)
    await settle()
    input = container.querySelector('input')!
    fireEvent.blur(input)
    await settle()
    expect(confirms).toHaveLength(1)
    expect(clicks).toHaveLength(0)
    const closes: any[] = []
    const closable = render({ setup: () => () => h(Tag, { closable: true, onClose: (event: any) => closes.push(event), onClick: (event: any) => clicks.push(event) }) } as any)
    fireEvent.tap(closable.container.querySelector('.wd-tag__close')!)
    expect(closes).toHaveLength(1)
    expect(clicks).toHaveLength(0)
    expect(source('wd-tag')).toMatch(/\.wd-tag__text\{[^}]*display:flex[^}]*flex-direction:row/)
  })

  it('icon/add/default slots override their respective fallback only', () => {
    const { container } = render({ setup: () => () => h(Tag, { icon: 'user' }, {
      icon: () => h('text', { class: 'tag-icon-slot' }, 'icon'), default: () => h('text', { class: 'tag-default-slot' }, 'default')
    }) } as any)
    expect(container.querySelector('.tag-icon-slot')).not.toBeNull()
    expect(container.querySelector('.wd-tag__icon')).toBeNull()
    expect(container.querySelector('.tag-default-slot')).not.toBeNull()
  })
})

describe('official display additional: img / empty', () => {
  it('img uses official icons and loading/error events and recovers after source replacement', async () => {
    const src = ref('bad.png'), loads: any[] = [], errors: any[] = []
    const { container } = render({ setup: () => () => h(Img, { src: src.value, onLoad: (event: any) => loads.push(event), onError: (event: any) => errors.push(event) }) } as any)
    expect(container.querySelector('.wd-img__loading-icon')?.classList.contains('wd-icon-image')).toBe(true)
    nativeEvent(container.querySelector('image')!, 'error', { errMsg: 'failed' })
    await settle()
    expect(errors).toHaveLength(1)
    expect(container.querySelector('image')).toBeNull()
    expect(container.querySelector('.wd-img__error-icon')?.classList.contains('wd-icon-image-failloading')).toBe(true)
    src.value = 'good.png'
    await settle()
    expect(container.querySelector('image')?.getAttribute('src')).toBe('good.png')
    expect(container.querySelector('.wd-img__error')).toBeNull()
    nativeEvent(container.querySelector('image')!, 'load', { width: 100, height: 80 })
    await settle()
    expect(loads).toHaveLength(1)
    expect(container.querySelector('.wd-img__loading')).toBeNull()
  })

  it('img preview is success-only and uses previewSrc; sizing/radius resets preserve round clipping', async () => {
    const preview = vi.spyOn(uni, 'previewImage').mockImplementation(() => undefined as any)
    const width = ref<number | undefined>(120), radius = ref<number | undefined>(8), round = ref(false)
    const { container } = render({ setup: () => () => h(Img, { src: 'image.png', previewSrc: 'preview.png', enablePreview: true, width: width.value, radius: radius.value, round: round.value }) } as any)
    const root = container.querySelector('.wd-img')!
    fireEvent.tap(root)
    expect(preview).not.toHaveBeenCalled()
    nativeEvent(container.querySelector('image')!, 'load')
    fireEvent.tap(root)
    expect(preview).toHaveBeenCalledWith({ urls: ['preview.png'] })
    round.value = true; radius.value = undefined; width.value = undefined
    await settle()
    expect(style(root).borderRadius).toBe('')
    expect(style(root).width).toBe('')
    expect(style(root).overflow).toBe('hidden')
    round.value = false
    await settle()
    expect(style(root).overflow).toBe('')
  })

  it('empty uses the official empty icon and iconSize updates both its box and glyph', async () => {
    const size = ref<number | undefined>(40)
    const { container } = render({ setup: () => () => h(Empty, { iconSize: size.value, tip: 'empty' }) } as any)
    const icon = container.querySelector('.wd-empty__icon')!
    expect(icon.classList.contains('wd-icon-empty')).toBe(true)
    expect(style(icon).width).toBe('40px')
    expect(style(icon).height).toBe('40px')
    // 字号由图标根节点承担，字形 text 显式 inherit（不重复下发内联值）
    expect(style(icon).fontSize).toBe('40px')
    expect(style(icon.querySelector('.wd-icon__glyph')!).fontSize).toBe('inherit')
    size.value = undefined
    await settle()
    expect(style(icon).width).toBe('')
    expect(style(icon).height).toBe('')
    expect(style(icon.querySelector('.wd-icon__glyph')!).fontSize).toBe('inherit')
    expect(source('wd-empty')).toContain('--wot-empty-icon-size')
  })

  it('empty image/bottom slots override fallback without inventing a default slot', () => {
    const { container } = render({ setup: () => () => h(Empty, { tip: '' }, {
      image: () => h('text', { class: 'empty-image-slot' }, 'image'), bottom: () => h('text', { class: 'empty-bottom-slot' }, 'bottom'),
      default: () => h('text', { class: 'empty-default-slot' }, 'unused')
    }) } as any)
    expect(container.querySelector('.empty-image-slot')).not.toBeNull()
    expect(container.querySelector('.empty-bottom-slot')).not.toBeNull()
    expect(container.querySelector('.wd-empty__icon')).toBeNull()
    expect(container.querySelector('.wd-empty__text')).toBeNull()
    expect(container.querySelector('.empty-default-slot')).toBeNull()
  })
})
