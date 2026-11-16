import { afterEach, describe, expect, it } from 'vitest'
import { h, nextTick, ref } from 'vue-lynx'
import { cleanup, render } from '../render'
import PullRefresh from '@wot-lynx/ui-display/wd-pull-refresh'
import Swiper from '@wot-lynx/ui-display/wd-swiper'
import Table from '@wot-lynx/ui-display/wd-table'

afterEach(cleanup)
function hasInline(element: Element, property: string) {
  return (element as HTMLElement).style.getPropertyValue(property) !== ''
}

describe('dynamic customStyle removes old native inline values', () => {
  it.each([
    ['wd-pull-refresh', PullRefresh, {}, '.wd-pull-refresh'],
    ['wd-swiper', Swiper, { autoplay: false, list: ['one', 'two'] }, '.wd-swiper'],
    ['wd-table', Table, { data: [] }, '.wd-table']
  ] as const)('%s root clears a previously supplied customStyle key', async (_name, component, props, selector) => {
    const style = ref('color: red')
    const mounted = render({ setup: () => () => h(component as any, { ...props, customStyle: style.value }) } as any)
    const root = mounted.container.querySelector(selector)!
    expect(root).not.toBeNull()
    expect(hasInline(root, 'color')).toBe(true)
    style.value = ''
    await nextTick()
    expect(hasInline(root, 'color')).toBe(false)
  })

  it('wd-swiper gives each slide text an independent customTextStyle funnel and clears keys', async () => {
    const style = ref('color: red')
    const mounted = render({ setup: () => () => h(Swiper, {
      autoplay: false, list: [{ value: 'a', text: 'A' }, { value: 'b', text: 'B' }], customTextStyle: style.value
    }) } as any)
    const texts = mounted.container.querySelectorAll('.wd-swiper__text')
    expect(texts).toHaveLength(2)
    expect([...texts].every(text => hasInline(text, 'color'))).toBe(true)
    style.value = ''
    await nextTick()
    expect([...texts].every(text => !hasInline(text, 'color'))).toBe(true)
  })
})
