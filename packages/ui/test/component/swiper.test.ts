/**
 * wd-swiper 回归测试（scroll-view 自研分页实现，类名与 DOM 对齐 wot-ui 2.3.2）。
 */
import { describe, it, expect } from 'vitest'
import { h, ref } from 'vue-lynx'
import { render, cleanup } from '../render'
import { fireEvent } from '../fire-event'
import { pause } from '../../src/common/util'
import Swiper from '../../src/components/wd-swiper/wd-swiper.vue'

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
    expect(container.querySelectorAll('.wd-swiper-nav__item--dots').length).toBe(3)
    expect(container.querySelectorAll('.wd-swiper__image').length).toBe(3)
    cleanup()
  })

  it('scroll 事件更新 current 并触发 change', async () => {
    let changed: any = null
    // mock SelectorQuery：度量 .wd-swiper__scroll 宽 300 → itemWidth=300。
    // itemWidth 未度量（0）时 onScroll 按守卫忽略事件——否则任意 scrollLeft
    // 都会被 round 成离谱 index（真机 getRect 失败时 current/指示点错乱）。
    // 必须在渲染前 patch：onMounted 的度量发生在挂载期间。
    const bgLynx = (globalThis as any).lynxTestingEnv.backgroundThread.globalThis.lynx
    const origin = bgLynx.createSelectorQuery
    bgLynx.createSelectorQuery = () => ({
      select: (selector: string) => ({
        // getRect 的调用形状：invoke({ method, success, fail }).exec()，
        // 度量结果经 invoke 参数的 success 回调返回（exec 无参）
        invoke: (params: any) => ({
          exec: () => {
            if (params.method === 'boundingClientRect' && params.success) {
              params.success({ width: 300, height: 150, left: 0, top: 0, right: 300, bottom: 150 })
            }
          }
        })
      })
    })
    try {
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
      // scrollLeft=300 → index=1
      const scroll = container.querySelector('.wd-swiper__track') as Element
      expect(scroll).toBeTruthy()
      fireEvent.scroll(scroll, { detail: { scrollLeft: 300 } })
      await pause(50)
      expect(changed).not.toBeNull()
      expect(changed.current).toBe(1)
    } finally {
      bgLynx.createSelectorQuery = origin
    }
    cleanup()
  })

  it('空 list 时不渲染任何滑块（默认插槽位于 v-for 内，对齐参考源）', async () => {
    const { container } = render({
      setup() {
        return () => h(Swiper, { list: [] }, { default: () => h('view', { class: 'custom-slide' }, 'slide') })
      }
    } as any)
    await pause(50)
    expect(container.querySelector('.custom-slide')).toBeNull()
    expect(container.querySelectorAll('.wd-swiper__item').length).toBe(0)
    cleanup()
  })

  it('默认插槽经 list 渲染（slot 位于 v-for 内，对齐参考源）', async () => {
    const { container } = render({
      setup() {
        return () => h(Swiper, { list }, { default: () => h('view', { class: 'custom-slide' }, 'slide') })
      }
    } as any)
    await pause(50)
    expect(container.querySelectorAll('.custom-slide').length).toBe(3)
    cleanup()
  })
})
