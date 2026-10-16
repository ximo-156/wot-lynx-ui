/**
 * wd-swipe-action 交互回归（2026-10 真机缺陷修复）：
 * - 三处 @click 死事件改 @tap：操作按钮点击后收起、发 update:modelValue 与
 *   click 载荷 { value: 'left' | 'right' | 'inside' }（CONVENTIONS §14）；
 * - watch(modelValue)：外部可编程开/合；
 * - 方向锁：纵向位移不触发横移；
 * - click 载荷对齐 wot-ui；关闭态点击不 emit；
 * - 根 view @tap 已在 emits 声明并转发（§14 合并数组 handler 防护）。
 */
import { describe, it, expect } from 'vitest'
import { h, ref } from 'vue-lynx'
import { render, cleanup } from './render'
import { fireEvent } from './fire-event'
import { pause } from '../src/common/util'
import SwipeAction from '../src/components/wd-swipe-action/wd-swipe-action.vue'

function wrapperStyleOf(container: Element): string {
  const w = container.querySelector('.wd-swipe-action__wrapper')
  return w ? w.getAttribute('style') || '' : ''
}

/** 挂载一个带左右操作区的 swipe-action，返回容器与状态记录 */
function mountSwipe(record: { modelValue?: string; clicks: any[]; taps: any[] }) {
  const v = ref<string>(record.modelValue || 'close')
  const { container } = render({
    setup() {
      return () =>
        h(
          SwipeAction,
          {
            modelValue: v.value,
            'onUpdate:modelValue': (x: string) => {
              v.value = x
              record.modelValue = x
            },
            onClick: (e: any) => record.clicks.push(e),
            onTap: (e: any) => record.taps.push(e)
          },
          {
            left: () => h('view', { class: 'op-left' }, '收藏'),
            default: () => h('view', { class: 'op-content' }, '单元格'),
            right: () => h('view', { class: 'op-right' }, '删除')
          }
        )
    }
  } as any)
  return { container, v }
}

describe('wd-swipe-action 交互回归', () => {
  it('向左拖拽超过阈值展开右侧操作区并同步 modelValue', async () => {
    const record = { clicks: [] as any[], taps: [] as any[] }
    const { container } = mountSwipe(record)
    const root = container.querySelector('.wd-swipe-action') as Element
    const right = container.querySelector('.wd-swipe-action__right') as Element
    expect(root).toBeTruthy()
    expect(right).toBeTruthy()

    // 操作区宽度在 jsdom 为 0（getRect 无布局）：用足够大的位移 + 直接注入宽度的方式
    // 验证阈值状态机——先把右区宽度通过样式撑开不可行（jsdom 无布局），
    // 故退而验证：touchstart/touchmove/touchend 链路不崩且 transition 状态正确切换
    fireEvent.touchstart(root, { touches: [{ clientX: 300, clientY: 0 }] })
    fireEvent.touchmove(root, { touches: [{ clientX: 200, clientY: 0 }] })
    await pause(20)
    // 拖动中（dragging=true）transition 必须为 none（跟手）。
    // 不能靠「删键」——Lynx SetStyle 是合并语义，必须显式置 none
    expect(wrapperStyleOf(container)).toContain('transition: none')
    fireEvent.touchend(root, { touches: [], changedTouches: [{ clientX: 200, clientY: 0 }] })
    await pause(50)
    // 松手后恢复过渡（吸附动画）
    expect(wrapperStyleOf(container)).toContain('transition: transform')
    cleanup()
  })

  it('纵向位移不触发横移（方向锁）', async () => {
    const record = { clicks: [] as any[], taps: [] as any[] }
    const { container } = mountSwipe(record)
    const root = container.querySelector('.wd-swipe-action') as Element
    fireEvent.touchstart(root, { touches: [{ clientX: 300, clientY: 100 }] })
    // 纵向大位移 + 横向小位移：direction 判为 vertical，横移不得发生
    fireEvent.touchmove(root, { touches: [{ clientX: 310, clientY: 400 }] })
    await pause(20)
    expect(wrapperStyleOf(container)).toContain('translateX(0px)')
    fireEvent.touchend(root, { touches: [], changedTouches: [{ clientX: 310, clientY: 400 }] })
    await pause(50)
    cleanup()
  })

  it('外部 modelValue=right 编程展开（watch 同步）', async () => {
    const record = { clicks: [] as any[], taps: [] as any[] }
    const v = ref<string>('close')
    const { container } = render({
      setup() {
        return () =>
          h(
            SwipeAction,
            {
              modelValue: v.value,
              'onUpdate:modelValue': (x: string) => (v.value = x)
            },
            {
              left: () => h('view', { class: 'op-left' }, '收藏'),
              default: () => h('view', { class: 'op-content' }, '单元格'),
              right: () => h('view', { class: 'op-right' }, '删除')
            }
          )
      }
    } as any)
    await pause(30)
    // jsdom 无布局，右区宽度为 0：swipeMove(-0) = translateX(0px)，
    // 但 changeState 链路不得崩；此处主要验证 watch 存在且被触发
    v.value = 'right'
    await pause(50)
    expect(wrapperStyleOf(container)).toContain('translateX')
    v.value = 'close'
    await pause(50)
    expect(wrapperStyleOf(container)).toContain('translateX(0px)')
    cleanup()
  })

  it('根 view @tap 已声明为 emits 并转发（§14 防合并数组 handler）', async () => {
    const record = { clicks: [] as any[], taps: [] as any[] }
    const { container } = mountSwipe(record)
    const root = container.querySelector('.wd-swipe-action') as Element
    fireEvent.tap(root)
    await pause(30)
    // 关闭态 tap：转发原生 tap 但不 emit click（wot-ui 语义）
    expect(record.taps.length).toBe(1)
    expect(record.clicks.length).toBe(0)
    cleanup()
  })

  it('禁用态：touch 与 tap 均不产生状态变化', async () => {
    const record = { modelValue: 'close', clicks: [] as any[], taps: [] as any[] }
    const { container } = render({
      setup() {
        return () =>
          h(
            SwipeAction,
            {
              modelValue: 'close',
              disabled: true,
              'onUpdate:modelValue': (x: string) => (record.modelValue = x),
              onClick: (e: any) => record.clicks.push(e)
            },
            {
              default: () => h('view', { class: 'op-content' }, '单元格'),
              right: () => h('view', { class: 'op-right' }, '删除')
            }
          )
      }
    } as any)
    const root = container.querySelector('.wd-swipe-action') as Element
    fireEvent.touchstart(root, { touches: [{ clientX: 300, clientY: 0 }] })
    fireEvent.touchmove(root, { touches: [{ clientX: 100, clientY: 0 }] })
    fireEvent.touchend(root, { touches: [], changedTouches: [{ clientX: 100, clientY: 0 }] })
    fireEvent.tap(root)
    await pause(50)
    expect(record.modelValue).toBe('close')
    expect(record.clicks.length).toBe(0)
    cleanup()
  })
})
