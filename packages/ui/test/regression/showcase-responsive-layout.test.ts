import { afterEach, describe, expect, it } from 'vitest'
import { h, nextTick, ref } from 'vue-lynx'
import { cleanup, render } from '../render'
import ShowcaseLayout from '../../../demo/src/showcase/ShowcaseLayout'

afterEach(cleanup)

describe('responsive showcase layout', () => {
  it('uses explicit columns without duplicating sections, header or overlays', async () => {
    const columns = ref(2)
    const model = ref('保留的输入')
    const { container } = render({
      setup: () => () => h(ShowcaseLayout as any, { columns: columns.value, contentWidth: 1200 }, {
        default: () => [
          h('view', { class: 'page__header' }, [h('text', 'Header')]),
          ...Array.from({ length: 7 }, (_, index) => h('view', { class: 'demo-section' }, [h('text', `${index}: ${model.value}`)])),
          h('view', { class: 'overlay-instance' })
        ]
      })
    } as any)
    await nextTick()
    expect(container.querySelectorAll('.showcase__column')).toHaveLength(2)
    expect(container.querySelectorAll('.demo-section')).toHaveLength(7)
    expect(container.querySelectorAll('.page__header')).toHaveLength(1)
    expect(container.querySelectorAll('.overlay-instance')).toHaveLength(1)
    expect((container.querySelector('.showcase__column') as HTMLElement).style.width).toBe('590px')
    columns.value = 3
    await nextTick()
    expect(container.querySelectorAll('.showcase__column')).toHaveLength(3)
    expect(container.querySelectorAll('.demo-section')).toHaveLength(7)
    model.value = '新的输入'
    await nextTick()
    expect(container.querySelectorAll('.demo-section')[0].textContent).toContain('新的输入')
    columns.value = 1
    await nextTick()
    expect(container.querySelectorAll('.showcase__column')).toHaveLength(1)
    expect(container.querySelectorAll('.demo-section')).toHaveLength(7)
  })
})
