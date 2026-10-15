/**
 * wd-swiper 回归测试（scroll-view 自研分页实现）。
 */
import { describe, it, expect } from 'vitest'
import { h, ref } from 'vue-lynx'
import { render, cleanup } from './render'
import { fireEvent } from './fire-event'
import { pause } from '../src/common/util'
import Swiper from '../src/components/wd-swiper/wd-swiper.vue'

const list = [
  { url: 'https://example.com/1.png' },
  { url: 'https://example.com/2.png' },
  { url: 'https://example.com/3.png' }
]

describe('wd-swiper', () => {
  it('渲染 list 图片项与指示点', async () => {
    const { container } = render({
      setup() {
        const v = ref(0)
        return () => h(Swiper, { list, modelValue: v.value, 'onUpdate:modelValue': (x: number) => (v.value = x) })
      }
    } as any)
    await pause(50)
    expect(container.querySelectorAll('.wd-swiper__item').length).toBe(3)
    expect(container.querySelectorAll('.wd-swiper__dot').length).toBe(3)
    expect(container.querySelectorAll('.wd-swiper__img').length).toBe(3)
    cleanup()
  })

  it('scroll 事件更新 current 并触发 change', async () => {
    let changed: any = null
    const { container } = render({
      setup() {
        const v = ref(0)
        return () =>
          h(Swiper, {
            list,
            modelValue: v.value,
            'onUpdate:modelValue': (x: number) => (v.value = x),
            onChange: (d: any) => (changed = d)
          })
      }
    } as any)
    await pause(50)
    const scroll = container.querySelector('.wd-swiper__scroll') as Element
    expect(scroll).toBeTruthy()
    // jsdom 中 itemWidth 为 0（getRect 无布局），index = round(scrollLeft/1)
    fireEvent.scroll(scroll, { detail: { scrollLeft: 1 } })
    await pause(50)
    expect(changed).not.toBeNull()
    cleanup()
  })

  it('空 list 时渲染默认插槽', async () => {
    const { container } = render({
      setup() {
        return () => h(Swiper, { list: [] }, { default: () => h('view', { class: 'custom-slide' }, 'slide') })
      }
    } as any)
    await pause(50)
    expect(container.querySelector('.custom-slide')).toBeTruthy()
    cleanup()
  })
})
