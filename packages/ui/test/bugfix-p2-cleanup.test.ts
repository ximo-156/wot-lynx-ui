/**
 * 任务 #8（P2 清理项）回归锁定：
 * - wd-sticky：offsetTop 需区分「未传（继承父级 sticky-box）」与「显式 0（贴顶）」。
 *   旧实现 prop 默认 0 + 真值判断 → 显式 0 被当作未传，错用父级偏移。
 * - wd-count-to：时间文本格式化（旧实现含死代码，且 decimals===0 时经 Number()
 *   中转会把大数变成科学计数法）。
 */
import { describe, it, expect } from 'vitest'
import { h } from 'vue-lynx'
import { render, cleanup } from './render'
import { pause } from '../src/common/util'
import Sticky from '../src/components/wd-sticky/wd-sticky.vue'
import StickyBox from '../src/components/wd-sticky-box/wd-sticky-box.vue'
import CountTo from '../src/components/wd-count-to/wd-count-to.vue'

async function frames(n = 6) {
  for (let i = 0; i < n; i++) await pause()
}

function styleOf(el: Element | null): string {
  return el?.getAttribute('style') || ''
}

describe('P2 清理项回归', () => {
  it('wd-sticky：offsetTop=0 是显式值，不被父级 sticky-box 覆盖', async () => {
    const { container } = render({
      setup() {
        return () =>
          h(
            StickyBox as any,
            { offsetTop: 50, containerHeight: 200 },
            { default: () => h(Sticky as any, { offsetTop: 0 }, { default: () => h('view', '内容') }) }
          )
      }
    } as any)
    await frames()

    const sticky = container.querySelector('.wd-sticky')
    expect(sticky, '应渲染 wd-sticky').toBeTruthy()
    expect(
      styleOf(sticky),
      'offsetTop=0 应显式生效（贴顶），不得被父级 50 覆盖'
    ).toContain('top: 0px')
    cleanup()
  })

  it('wd-sticky：未传 offsetTop 时贴顶（对齐 wot-ui：不从 sticky-box 继承）', async () => {
    const { container } = render({
      setup() {
        return () =>
          h(
            StickyBox as any,
            { offsetTop: 50 },
            { default: () => h(Sticky as any, {}, { default: () => h('view', '内容') }) }
          )
      }
    } as any)
    await frames()

    const sticky = container.querySelector('.wd-sticky')
    expect(sticky, '应渲染 wd-sticky').toBeTruthy()
    // wot-ui 2.3.2：offsetTop 默认 0 且无父子继承（旧本地行为已移除）
    expect(styleOf(sticky), '未传 offsetTop 应为 top: 0px').toContain('top: 0px')
    cleanup()
  })

  it('wd-count-to：小数位与千分位格式化正确', async () => {
    const { container } = render({
      setup() {
        return () =>
          h(CountTo as any, { startVal: 1234.5, endVal: 1234.5, decimals: 2, autoStart: false })
      }
    } as any)
    await frames()
    const text = container.querySelector('.wd-count-to__main-text')?.textContent?.trim()
    expect(text, 'decimals=2 应保留两位小数并加千分位').toBe('1,234.50')
    cleanup()
  })

  it('wd-count-to：decimals=0 的大数不使用科学计数法', async () => {
    const { container } = render({
      setup() {
        return () =>
          h(CountTo as any, { startVal: 1234567, endVal: 1234567, decimals: 0, autoStart: false })
      }
    } as any)
    await frames()
    const text = container.querySelector('.wd-count-to__main-text')?.textContent?.trim() || ''
    expect(text, '应输出带千分位的完整整数串').toBe('1,234,567')
    expect(text, '不得出现科学计数法').not.toMatch(/e\+/i)
    cleanup()
  })
})
